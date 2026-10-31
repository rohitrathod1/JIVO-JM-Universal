export function subscribeSensitiveView(handler: (active: boolean) => void) {
  if (typeof document === 'undefined') return () => {}
  const update = () => handler(document.visibilityState === 'visible' && document.hasFocus())
  const blur = () => handler(false)
  document.addEventListener('visibilitychange', update)
  window.addEventListener('focus', update); window.addEventListener('blur', blur)
  update()
  return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); window.removeEventListener('blur', blur) }
}
