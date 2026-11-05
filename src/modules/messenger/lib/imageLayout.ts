/** Stable preview dimensions, independent of the original photo aspect ratio. */
export function chatImageLayout(viewportWidth: number, count: number) {
  const width = Math.min(300, Math.floor((viewportWidth - 24) * 0.8) - 24)
  return { width, box: { width: count > 1 ? Math.floor((width - 4) / 2) : width, height: count > 1 ? 160 : 260 } }
}
