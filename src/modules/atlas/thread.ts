import { mergeAsks, pollDelay, sendFailure, SLOW_POLL_MS, type Ask, type AskPage, type SendFailure } from './model'

export interface ThreadApi {
  list(before?: number): Promise<AskPage>
  create(text: string, replyTo: number | null): Promise<Ask>
  get(id: number): Promise<Ask>
}
export interface Clock {
  now(): number
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}
export const realClock: Clock = { now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) }

export interface ThreadSnapshot {
  asks: Ask[]
  hasMore: boolean
  /** A first page arrived in this session (cached asks alone do not count). */
  loaded: boolean
  loading: boolean
  loadingOlder: boolean
  /** Loading the list failed; cached asks stay visible. */
  error: string | null
  sending: boolean
  sendError: SendFailure | null
  /** Clock time before which a rate-limited send should not be retried. */
  retryAt: number | null
}
export interface ThreadCache { asks: Ask[]; hasMore: boolean }

/** Asks kept for the offline view; older ones are fetched again when needed. */
const CACHE_LIMIT = 200

/**
 * One person's Atlas thread: first page, older pages, sending and per-ask polling (2 s while open for the first
 * 3 min, then 30 s; with_person 30 s; terminal states stop). Polling pauses while the app is inactive or offline
 * and refreshes once when it becomes active again. Framework-free so it can be tested with fake timers.
 */
export class AtlasThread {
  private state: ThreadSnapshot
  private listeners = new Set<() => void>()
  private timers = new Map<number, unknown>()
  private polling = new Set<number>()
  /** Starts inactive: the first setActive(true) loads the first page and starts polling. */
  private active = false
  private disposed = false
  private sendBusy = false

  constructor(private api: ThreadApi, private clock: Clock = realClock, cached?: ThreadCache | null, private persist?: (value: ThreadCache) => void) {
    this.state = { asks: cached?.asks ?? [], hasMore: cached?.hasMore ?? false, loaded: false, loading: false, loadingOlder: false, error: null, sending: false, sendError: null, retryAt: null }
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.state

  private set(patch: Partial<ThreadSnapshot>) {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    if (patch.asks || patch.hasMore !== undefined) this.persist?.({ asks: this.state.asks.slice(0, CACHE_LIMIT), hasMore: this.state.hasMore || this.state.asks.length > CACHE_LIMIT })
    this.listeners.forEach(listener => listener())
  }

  /** Active = foreground and connected. Inactive stops every timer; becoming active reloads the first page. */
  setActive(active: boolean) {
    if (this.disposed || active === this.active) return
    this.active = active
    if (!active) { this.stopTimers(); return }
    void this.load()
  }

  async load() {
    if (this.disposed || this.state.loading) return
    this.set({ loading: true, error: null })
    try {
      const page = await this.api.list()
      // The first page replaces the cache (older pages load again on demand); only an ask sent while the page
      // was in flight, newer than anything in it, is kept.
      const newest = page.results[0]?.id
      const kept = newest === undefined ? [] : this.state.asks.filter(ask => ask.id > newest)
      this.set({ asks: mergeAsks(kept, page.results), hasMore: page.has_more, loaded: true, loading: false })
    } catch (error) {
      this.set({ loading: false, error: sendFailure(error).kind === 'network' ? 'Cannot reach JM. Showing saved questions.' : 'Could not load your Atlas questions.' })
    }
    this.schedule()
  }

  async loadOlder() {
    const oldest = this.state.asks.at(-1)?.id
    if (this.disposed || this.state.loadingOlder || !this.state.hasMore || oldest === undefined) return
    this.set({ loadingOlder: true, error: null })
    try {
      const page = await this.api.list(oldest)
      this.set({ asks: mergeAsks(this.state.asks, page.results), hasMore: page.has_more, loadingOlder: false })
      this.schedule()
    } catch {
      this.set({ loadingOlder: false, error: 'Could not load older questions.' })
    }
  }

  /** Resolves true when JM took the ask (the caller clears its draft); false keeps the draft for Retry. */
  async send(text: string, replyTo: number | null): Promise<boolean> {
    if (this.disposed || this.sendBusy) return false
    this.sendBusy = true
    this.set({ sending: true, sendError: null, retryAt: null })
    try {
      const ask = await this.api.create(text, replyTo)
      this.set({ asks: mergeAsks(this.state.asks, [ask]), sending: false })
      this.schedule()
      return true
    } catch (error) {
      const failure = sendFailure(error)
      this.set({ sending: false, sendError: failure, retryAt: failure.retryAfter ? this.clock.now() + failure.retryAfter * 1000 : null })
      return false
    } finally { this.sendBusy = false }
  }

  /** Ask a failed question again as a new ask (same text and follow-up). */
  retry(ask: Ask) { return this.send(ask.text, ask.reply_to) }
  clearSendError() { if (this.state.sendError) this.set({ sendError: null, retryAt: null }) }

  dispose() { this.disposed = true; this.stopTimers(); this.listeners.clear() }

  private stopTimers() { this.timers.forEach(handle => this.clock.clear(handle)); this.timers.clear() }

  /** One timer per open ask that is not already being fetched. */
  private schedule() {
    if (this.disposed || !this.active) return
    const now = this.clock.now()
    for (const ask of this.state.asks) {
      if (this.timers.has(ask.id) || this.polling.has(ask.id)) continue
      const delay = pollDelay(ask, now)
      if (delay !== null) this.timers.set(ask.id, this.clock.set(() => void this.poll(ask.id), delay))
    }
  }

  private async poll(id: number) {
    this.timers.delete(id)
    if (this.disposed || !this.active) return
    this.polling.add(id)
    let failed = false
    try {
      const ask = await this.api.get(id)
      this.set({ asks: mergeAsks(this.state.asks, [ask]) })
    } catch { failed = true } finally { this.polling.delete(id) }
    if (this.disposed || !this.active) return
    if (failed) {
      // Network or server trouble: try again slowly instead of every 2 s.
      const ask = this.state.asks.find(item => item.id === id)
      if (ask && pollDelay(ask, this.clock.now()) !== null && !this.timers.has(id)) this.timers.set(id, this.clock.set(() => void this.poll(id), SLOW_POLL_MS))
      return
    }
    this.schedule()
  }
}
