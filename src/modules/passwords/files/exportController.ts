export const EXPORT_LIFETIME_MS = 120000
export const MAX_NATIVE_EXPORT_BYTES = 20 * 1024 * 1024
export function validateNativeExportSize(size: number, label = 'vault') { if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_NATIVE_EXPORT_BYTES) throw Error(`Native ${label} export supports non-empty files up to 20 MiB. Use the web client for larger files.`) }
export function exportFilename(input: string) {
 const leaf = input.split(/[\\/]/).pop() ?? ''
 const safe = leaf.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+|\.+$/g, '').slice(0, 100)
 return `export-${safe || 'vault-file.bin'}`
}
export interface ExportIO {
 available(): Promise<boolean>
 encode(blob: Blob): Promise<string>
 stage(name: string, base64: string): string
 share(uri: string): Promise<void>
 purge(): void
 now?(): number
}
/** Owns only the application's dedicated export staging directory. No actual IO in this class. */
export class NativeExportController {
 private busy = false
 private generation = 0
 private deadline = 0
 private rejectCurrent: ((error: Error) => void) | null = null
 private listeners = new Set<(error: string) => void>()
 private cleanupError = ''
 constructor(private io: ExportIO, private label = 'vault') {}
 subscribe = (listener: (error: string) => void) => { this.listeners.add(listener); listener(this.cleanupError); return () => { this.listeners.delete(listener) } }
 private purge() {
  try { this.io.purge(); this.cleanupError = '' }
  catch { this.cleanupError = `Temporary ${this.label} export cleanup failed. Export is blocked until cleanup succeeds. Retry cleanup before continuing.`; throw Error(this.cleanupError) }
  finally { this.listeners.forEach(listener => listener(this.cleanupError)) }
 }
 cleanupIdle = () => { if (!this.busy) this.purge() }
 resume = () => { if (this.busy && (this.io.now?.() ?? Date.now()) >= this.deadline) this.cancel(); else this.cleanupIdle() }
 cancel = () => { this.generation++; this.rejectCurrent?.(Error(`${this.label} file export was cancelled.`)); this.purge() }
 async export(blob: Blob, name: string, isCurrent: () => boolean) {
  if (this.busy) throw Error(`Another ${this.label} export is still active.`)
  validateNativeExportSize(blob.size, this.label)
  this.busy = true; const generation = ++this.generation
  this.deadline = (this.io.now?.() ?? Date.now()) + EXPORT_LIFETIME_MS
  const check = () => { if (generation !== this.generation || !isCurrent()) throw Error(`${this.label} export expired or the view lost focus. Start again when ready.`) }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
   this.purge(); check()
   const interrupted = new Promise<never>((_, reject) => { this.rejectCurrent = reject; timer = setTimeout(() => reject(Error(`${this.label} export timed out. Please try again.`)), EXPORT_LIFETIME_MS) })
   const work = async () => {
    if (!await this.io.available()) throw Error('Native file sharing is unavailable on this device.')
    check(); let encoded = await this.io.encode(blob); check()
    let uri: string
    try { uri = this.io.stage(exportFilename(name), encoded) } finally { encoded = '' }
    check()
    // A deliberate system share may background the app. Do not purge on that transition.
    // The receiver gets access only after this explicit handoff; completion/cancel/timeout purges staging.
    await this.io.share(uri)
   }
   await Promise.race([work(), interrupted])
  } finally {
   clearTimeout(timer); this.generation++; this.rejectCurrent = null
   try { this.purge() } finally { this.busy = false; this.deadline = 0 }
  }
 }
}
