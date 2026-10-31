/**
 * Capability keys, exactly as the backend returns them in /me. Hiding UI is a convenience only:
 * every endpoint checks the same capability on the server.
 */
export const CAPABILITIES = [
  'JM_ACCESS',
  'JM_SEND_MESSAGE',
  'JM_SEND_FILE',
  'JM_CREATE_GROUP',
  'JM_MANAGE_GROUP',
  'JM_MANAGE_MEMBERS',
  'JM_DELETE_MESSAGE',
  'JM_MANAGE_MESSAGES',
  'JM_SEND_ALERT',
  'JP_ACCESS',
  'JP_CREATE_PASSWORD',
  'JP_VIEW_PASSWORD',
  'JP_UPDATE_PASSWORD',
  'JP_DELETE_PASSWORD',
  'JP_SHARE_PASSWORD',
  'JP_REVOKE_PASSWORD',
  'JP_MANAGE_VAULT',
  'JP_BREAK_GLASS',
  'JP_REQUEST_EMERGENCY',
  'ADMIN_USERS',
  'ADMIN_AUDIT',
] as const

export type Capability = (typeof CAPABILITIES)[number]

/** One capability, or a list of which any one is enough. */
export type CapabilityRule = Capability | readonly Capability[]

export const ADMIN_ACCESS: readonly Capability[] = ['ADMIN_USERS', 'ADMIN_AUDIT']

export function allows(held: readonly string[], rule: CapabilityRule | undefined): boolean {
  if (!rule) return true
  return typeof rule === 'string' ? held.includes(rule) : rule.some((c) => held.includes(c))
}
