import type { PickedFile } from './media/model'
export interface QueuedMedia { key: string; name: string; mime: string; size: number; uploadId?: string }
const MAX_BYTES = 500 * 1024 * 1024
function database(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const r = indexedDB.open('jm-pending-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) }) }
async function transaction<T>(work: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
 const db = await database()
 try { return await new Promise<T>((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); let value: T; tx.oncomplete = () => resolve(value); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); work(tx.objectStore('files'), result => { value = result }) }) } finally { db.close() }
}
const id = (owner: string, client: string, key: string) => JSON.stringify([owner, client, key])
export const queuedMedia = {
 async save(owner: string, client: string, key: string, file: PickedFile): Promise<QueuedMedia> {
  const blob = file.file ?? await (await fetch(file.uri)).blob()
  await transaction<void>((store, done) => { const read = store.getAll(); read.onsuccess = () => { if (read.result.reduce((n, r) => n + r.blob.size, 0) + blob.size > MAX_BYTES) { store.transaction.abort(); return } store.put({ id: id(owner, client, key), owner, client, blob }); done() } })
  return { key, name: file.name, mime: file.mime, size: blob.size }
 },
 async open(owner: string, client: string, media: QueuedMedia): Promise<PickedFile> {
  const blob = await transaction<Blob | undefined>((store, done) => { const r = store.get(id(owner, client, media.key)); r.onsuccess = () => done(r.result?.blob) })
  if (!blob) throw Error('The saved file is missing. Remove this message and select the file again.')
  const uri = URL.createObjectURL(blob)
  return { ...media, uri, file: new File([blob], media.name, { type: media.mime }), dispose: () => URL.revokeObjectURL(uri) }
 },
 async remove(owner: string, client: string) { await transaction<void>((store, done) => { const r = store.openCursor(); r.onsuccess = () => { const row = r.result; if (!row) { done(); return } if (row.value.owner === owner && row.value.client === client) row.delete(); row.continue() } }) },
 async retain(owner: string | null) { await transaction<void>((store, done) => { const r = store.openCursor(); r.onsuccess = () => { const row = r.result; if (!row) { done(); return } if (row.value.owner !== owner) row.delete(); row.continue() } }) },
}
