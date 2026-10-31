export function subscribeLifecycle(handler: (active: boolean) => void) {
  if (typeof document === 'undefined') return () => {}
  const update = () => handler(document.visibilityState === 'visible' && navigator.onLine)
  document.addEventListener('visibilitychange', update)
  window.addEventListener('online', update); window.addEventListener('offline', update)
  update()
  return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('online', update); window.removeEventListener('offline', update) }
}
