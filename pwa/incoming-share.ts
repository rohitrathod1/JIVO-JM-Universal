/// <reference lib="webworker" />
export {}
declare const self: ServiceWorkerGlobalScope
const incomingLimit = 50 * 1024 * 1024
function incomingDb() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('jm-incoming-share-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function incomingBoundary(db: IDBDatabase) { return new Promise<number>((resolve, reject) => { const request = db.transaction('pending').objectStore('pending').get('boundary'); request.onsuccess = () => resolve(Number(request.result || 0)); request.onerror = () => reject(request.error) }) }
async function incomingForm(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > incomingLimit + 65536) throw Error('too-large')
  const reader = request.body?.getReader()
  if (!reader) throw Error('empty')
  const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > incomingLimit + 65536) { await reader.cancel(); throw Error('too-large') } chunks.push(new Uint8Array(part.value)) }
  return new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData()
}
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url)
  if (request.method !== 'POST' || url.origin !== self.location.origin || url.pathname !== '/share-target') return
  event.respondWith((async () => {
    let db: IDBDatabase | undefined
    try {
      db = await incomingDb(); const boundary = await incomingBoundary(db)
      const form = await incomingForm(request)
      const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0)
      const text = ['title', 'text', 'url'].map(key => String(form.get(key) || '').trim()).filter(Boolean)
      const caption = [...new Set(text)].filter(part => !text.some(other => other !== part && other.includes(part))).join('\n')
      if (files.length > 10 || files.reduce((sum, file) => sum + file.size, 0) > incomingLimit || caption.length > 4000) throw Error('too-large')
      if (!files.length && !caption) throw Error('empty')
      let owner: string | null = null
      try { const response = await fetch('/api/jm/me/', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000) }); if (response.ok) { const me = await response.json() as { id?: unknown }; if (typeof me.id === 'string') owner = me.id } } catch { /* Offline intake remains unbound until explicit signed-in review. */ }
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction('pending', 'readwrite'); const store = transaction.objectStore('pending')
        const check = store.get('boundary')
        check.onsuccess = () => {
          if (Number(check.result || 0) !== boundary) { transaction.abort(); return }
          const existing = store.get('incoming')
          existing.onsuccess = () => {
            const old = existing.result as { at?: number } | undefined
            // Never overwrite another share with a retry plan; the person must review/discard it.
            if (old && Date.now() - Number(old.at || 0) < 600000) { transaction.abort(); return }
            store.put({ id: crypto.randomUUID(), owner, at: Date.now(), caption, files }, 'incoming')
          }
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = transaction.onabort = () => reject(Error('pending-or-session-changed'))
      })
      return Response.redirect(new URL('/share', self.location.origin).href, 303)
    } catch (error) {
      const reason = error instanceof Error && error.message === 'too-large' ? 'limit' : 'retry'
      return Response.redirect(new URL(`/share?shareError=${reason}`, self.location.origin).href, 303)
    } finally { db?.close() }
  })())
})
