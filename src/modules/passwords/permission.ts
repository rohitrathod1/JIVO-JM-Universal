import type { EntryDetail } from './api'
export async function requireEntryPermission(load: () => Promise<EntryDetail>, permission: 'share' | 'revoke' | 'move') {
  const current = await load()
  if (!current.can[permission]) throw new Error('This action is no longer permitted. Close and reopen the entry to refresh access.')
}
