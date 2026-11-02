export interface SecureValues {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
interface Version { id: string; chunks: number }
interface Manifest { current: Version | null; garbage: Version | null }

/** Chunked OS-encrypted snapshot. Publish the new manifest only after every chunk is durable. */
export class SecureSnapshot {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private values: SecureValues, private key: string, private uuid: () => string) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.catch(() => {}).then(work)
    this.queue = pending
    return pending
  }
  private chunk(version: Version, index: number) { return `${this.key}.${version.id}.${index}` }
  private async manifest(): Promise<Manifest> {
    const raw = await this.values.get(this.key)
    if (!raw) return { current: null, garbage: null }
    const value = JSON.parse(raw) as Manifest
    if (!value || typeof value !== 'object' || !('current' in value) || !('garbage' in value)) throw Error('Invalid protected storage manifest')
    for (const version of [value.current, value.garbage]) {
      if (version !== null && (typeof version !== 'object' || typeof version.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(version.id) || !Number.isInteger(version.chunks) || version.chunks < 1 || version.chunks > 10000)) throw Error('Invalid protected storage manifest')
    }
    return value
  }
  private async clean(manifest: Manifest) {
    if (!manifest.garbage) return
    for (let n = 0; n < manifest.garbage.chunks; n++) await this.values.remove(this.chunk(manifest.garbage, n))
    await this.values.set(this.key, JSON.stringify({ current: manifest.current, garbage: null }))
  }
  read(): Promise<string | null> {
    return this.serial(async () => {
      const manifest = await this.manifest()
      await this.clean(manifest)
      if (!manifest.current) return null
      let result = ''
      for (let n = 0; n < manifest.current.chunks; n++) {
        const part = await this.values.get(this.chunk(manifest.current, n))
        if (part === null) throw Error('Protected queued messages are incomplete')
        result += part
      }
      return result
    })
  }
  write(value: string): Promise<void> {
    return this.serial(async () => {
      const points = Array.from(value)
      const parts: string[] = []
      // At most 1600 UTF-8 bytes each, below the historical iOS item limit.
      for (let n = 0; n < points.length; n += 400) parts.push(points.slice(n, n + 400).join(''))
      if (!parts.length) parts.push('')
      if (parts.length > 10000) throw Error('Protected outbox storage is full')
      const old = await this.manifest(); await this.clean(old)
      const next = { id: this.uuid(), chunks: parts.length }
      // Remember staged chunks before writing them so interruption cannot leave untracked records.
      await this.values.set(this.key, JSON.stringify({ current: old.current, garbage: next }))
      for (let n = 0; n < parts.length; n++) await this.values.set(this.chunk(next, n), parts[n])
      await this.values.set(this.key, JSON.stringify({ current: next, garbage: old.current }))
      await this.clean({ current: next, garbage: old.current })
    })
  }
  clear(): Promise<void> {
    return this.serial(async () => {
      const old = await this.manifest(); await this.clean(old)
      const cleared = { current: null, garbage: old.current }
      await this.values.set(this.key, JSON.stringify(cleared))
      await this.clean(cleared)
      await this.values.remove(this.key)
    })
  }
}
