import { expect, it, vi } from 'vitest'
import { customSecretFields } from './secretInput'
import { requireEntryPermission } from './permission'
import type { EntryDetail } from './api'
it('omits blank custom values and only deletes explicitly selected fields', () => {
 expect(customSecretFields([{ name: 'PIN', value: '' }])).toBeUndefined()
 expect(customSecretFields([{ name: ' PIN ', value: '1234' }, { name: 'unchanged', value: '' }], ['obsolete'])).toEqual({ PIN: '1234', obsolete: null })
})
it.each(['share', 'revoke', 'move'] as const)('rechecks %s permission before a mutation', async permission => {
 const mutate = vi.fn(); const load = async () => ({ can: { [permission]: false } }) as unknown as EntryDetail
 await expect(requireEntryPermission(load, permission).then(mutate)).rejects.toThrow('no longer permitted'); expect(mutate).not.toHaveBeenCalled()
})
