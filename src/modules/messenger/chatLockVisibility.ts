/** Visibility only: network loss must not be treated as backgrounding. */
export function subscribeChatLockVisibility(listener: (foreground: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const update = () => listener(document.visibilityState === 'visible')
  document.addEventListener('visibilitychange', update); update()
  return () => document.removeEventListener('visibilitychange', update)
}
