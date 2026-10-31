import type { Me } from './types'
import type { LoginResponse } from './security'
export type SessionState = { status: 'loading' | 'signing-out' | 'anonymous' | 'ready' | 'unreachable'; me: Me | null; error?: string }
export interface SessionDependencies {
  enabled: boolean; csrf: () => Promise<unknown>; me: () => Promise<Me>
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<unknown>; clear: () => Promise<unknown>
  unauthorized: (error: unknown) => boolean; message: (error: unknown) => string
  boundary?: (preserveOutbox: boolean) => void
}
export class SessionController {
  private state: SessionState = { status: 'loading', me: null }
  private listeners = new Set<() => void>()
  private generation = 0
  private signingOut: Promise<void> | null = null
  private cleanup: Promise<unknown> = Promise.resolve()
  constructor(private readonly deps: SessionDependencies) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(state: SessionState) { this.state = state; this.listeners.forEach(fn => fn()) }
  private advance(preserveOutbox = false) { this.deps.boundary?.(preserveOutbox); return ++this.generation }
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
      if (generation === this.generation) this.publish({ status: 'ready', me })
    } catch (error) {
      if (generation !== this.generation) return
      this.publish(this.deps.unauthorized(error) ? { status: 'anonymous', me: null } : { status: 'unreachable', me: null, error: this.deps.message(error) })
    }
  }
  async adopt() {
    const generation = this.generation
    const me = await this.deps.me()
    if (generation === this.generation && !this.signingOut) this.publish({ status: 'ready', me })
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
