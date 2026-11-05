import type { AtlasStatus } from './model'
import type { ThreadCache } from './thread'

/** `failed`: the last status request did not succeed (offline, or the server has no Atlas yet). */
export interface StatusEntry { value: AtlasStatus | null; at: number; loading: boolean; failed: boolean }
const EMPTY: StatusEntry = { value: null, at: 0, loading: false, failed: false }

/**
 * Memory-only caches for one signed-in person (U-004: no authenticated history in browser storage). The thread
 * cache lets the Atlas screen show earlier questions offline or when reopened; the status cache keeps the
 * Messenger button from asking the server on every render. Both are dropped on sign-out / account change.
 */
export class AtlasStore {
  private owner: string | null = null
  private thread: ThreadCache | null = null
  private status: StatusEntry = EMPTY
  private listeners = new Set<() => void>()

  constructor(private fetchStatus: () => Promise<AtlasStatus>, private now: () => number = Date.now, private ttl = 60_000) {}

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private emit() { this.listeners.forEach(listener => listener()) }
  private setStatus(next: StatusEntry) { this.status = next; this.emit() }

  /** Switch the cache to this person; a different person (or null) drops everything held for the previous one. */
  bind(user: string | null) {
    if (user === this.owner) return
    this.owner = user; this.thread = null
    this.setStatus(EMPTY)
  }
  clear() { this.bind(null) }

  readThread(user: string) { return user === this.owner ? this.thread : null }
  saveThread(user: string, value: ThreadCache) { if (user === this.owner) this.thread = value }

  /** Stable snapshot for useSyncExternalStore. */
  statusEntry = () => this.status

  /** Fetch the status when it is missing or older than the TTL. A failure keeps the last known value. */
  async refreshStatus(user: string, force = false) {
    if (user !== this.owner) this.bind(user)
    const current = this.status
    if (current.loading || (!force && current.value && this.now() - current.at < this.ttl)) return
    const pending: StatusEntry = { ...current, loading: true }
    this.setStatus(pending)
    try {
      const value = await this.fetchStatus()
      if (this.owner !== user || this.status !== pending) return
      this.setStatus({ value: { enabled: !!value?.enabled, allowed: !!value?.allowed, message: typeof value?.message === 'string' && value.message.trim() ? value.message.trim() : null }, at: this.now(), loading: false, failed: false })
    } catch {
      if (this.owner === user && this.status === pending) this.setStatus({ ...pending, loading: false, failed: true })
    }
  }
}
