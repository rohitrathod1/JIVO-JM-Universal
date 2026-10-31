/**
 * Keeping the reader's place when older messages are inserted above.
 *
 * Before the insert we know scrollTop and scrollHeight; after it the content above grew by exactly
 * (newHeight - oldHeight), so moving scrollTop by the same amount keeps every visible message where it
 * was. Run in a layout effect (before paint) so the jump is never visible. Image rows reserve their final
 * size from the stored width/height, so later image loads don't shift anything.
 */
export function preservedScrollTop(prevScrollTop: number, prevScrollHeight: number, newScrollHeight: number): number {
  return Math.max(0, prevScrollTop + (newScrollHeight - prevScrollHeight))
}

/** "At the bottom" for auto-scroll and read receipts (a small tolerance for rounding). */
export function isNearBottom(el: { scrollTop: number; scrollHeight: number; clientHeight: number }, tolerance = 120): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance
}

/** The box an image attachment reserves before it loads (max 280×320, keeps aspect ratio). */
export function imageBox(width: number | null, height: number | null, maxW = 280, maxH = 320): { width: number; height: number } {
  if (!width || !height) return { width: maxW, height: Math.round(maxW * 0.75) }
  const scale = Math.min(maxW / width, maxH / height, 1)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
