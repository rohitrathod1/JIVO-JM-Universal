/** Capped backoff for an unreachable session restore: 3s, 6s, 12s, 24s, then 30s. */
export const restoreDelay = (attempts: number) => Math.min(30_000, 3_000 * 2 ** Math.min(4, Math.max(0, attempts)))

export interface UnreachableWatch {
  /** subscribeLifecycle: reports foreground && online, synchronously once and then on every change. */
  subscribe: (handler: (active: boolean) => void) => () => void
  /** Called at most once per watch; 'timer' means the backoff elapsed while the device looked usable. */
  restore: (reason: 'online' | 'timer') => void
  attempts: number
  schedule?: (run: () => void, ms: number) => unknown
  cancel?: (timer: unknown) => void
}

/**
 * OFF-01: a cold start offline leaves the session 'unreachable'. Recover without a Retry tap as soon as the
 * browser 'online' event, an expo-network change or the app returning to the foreground reports the device
 * usable again, and otherwise on a capped backoff (the server may be down while the device is online).
 * The initial lifecycle report is a state, not a transition, so it never triggers a restore by itself.
 */
export function watchUnreachable({ subscribe, restore, attempts, schedule = (run, ms) => setTimeout(run, ms), cancel = timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }: UnreachableWatch) {
  let active: boolean | null = null
  let done = false
  let timer: unknown = null
  let off: (() => void) | null = null
  const stop = () => { done = true; off?.(); off = null; if (timer !== null) cancel(timer); timer = null }
  const fire = (reason: 'online' | 'timer') => { if (done) return; stop(); restore(reason) }
  const arm = () => { timer = schedule(() => { timer = null; if (done) return; if (active === false) arm(); else fire('timer') }, restoreDelay(attempts)) }
  const unsubscribe = subscribe(next => { const was = active; active = next; if (was === false && next) fire('online') })
  if (done) unsubscribe(); else { off = unsubscribe; arm() }
  return stop
}
