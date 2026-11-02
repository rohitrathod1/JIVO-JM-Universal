import * as Sharing from 'expo-sharing'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { File } from 'expo-file-system'
import { SecureSnapshot } from '../../core/storage/secureSnapshot'
import { compatibleSharePlan, validateIncoming, type IncomingShare } from './model'
import { mayResolveNative, nativeShareParts } from './nativePayload'
import type { IncomingStorage } from './storage'
const snapshot = new SecureSnapshot({ get: SecureStore.getItemAsync, set: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }), remove: SecureStore.deleteItemAsync }, 'jm.incoming-share', Crypto.randomUUID)
let epoch = 0
let serial: Promise<unknown> = Promise.resolve()
function locked<T>(work: () => Promise<T>) { const next = serial.catch(() => undefined).then(work); serial = next; return next }
async function rawShare() { const raw = Sharing.getSharedPayloads(); const id = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(raw)); return { raw, id } }
function clearRaw(raw: ReturnType<typeof Sharing.getSharedPayloads>) {
  // Hashing and storage are asynchronous. A newer OS intent may have arrived
  // meanwhile, so compare synchronously immediately before clearing Expo's slot.
  if (JSON.stringify(Sharing.getSharedPayloads()) === JSON.stringify(raw)) Sharing.clearSharedPayloads()
}
export const incomingStorage: IncomingStorage = {
  read(owner) {
    const current = epoch
    return locked(async () => {
      const { raw, id } = await rawShare()
      const stored = await snapshot.read()
      const previous = stored ? JSON.parse(stored) as IncomingShare : null
      if (current !== epoch) return null
      if (previous?.owner && previous.owner !== owner) { Sharing.clearSharedPayloads(); await snapshot.clear(); return null }
      if (previous) {
        let valid = true
        try { validateIncoming(previous) } catch { valid = false }
        if (valid) {
          // The durable review/plan wins over the single mutable OS intent slot.
          // Never replace its files, recipients or retry IDs with a newer intent.
          const value = { ...previous, owner }
          if (previous.owner !== owner) await snapshot.write(JSON.stringify(value))
          return current === epoch ? value : null
        }
        await snapshot.clear()
        if (current !== epoch) return null
        if (previous.id === id) { clearRaw(raw); return null }
      }
      if (!raw.length) return null
      // Expo's generic hook resolves URLs over the network; only resolve all-local file payloads.
      const resolved = mayResolveNative(raw) ? await Sharing.getResolvedSharedPayloadsAsync() : []
      const parts = nativeShareParts(raw, resolved, uri => { const file = new File(uri); return { size: file.size, name: file.name } })
      const value: IncomingShare = { id, owner, at: Date.now(), ...parts }
      validateIncoming(value)
      if (current !== epoch) return null
      await snapshot.write(JSON.stringify(value))
      return current === epoch ? value : null
    })
  },
  save(value) {
    const current = epoch
    return locked(async () => { const old = await snapshot.read(); const previous = old ? JSON.parse(old) as IncomingShare : null; if (current !== epoch || !previous || previous.id !== value.id || previous.owner !== value.owner || !compatibleSharePlan(previous.plan, value.plan)) throw Error('This share belongs to a previous session or another review.'); validateIncoming(value); await snapshot.write(JSON.stringify(value)) })
  },
  clear(id) {
    ++epoch
    return locked(async () => { const old = await snapshot.read(); const previous = old ? JSON.parse(old) as IncomingShare : null; if (!id || !previous || previous.id === id) { if (!id) Sharing.clearSharedPayloads(); else { const current = await rawShare(); if (current.id === id) clearRaw(current.raw) } await snapshot.clear() } })
  },
  hasPending() {
    return locked(async () => {
      if (Sharing.getSharedPayloads().length > 0) return true
      const stored = await snapshot.read()
      if (!stored) return false
      try { validateIncoming(JSON.parse(stored) as IncomingShare); return true } catch { return false }
    })
  },
}
