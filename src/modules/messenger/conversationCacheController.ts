import type { ConversationDetail, ConversationItem, Message } from './api'
import type { WindowState } from './lib/window'
import type { Frame } from '../../core/realtime/client'

export interface CachedHistory { detail: ConversationDetail; window: WindowState }
export interface HistoryCache {
  get(id: string): Promise<CachedHistory | null>
  put(id: string, value: CachedHistory, generation?: number): void
  remove(id: string): void
  generation?(): number
}
export interface CacheStorage { read(): Promise<string | null>; write(value: string): Promise<void>; clear(): Promise<void> }
interface Saved { version: 1; owner: string; expires: number; items: ConversationItem[]; histories: Record<string, CachedHistory> }
const MAX_AGE = 30 * 60_000
const MAX_CHATS = 10
const MAX_MESSAGES = 40
const MAX_CHARACTERS = 200_000
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const locked = (item: ConversationItem) => Boolean((item as ConversationItem & { locked_at?: string | null; locked?: boolean; is_locked?: boolean }).locked_at || (item as ConversationItem & { locked?: boolean }).locked || (item as ConversationItem & { is_locked?: boolean }).is_locked)
const visible = (message: Message, now: number) => {
  const expires = (message as Message & { expires_at?: string | null }).expires_at
  return !expires || (Number.isFinite(Date.parse(expires)) && Date.parse(expires) > now)
}

