const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')))}
edit('src/components/ConversationWorkspace.tsx',s=>s.replace('source?.conversation === selection?.id','source && source.conversation === selection?.id').replace('nearBottom.current = contentSize.height', 'if (contentSize.height - layoutMeasurement.height - contentOffset.y >= 96) followIncoming.current = false; nearBottom.current = contentSize.height'));
edit('src/modules/messenger/lib/window.ts',s=>s.replace('if (state.hasMoreAfter && message.seq > newest) return state // not in the loaded slice','if (state.hasMoreAfter && message.seq > newest) return { ...state, lastSeq: Math.max(state.lastSeq, message.seq) } // retain history while indicating arrivals'));
fs.writeFileSync('src/modules/passwords/permission.ts',`import type { EntryDetail } from './api'
export async function requireEntryPermission(load: () => Promise<EntryDetail>, permission: 'share' | 'revoke' | 'move') {
  const current = await load()
  if (!current.can[permission]) throw new Error('This action is no longer permitted. Close and reopen the entry to refresh access.')
}
`);
edit('src/components/VaultTools.tsx',s=>{s="import { requireEntryPermission } from '../modules/passwords/permission'\n"+s;for(const [api,cap]of [['shareEntry','share'],['revokeShare','revoke'],['moveEntry','move']])s=s.replace('await vault.'+api+'(',`await requireEntryPermission(() => vault.getEntry(entry.id), '${cap}'); await vault.${api}(`);return s;});
fs.writeFileSync('src/shared/sensitive.test.ts',`import { expect, it, vi } from 'vitest'
import { SensitiveRequestGuard } from './sensitive'
import { subscribeSensitiveView } from './sensitiveLifecycle.web'
it('discards a delayed secret after background and refocus, while allowing a new request', async () => {
  const guard = new SensitiveRequestGuard(); let resolve!: (value: string[]) => void
  const token = guard.begin(); const deferred = new Promise<string[]>(r => { resolve = r }); let shown: string[] = []
  const pending = deferred.then(value => { if (guard.accepts(token)) shown = value })
  guard.setActive(false); guard.setActive(true); resolve(['secret']); await pending; expect(shown).toEqual([])
  expect(guard.accepts(guard.begin())).toBe(true)
  const closed = guard.begin(); guard.clear(); expect(guard.accepts(closed)).toBe(false)
})
it('clears sensitive views on window blur without a visibility change and removes listeners', () => {
  const win = new EventTarget(); const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true })
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
  try { const states: boolean[] = []; const off = subscribeSensitiveView(active => states.push(active)); win.dispatchEvent(new Event('blur')); expect(states).toEqual([true, false]); win.dispatchEvent(new Event('focus')); expect(states.at(-1)).toBe(true); off(); win.dispatchEvent(new Event('blur')); expect(states).toHaveLength(3) } finally { vi.unstubAllGlobals() }
})
`);
fs.writeFileSync('src/modules/passwords/secretInput.test.ts',`import { expect, it, vi } from 'vitest'
import { customSecretFields } from './secretInput'
import { requireEntryPermission } from './permission'
import type { EntryDetail } from './api'
it('omits blank custom values and only deletes explicitly selected fields', () => {
 expect(customSecretFields([{ name: 'PIN', value: '' }])).toBeUndefined()
 expect(customSecretFields([{ name: ' PIN ', value: '1234' }, { name: 'unchanged', value: '' }], ['obsolete'])).toEqual({ PIN: '1234', obsolete: null })
})
it.each(['share', 'revoke', 'move'] as const)('rechecks %s permission before a mutation', async permission => {
 const mutate = vi.fn(); const load = async () => ({ can: { [permission]: false } }) as EntryDetail
 await expect(requireEntryPermission(load, permission).then(mutate)).rejects.toThrow('no longer permitted'); expect(mutate).not.toHaveBeenCalled()
})
`);
fs.appendFileSync('src/modules/messenger/history.test.ts',`
it('clears inaccessible history and rejects a late in-flight response', async () => {
 let deny = false; let resolve!: (value: MessageWindow) => void; let delay = false
 const c = new HistoryController({ detail: async () => { if (deny) throw { response: { status: 403, data: { code: 'forbidden' } } }; return { id: 'c' } as ConversationDetail }, read: async () => delay ? new Promise(r => { resolve = r }) : page([1, 2]), message: String })
 await c.select('c'); delay = true; const pending = c.latest(); deny = true; await c.refreshDetail()
 expect(c.snapshot().accessLost).toBe(true); expect(c.snapshot().detail).toBeNull(); expect(c.snapshot().window.messages).toEqual([])
 resolve(page([1, 2])); await pending; c.event({ type: 'MESSAGE_CREATED', data: msg(3) }); expect(c.snapshot().window.messages).toEqual([])
})
it.each([undefined, 500, 429])('preserves history on transient status %s', async status => {
 let fail = false; const c = new HistoryController({ detail: async () => { if (fail) throw { response: status ? { status } : undefined }; return { id: 'c' } as ConversationDetail }, read: async () => page([1]), message: String })
 await c.select('c'); fail = true; await c.refreshDetail(); expect(c.snapshot().accessLost).toBe(false); expect(c.snapshot().window.messages).toHaveLength(1)
})
it('keeps the older window and records incoming messages beyond it', async () => {
 const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read: async () => page([1, 2], { has_more_after: true, last_seq: 10 }), message: String })
 await c.select('c'); c.event({ type: 'MESSAGE_CREATED', data: msg(11) }); expect(c.snapshot().window.messages.map(m => m.seq)).toEqual([1, 2]); expect(c.snapshot().window.lastSeq).toBe(11)
})
`);
fs.writeFileSync('src/modules/messenger/reader.test.ts',`import { expect, it } from 'vitest'
import { arrivalBehavior } from './reader'
import { confirmedAccessLoss } from './access'
it('follows only readers near the live end and signals arrivals to readers of history', () => {
 expect(arrivalBehavior(true, false, 10, 11)).toBe('follow'); expect(arrivalBehavior(false, false, 10, 11)).toBe('indicate'); expect(arrivalBehavior(true, true, 10, 11)).toBe('indicate'); expect(arrivalBehavior(true, false, 10, 10)).toBe('none')
})
it('does not confuse a security challenge or server error with access revocation', () => {
 for (const code of ['step_up_required', 'csrf_failed']) expect(confirmedAccessLoss({ response: { status: 403, data: { code } } })).toBe(false)
 for (const status of [403, 404, 410]) expect(confirmedAccessLoss({ response: { status } })).toBe(true)
 expect(confirmedAccessLoss(new Error('offline'))).toBe(false)
})
`);
