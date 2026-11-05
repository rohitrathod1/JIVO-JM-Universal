import { isAxiosError, isCancel } from 'axios'

/** OFF-05: what a reaction or edit shows when it could not reach the server. Reactions and edits are not queued. */
export const OFFLINE_ACTION = "You're offline, try again when connected."

const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** The message for a failed message action: the offline line for a lost connection, otherwise the server's own. */
export function actionFailure(error: unknown, message: (error: unknown) => string, offline: () => boolean = browserOffline): string {
  if (isCancel(error)) return message(error)
  if (offline() || (isAxiosError(error) && !error.response)) return OFFLINE_ACTION
  return message(error)
}
