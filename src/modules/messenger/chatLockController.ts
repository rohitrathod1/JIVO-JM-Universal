import type { ConversationDetail } from './api'

export const CHAT_LOCK_BACKGROUND_MS = 5 * 60_000
export interface ChatLockState { unlocked: boolean; busy: boolean; error: string }
interface Dependencies {
  verify: (signal: AbortSignal) => Promise<void>
  update: (id: string, locked: boolean, signal: AbortSignal) => Promise<ConversationDetail>
  message: (error: unknown) => string
  now?: () => number
}

/** An account-bound, memory-only display gate; the backend still authorizes every request. */
export class ChatLockController {
  private state: ChatLockState = { unlocked: false, busy: false, error: '' }
  private owner: string | null = null
  private epoch = 0
  private foreground = true
  private hiddenAt: number | null = null
  private flight: AbortController | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<() => void>()
  constructor(private readonly deps: Dependencies) {}
  snapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private now() { return this.deps.now?.() ?? Date.now() }
  private publish(value: Partial<ChatLockState>) {
    const next = { ...this.state, ...value }
    if (next.unlocked === this.state.unlocked && next.busy === this.state.busy && next.error === this.state.error) return
    this.state = next; this.listeners.forEach(listener => listener())
  }
  private cancelTimer() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null }
  private cancelAttempt() { this.epoch++; this.flight?.abort(); this.flight = null }
  bind = (owner: string | null) => {
    if (owner !== null && owner === this.owner) return
    this.owner = owner; this.cancelTimer(); this.cancelAttempt(); this.hiddenAt = null
    this.publish({ unlocked: false, busy: false, error: '' })
  }
  relock = () => {
    this.cancelTimer(); this.cancelAttempt()
    this.publish({ unlocked: false, busy: false, error: '' })
  }
  visibility = (foreground: boolean) => {
    this.foreground = foreground
    if (!foreground) {
      // Duplicate native/background events must not restart the five-minute clock.
      if (this.hiddenAt === null) {
        this.hiddenAt = this.now()
        this.cancelTimer()
        this.timer = setTimeout(() => { this.timer = null; if (!this.foreground) this.relock() }, CHAT_LOCK_BACKGROUND_MS)
      }
      this.cancelAttempt(); this.publish({ busy: false })
      return
    }
    this.cancelTimer()
    if (this.hiddenAt !== null && (this.now() - this.hiddenAt >= CHAT_LOCK_BACKGROUND_MS || this.now() < this.hiddenAt)) this.relock()
    this.hiddenAt = null
  }
  private async run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    if (!this.owner || !this.foreground || this.state.busy) return null
    const epoch = ++this.epoch; const owner = this.owner; const controller = new AbortController()
    this.flight = controller; this.publish({ busy: true, error: '' })
    try {
      const result = await work(controller.signal)
      if (epoch !== this.epoch || owner !== this.owner || !this.foreground || controller.signal.aborted) return null
      this.publish({ unlocked: true, busy: false, error: '' })
      return result
    } catch (error) {
      if (epoch === this.epoch && !controller.signal.aborted) this.publish({ busy: false, error: this.deps.message(error) })
      return null
    } finally { if (this.flight === controller) { this.flight = null; this.publish({ busy: false }) } }
  }
  unlock = async (): Promise<boolean> => {
    if (this.state.unlocked && this.owner && this.foreground) return true
    return await this.run(async signal => { await this.deps.verify(signal); return true }) === true
  }
  setLocked = (id: string, locked: boolean): Promise<ConversationDetail | null> => this.run(signal => this.deps.update(id, locked, signal))
}
