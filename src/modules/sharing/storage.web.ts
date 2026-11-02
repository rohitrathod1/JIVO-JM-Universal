import type { IncomingStorage } from './storage'
import { compatibleSharePlan, validateIncoming, type IncomingShare, type SharePlan } from './model'
interface Stored { id: string; owner: string | null; at: number; caption: string; files: File[]; plan?: SharePlan }
export const SHARE_DB = 'jm-incoming-share-v1'
function open() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(SHARE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function transact<T>(action: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => { const transaction = db.transaction('pending', 'readwrite'); let result: T; action(transaction.objectStore('pending'), value => { result = value }); transaction.oncomplete = () => { db.close(); resolve(result) }; transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error ?? Error('Incoming share storage is unavailable.')) } })
}
const files = (value: Stored) => value.files.map(file => ({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream', uri: '', file }))
export const incomingStorage: IncomingStorage = {
  async read(owner) {
    return transact<IncomingShare | null>((store, done) => {
      const request = store.get('incoming')
      request.onsuccess = () => {
        const value = request.result as Stored | undefined
        if (!value) { done(null); return }
        try { validateIncoming({ ...value, files: files(value) }); if (value.owner && value.owner !== owner) throw Error('Wrong account') }
        catch { store.delete('incoming'); done(null); return }
        value.owner = owner; store.put(value, 'incoming'); done({ ...value, files: files(value) })
      }
    })
  },
  async save(value) {
    await transact<void>((store, done) => {
      const request = store.get('incoming')
      request.onsuccess = () => {
        const old = request.result as Stored | undefined
        if (!old || old.id !== value.id || old.owner !== value.owner || !compatibleSharePlan(old.plan, value.plan)) { store.transaction.abort(); return }
        store.put({ ...old, caption: value.caption, plan: value.plan }, 'incoming'); done()
      }
    })
  },
  async clear(id) { await transact<void>((store, done) => { if (!id) { const boundary = store.get('boundary'); boundary.onsuccess = () => store.put(Number(boundary.result || 0) + 1, 'boundary') } const request = store.get('incoming'); request.onsuccess = () => { if (!id || (request.result as Stored | undefined)?.id === id) store.delete('incoming'); done() } }) },
  async hasPending() { return transact<boolean>((store, done) => { const request = store.get('incoming'); request.onsuccess = () => { const value = request.result as Stored | undefined; if (value && Date.now() - value.at > 600000) { store.delete('incoming'); done(false) } else done(Boolean(value)) } }) },
}
