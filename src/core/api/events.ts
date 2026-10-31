const listeners = new Set<() => void>()
export function onSessionLost(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
export function sessionLost() { listeners.forEach(fn => fn()) }
