import type { Attachment } from '../api'
type Dependencies = { read: (id: string) => Promise<Attachment>; subscribe: (handler: (upload: Attachment) => void) => () => void }
export function awaitScan(upload: Attachment, deps: Dependencies, signal: AbortSignal, timeout = 120000): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    let done = false
    let off = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    let poll: ReturnType<typeof setTimeout> | undefined
    const finish = (value?: Attachment, error?: Error) => {
      if (done) return
      done = true; clearTimeout(timer); clearTimeout(poll); off(); signal.removeEventListener('abort', abort)
      if (error) reject(error); else resolve(value!)
    }
    const abort = () => finish(undefined, new Error('Upload cancelled.'))
    const accept = (value: Attachment) => {
      if (value.id !== upload.id) return
      if (value.status === 'ready') finish(value)
      if (value.status === 'rejected') finish(undefined, new Error('The server rejected this file. It cannot be sent.'))
    }
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    accept(upload); if (done) return
    off = deps.subscribe(accept)
    const check = async () => {
      try { accept(await deps.read(upload.id)) } catch { /* transient failures retain the bounded wait */ }
      if (!done) poll = setTimeout(() => void check(), 2000)
    }
    poll = setTimeout(() => void check(), 2000)
    timer = setTimeout(() => finish(undefined, Object.assign(new Error('The file is still being checked. Retrying automatically.'), { retryable: true })), timeout)
  })
}
