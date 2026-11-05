// Platform-neutral "clear the clipboard if it still holds our value" (reference Frontend
// clearClipboardSoon, plus an ownership check so a later copy from another app survives).
export type ClearDeps = {
  /** Current clipboard text, or undefined when it cannot be read without prompting the user. */
  read: () => Promise<string | undefined>
  write: (text: string) => Promise<void>
  /** Whether the app can touch the clipboard now (focused tab / foreground app). */
  canAccess: () => boolean
  /** Calls `fn` once when access returns; returns an unsubscribe. */
  onAccess: (fn: () => void) => () => void
}
export function clearClipboardIfUnchanged(deps: ClearDeps, value: string): Promise<void> {
  const run = async () => {
    let current: string | undefined
    try { current = await deps.read() } catch { current = undefined }
    if (current !== undefined && current !== value) return
    await deps.write('')
  }
  if (deps.canAccess()) return run()
  return new Promise<void>((resolve, reject) => { const off = deps.onAccess(() => { off(); run().then(resolve, reject) }) })
}