/** Small recent-history cache, not an offline authentication credential. */
export class ConversationCache implements HistoryCache {
  private owner: string | null = null
  private epoch = 0
  private data: Saved | null = null
  private lockedIds = new Set<string>()
  private revision = 0
  generation = () => this.revision
  private ready: Promise<void> = Promise.resolve()
  private writes: Promise<unknown> = Promise.resolve()
  private timer: ReturnType<typeof setTimeout> | null = null
  constructor(private storage: CacheStorage, private now: () => number = Date.now) {}
  private serial(work: () => Promise<void>) { const next = this.writes.catch(() => {}).then(work); this.writes = next; return next }
  private cancel() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null }
  private persist() {
    this.cancel()
    const epoch = this.epoch
    this.timer = setTimeout(() => {
      this.timer = null
      void this.serial(async () => {
        if (epoch !== this.epoch || !this.data) return
        await this.storage.write(JSON.stringify(this.data))
      }).catch(() => {}) // Caching is optional; it must never interrupt a live send.
    }, 500)
  }
  bind(owner: string | null, expiresAt?: string | null, preserve = false): Promise<void> {
    if (owner !== null && owner === this.owner && this.valid()) {
      if (expiresAt) {
        const expiry = Date.parse(expiresAt)
        this.data!.expires = Number.isFinite(expiry) ? Math.min(this.data!.expires, expiry) : 0
        if (this.valid()) this.persist()
      }
      return this.ready
    }
    const epoch = ++this.epoch; this.revision++
    this.cancel(); this.owner = owner; this.data = null; this.lockedIds.clear()
    this.ready = this.serial(async () => {
      if (!owner) { if (!preserve) await this.storage.clear(); return }
      const sessionExpiry = expiresAt ? Date.parse(expiresAt) : this.now() + MAX_AGE
      if (!Number.isFinite(sessionExpiry) || sessionExpiry <= this.now()) { await this.storage.clear(); return }
      let saved: Saved | null = null
      try {
        const raw = await this.storage.read()
        if (raw && raw.length <= MAX_CHARACTERS) {
          const parsed = JSON.parse(raw) as Saved
          if (parsed.version === 1 && parsed.owner === owner && parsed.expires > this.now() && Array.isArray(parsed.items) && parsed.histories && typeof parsed.histories === 'object' && !Array.isArray(parsed.histories)) saved = parsed
        }
      } catch { /* A damaged cache is discarded; never prevent authentication. */ }
      if (epoch !== this.epoch) return
      if (!saved) await this.storage.clear()
      this.data = saved ?? { version: 1, owner, expires: Math.min(sessionExpiry, this.now() + MAX_AGE), items: [], histories: {} }
      this.data.expires = Math.min(this.data.expires, sessionExpiry, this.now() + MAX_AGE)
    }).catch(() => { if (epoch === this.epoch) this.data = null })
    return this.ready
  }
  private valid() {
    if (!this.data || !this.owner || this.data.owner !== this.owner) return false
    if (this.data.expires <= this.now()) {
      this.data = null; this.cancel(); void this.serial(() => this.storage.clear()).catch(() => {}); return false
    }
    return true
  }
  async get(id: string): Promise<CachedHistory | null> {
    await this.ready
    if (!this.valid() || this.lockedIds.has(id)) return null
    const value = Object.hasOwn(this.data!.histories, id) ? this.data!.histories[id] : null
    if (!value || !value.detail || value.detail.id !== id || locked(value.detail) || value.detail.left || !Array.isArray(value.window?.messages) || !Number.isFinite(value.window.visibleFrom)) return null
    const result = clone(value)
    result.window.messages = result.window.messages.filter(m => m && typeof m.id === 'string' && typeof m.body === 'string' && m.conversation === id && Number.isFinite(m.seq) && m.seq >= result.window.visibleFrom && visible(m, this.now()))
    return result
  }
  put(id: string, value: CachedHistory, generation = this.revision): void {
    if (generation !== this.revision) return
    if (!this.data && this.owner) { const epoch = this.epoch; void this.ready.then(() => { if (epoch === this.epoch && this.data) this.put(id, value, generation) }); return }
    if (!this.valid() || value.detail.id !== id || this.lockedIds.has(id)) return
    if (locked(value.detail) || value.detail.left) { this.remove(id); return }
    const copy = clone(value)
    const messages = copy.window.messages.filter(m => m.conversation === id && m.seq >= copy.window.visibleFrom && visible(m, this.now()))
    copy.window.messages = messages.slice(-MAX_MESSAGES)
    copy.window.hasMoreBefore ||= messages.length > MAX_MESSAGES
    delete this.data!.histories[id]
    this.data!.histories[id] = copy
    this.trim(); this.persist()
  }
  remove(id: string): void {
    if (!this.data && this.owner) { const epoch = this.epoch; void this.ready.then(() => { if (epoch === this.epoch && this.data) this.remove(id) }); return }
    if (!this.data || (!Object.hasOwn(this.data.histories, id) && !this.data.items.some(item => item.id === id))) return
    delete this.data.histories[id]
    this.data.items = this.data.items.filter(item => item.id !== id)
    this.persist()
  }
  /** Session-level listener: locked chats must be evicted even when no chat screen is mounted. */
  event = (frame: Frame): void => {
    if (!this.owner) return
    if (frame.type === 'RESYNC') {
      this.revision++
      const epoch = this.epoch
      const clear = () => { if (epoch === this.epoch && this.data) { this.data.histories = {}; this.data.items = []; this.persist() } }
      if (this.data) clear(); else void this.ready.then(clear)
      return
    }
    if (frame.type !== 'CONVERSATION_SETTINGS') return
    const data = frame.data as { conversation?: unknown; id?: unknown; locked?: unknown } | null
    const id = typeof data?.conversation === 'string' ? data.conversation : data?.id
    if (typeof id !== 'string' || typeof data?.locked !== 'boolean') return
    if (data.locked) { this.lockedIds.add(id); this.remove(id) }
    else this.lockedIds.delete(id)
  }
  async list(): Promise<ConversationItem[]> {
    await this.ready
    return this.valid() ? clone(this.data!.items.filter(item => !locked(item) && !item.left && !this.lockedIds.has(item.id))) : []
  }
  rememberList(items: ConversationItem[], generation = this.revision): void {
    if (generation !== this.revision) return
    if (!this.data && this.owner) { const epoch = this.epoch; void this.ready.then(() => { if (epoch === this.epoch && this.data) this.rememberList(items, generation) }); return }
    if (!this.valid()) return
    // Offline list previews deliberately omit message text; disappearing/deleted
    // preview expiry metadata is not part of the current list API contract.
    this.data!.items = clone(items.filter(item => !locked(item) && !item.left && !this.lockedIds.has(item.id)).slice(0, 100).map(item => ({ ...item, last_message: null })))
    for (const item of items) if (locked(item) || item.left) delete this.data!.histories[item.id]
    this.trim(); this.persist()
  }
  private trim() {
    if (!this.data) return
    while (Object.keys(this.data.histories).length > MAX_CHATS) delete this.data.histories[Object.keys(this.data.histories)[0]]
    while (JSON.stringify(this.data).length > MAX_CHARACTERS && Object.keys(this.data.histories).length) delete this.data.histories[Object.keys(this.data.histories)[0]]
    while (JSON.stringify(this.data).length > MAX_CHARACTERS && this.data.items.length) this.data.items.pop()
  }
  async flush(): Promise<void> {
    this.cancel(); await this.ready
    const epoch = this.epoch
    await this.serial(async () => { if (epoch === this.epoch && this.valid()) await this.storage.write(JSON.stringify(this.data)) })
  }
}
