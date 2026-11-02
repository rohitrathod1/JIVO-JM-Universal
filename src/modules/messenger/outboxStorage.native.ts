import * as SecureStore from 'expo-secure-store'
import { randomUUID } from 'expo-crypto'
import { SecureSnapshot } from '../../core/storage/secureSnapshot'
import type { OutboxStorage, PendingSend } from './outboxController'

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const snapshot = new SecureSnapshot({
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}, 'jm.outbox.v1', randomUUID)
let owner: string | null = null
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(work: () => Promise<T>): Promise<T> {
  const pending = queue.catch(() => {}).then(work); queue = pending; return pending
}
async function rows(): Promise<PendingSend[]> {
  const value: unknown = JSON.parse(await snapshot.read() ?? '[]')
  if (!Array.isArray(value)) throw Error('Invalid protected outbox')
  return value as PendingSend[]
}
export const outboxStorage: OutboxStorage = {
  read: nextOwner => serial(async () => {
    const saved = await rows()
    if (nextOwner) {
      if (saved.some(entry => entry.owner !== nextOwner)) await snapshot.write(JSON.stringify(saved.filter(entry => entry.owner === nextOwner)))
      owner = nextOwner
    }
    return saved.filter(entry => entry.owner === owner)
  }),
  put: (entry, create) => serial(async () => {
    if (entry.owner !== owner) throw Error('Outbox belongs to a different account')
    const saved = await rows()
    const index = saved.findIndex(row => row.owner === entry.owner && row.payload.client_id === entry.payload.client_id)
    if (index >= 0) saved[index] = entry
    else if (create) saved.push(entry)
    await snapshot.write(JSON.stringify(saved))
  }),
  remove: (account, client) => serial(async () => {
    const saved = await rows()
    await snapshot.write(JSON.stringify(saved.filter(row => row.owner !== account || row.payload.client_id !== client)))
  }),
  clear: () => serial(async () => { owner = null; await snapshot.clear() }),
}
export const outboxStorageNotice = 'Unsent messages are protected on this device until sent or discarded, and cleared on sign-out.'
