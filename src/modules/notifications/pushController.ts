export type PushSupport = 'supported' | 'unsupported' | 'ios-install' | 'denied'
export interface PushState { owner: string | null; enabled: boolean; busy: boolean; error: string | null; support: PushSupport }
export interface PushDependencies {
  support(): PushSupport
  permission(): string
  requestPermission(): Promise<string>
  wants(owner: string): boolean
  remember(owner: string, enabled: boolean): void
  lock<T>(work: () => Promise<T>): Promise<T>
  prepare(owner: string): Promise<void>
  connect(owner: string, current: () => boolean): Promise<void>
  disconnect(owner: string): Promise<void>
  test(owner: string): Promise<number>
  message(error: unknown): string
}

/** Account epochs invalidate permission prompts and network completions at every session boundary. */
export class PushController {
  private state: PushState
  private epoch = 0
  private listeners = new Set<() => void>()
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private readonly deps: PushDependencies) { this.state = { owner: null, enabled: false, busy: false, error: null, support: deps.support() } }
  snapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<PushState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()) }
  private serial<T>(work: () => Promise<T>): Promise<T> { const run = this.queue.catch(() => {}).then(() => this.deps.lock(work)); this.queue = run; return run }
  bind = (owner: string | null): Promise<void> => {
    if (this.state.owner === owner) return Promise.resolve()
    const previous = this.state.owner; const epoch = ++this.epoch
    this.update({ owner, enabled: false, busy: false, error: null, support: this.deps.support() })
    return this.serial(async () => {
      if (previous) await this.deps.disconnect(previous)
      if (owner && epoch === this.epoch) await this.deps.prepare(owner)
    }).catch(error => { if (epoch === this.epoch) this.update({ error: this.deps.message(error) }) })
  }
  private async register(epoch: number, owner: string) {
    const current = () => epoch === this.epoch && this.state.owner === owner
    await this.serial(async () => {
      if (!current()) return
      await this.deps.prepare(owner)
      if (!current()) return
      try { await this.deps.connect(owner, current) }
      catch (error) { await this.deps.disconnect(owner).catch(() => {}); throw error }
      if (!current()) { await this.deps.disconnect(owner); return }
      this.deps.remember(owner, true)
      this.update({ enabled: true, error: null })
    })
  }
  enable = async (): Promise<void> => {
    const { owner } = this.state; if (!owner || this.state.busy) return
    const epoch = this.epoch
    this.update({ busy: true, error: null, support: this.deps.support() })
    try {
      if (this.deps.support() !== 'supported') throw Error('Push notifications are unavailable or blocked in this browser.')
      // This is called synchronously from the Enable button, before any asynchronous lock/network work.
      const permission = await this.deps.requestPermission()
      if (epoch !== this.epoch) return
      if (permission !== 'granted') throw Error('Notifications were not enabled. Check this browser’s site notification settings.')
      await this.register(epoch, owner)
    } catch (error) { if (epoch === this.epoch) this.update({ error: this.deps.message(error) }) }
    finally { if (epoch === this.epoch) this.update({ busy: false, support: this.deps.support() }) }
  }
  sync = async (): Promise<void> => {
    const { owner } = this.state; if (!owner || this.state.busy) return
    this.update({ support: this.deps.support() })
    if (this.deps.support() !== 'supported' || this.deps.permission() !== 'granted' || !this.deps.wants(owner)) { this.update({ enabled: false }); return }
    const epoch = this.epoch; this.update({ busy: true, error: null })
    try { await this.register(epoch, owner) }
    catch (error) { if (epoch === this.epoch) this.update({ error: this.deps.message(error) }) }
    finally { if (epoch === this.epoch) this.update({ busy: false }) }
  }
  disable = async (): Promise<void> => {
    const { owner } = this.state; if (!owner) return
    const epoch = ++this.epoch
    this.deps.remember(owner, false); this.update({ enabled: false, busy: true, error: null })
    try { await this.serial(() => this.deps.disconnect(owner)) }
    catch (error) { if (epoch === this.epoch) this.update({ error: this.deps.message(error) }) }
    finally { if (epoch === this.epoch) this.update({ busy: false }) }
  }
  test = async (): Promise<number | null> => {
    const { owner } = this.state; if (!owner || !this.state.enabled || this.state.busy) return null
    const epoch = this.epoch; this.update({ busy: true, error: null })
    try { return await this.serial(async () => epoch === this.epoch ? this.deps.test(owner) : null) }
    catch (error) { if (epoch === this.epoch) this.update({ error: this.deps.message(error) }); return null }
    finally { if (epoch === this.epoch) this.update({ busy: false }) }
  }
}
