// Screen-capture privacy for sensitive native views (vault secrets, the app-lock cover).
// "capture" blocks screenshots/recordings (Android FLAG_SECURE also blanks the recents
// thumbnail); "switcher" blurs the iOS app-switcher snapshot. Holders are reference counted
// and native calls are serialised so a fast reveal/hide cannot leave capture re-enabled
// while another holder still needs it.
export type CaptureLevel = 'capture' | 'switcher'
export type ScreenCaptureDeps = { prevent: () => Promise<void>; allow: () => Promise<void>; protectSwitcher: () => Promise<void>; unprotectSwitcher: () => Promise<void> }

export class ScreenCaptureGuard {
  private holders = new Map<number, CaptureLevel>(); private next = 0
  private applied = { capture: false, switcher: false }; private queue: Promise<void> = Promise.resolve()
  constructor(private deps: ScreenCaptureDeps) {}
  acquire(level: CaptureLevel): () => void {
    const id = ++this.next; this.holders.set(id, level); this.sync()
    return () => { if (this.holders.delete(id)) this.sync() }
  }
  /** Resolves once every queued native call has settled (used by tests and unmount). */
  settled() { return this.queue }
  private wanted() { const levels = [...this.holders.values()]; const capture = levels.includes('capture'); return { capture, switcher: capture || levels.includes('switcher') } }
  private sync() {
    this.queue = this.queue.then(async () => {
      const want = this.wanted()
      if (want.capture !== this.applied.capture) { try { await (want.capture ? this.deps.prevent() : this.deps.allow()); this.applied.capture = want.capture } catch { /* unsupported device: nothing to undo */ } }
      if (want.switcher !== this.applied.switcher) { try { await (want.switcher ? this.deps.protectSwitcher() : this.deps.unprotectSwitcher()); this.applied.switcher = want.switcher } catch { /* Android/older iOS: FLAG_SECURE covers recents */ } }
    })
  }
}
