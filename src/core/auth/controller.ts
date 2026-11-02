import type { Me } from './types'
import type { LoginResponse } from './security'
export type SessionState = { status: 'loading' | 'signing-out' | 'anonymous' | 'ready' | 'unreachable'; me: Me | null; error?: string }
export interface SessionDependencies {
  enabled: boolean; csrf: () => Promise<unknown>; me: () => Promise<Me>
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<unknown>; clear: () => Promise<unknown>
  unauthorized: (error: unknown) => boolean; message: (error: unknown) => string
  boundary?: (preserveOutbox: boolean) => void
  now?: () => number
}
export class SessionController {
  private state: SessionState = { status: 'loading', me: null }
  private listeners = new Set<() => void>()
  private generation = 0
  private signingOut: Promise<void> | null = null
  private cleanup: Promise<unknown> = Promise.resolve()
  private expiryTimer: ReturnType<typeof setTimeout> | null = null
  constructor(private readonly deps: SessionDependencies) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private now() { return this.deps.now?.() ?? Date.now() }
  private expiry(me: Me | null): number | null { return me?.session ? Date.parse(me.session.expires_at) : null }
  private cancelExpiry() { if (this.expiryTimer !== null) clearTimeout(this.expiryTimer); this.expiryTimer = null }
  private scheduleExpiry() {
    this.cancelExpiry()
    const expiry = this.expiry(this.state.me)
    if (this.state.status !== 'ready' || expiry === null) return
    // Recheck wall-clock changes, and never exceed the platform timeout range.
    this.expiryTimer = setTimeout(() => { this.expiryTimer = null; this.checkExpiry() }, Math.max(0, Math.min(60_000, expiry - this.now())))
    // Node-based tests/tooling must not be kept alive by a UI lifecycle timer.
    const timer = this.expiryTimer as ReturnType<typeof setTimeout> & { unref?: () => void }
    timer.unref?.()
  }
  private publish(state: SessionState) { this.cancelExpiry(); this.state = state; this.scheduleExpiry(); this.listeners.forEach(fn => fn()) }
  private accept(me: Me) {
    const expiry = this.expiry(me)
    if (expiry !== null && (!Number.isFinite(expiry) || expiry <= this.now())) { this.lose(); return }
    this.publish({ status: 'ready', me })
  }
  /** Call on foreground too: mobile/hidden-tab timers may have been suspended. */
  checkExpiry = (): boolean => {
    if (this.state.status !== 'ready') return false
    const expiry = this.expiry(this.state.me)
    if (expiry !== null && (!Number.isFinite(expiry) || expiry <= this.now())) { this.lose(); return false }
    this.scheduleExpiry()
    return true
  }
  /** Provider cleanup; a subsequent restore can reuse the controller in StrictMode. */
  dispose = () => { this.generation++; this.cancelExpiry() }
  private advance(preserveOutbox = false) { this.cancelExpiry(); this.deps.boundary?.(preserveOutbox); return ++this.generation }
  lose = () => {
    if (this.signingOut) return
    this.advance(); this.publish({ status: 'anonymous', me: null })
    this.cleanup = this.cleanup.catch(() => undefined).then(() => this.deps.clear())
    void this.cleanup.catch(() => undefined)
  }
  async restore() {
    if (this.signingOut) return
    const generation = this.advance(true)
    if (!this.deps.enabled) { this.publish({ status: 'anonymous', me: null }); return }
    this.publish({ status: 'loading', me: null })
    try {
      await this.cleanup
      await this.deps.csrf()
      const me = await this.deps.me()
      if (generation === this.generation) this.accept(me)
    } catch (error) {
      if (generation !== this.generation) return
      if (this.deps.unauthorized(error)) this.lose()
      else this.publish({ status: 'unreachable', me: null, error: this.deps.message(error) })
    }
  }
  async adopt() {
    const generation = this.generation
    const me = await this.deps.me()
    if (generation === this.generation && !this.signingOut) this.accept(me)
  }
  async login(email: string, password: string) {
    // New authentication must not race a previous session's cookie cleanup.
    await this.signingOut?.catch(() => undefined)
    await this.cleanup
    const generation = this.advance()
    await this.deps.csrf()
    if (generation !== this.generation) throw new Error('Sign-in was cancelled.')
    const result = await this.deps.login(email, password)
    if (generation !== this.generation) throw new Error('Sign-in was cancelled.')
    if (result.status === 'ok') await this.adopt()
    return result
  }
  logout(): Promise<void> {
    if (this.signingOut) return this.signingOut
    const generation = this.advance()
    this.publish({ status: 'signing-out', me: null })
    const pending = (async () => {
      let failure: unknown
      try { await this.deps.logout() } catch (error) { failure = error }
      this.cleanup = this.cleanup.catch(() => undefined).then(() => this.deps.clear())
      try { await this.cleanup } catch (error) { failure ??= error }
      if (generation === this.generation) this.publish({ status: 'anonymous', me: null, ...(failure ? { error: 'Signed out locally. Server revocation or device-cookie cleanup could not be confirmed. Retry when connected.' } : {}) })
      if (failure) throw failure
    })()
    this.signingOut = pending
    void pending.finally(() => { if (this.signingOut === pending) this.signingOut = null }).catch(() => undefined)
    return pending
  }
}
