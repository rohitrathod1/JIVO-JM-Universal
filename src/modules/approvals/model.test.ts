import { describe, expect, it } from 'vitest'
import { allows } from '../../config/capabilities'
import { APPROVALS_ACCESS, appHref, badgeText, confirmCopy, doneMessage, emptyTitle, endpointFor, metaLine, resultLink, rowsFor, statusFor, statusTone, type ApprovalItem } from './model'

const item = (patch: Partial<ApprovalItem> = {}): ApprovalItem => ({
  kind: 'vault_owner', id: 'r1', title: 'Make Otto an owner', subject: 'IT Shared', reason: 'cover', status: 'pending',
  requested_by: { id: 'u1', name: 'Pia Admin' }, requested_at: '2026-11-02T05:00:00Z', expires_at: null, decided_by: null, decided_at: null,
  can: { decide: true, cancel: false },
  actions: { approve: '/api/jp/owner-requests/r1/approve/', deny: '/api/jp/owner-requests/r1/deny/', cancel: '/api/jp/owner-requests/r1/cancel/' },
  link: '/passwords/vaults/v1', ...patch,
})

describe('approvals inbox model', () => {
  it('splits tabs like the web inbox and reads pending for the first two', () => {
    const waiting = item(); const mine = item({ kind: 'admin', id: 'a1', can: { decide: false, cancel: true } }); const old = item({ id: 'o', status: 'approved', can: { decide: false, cancel: false } })
    expect(rowsFor([waiting, mine, old], 'waiting')).toEqual([waiting])
    expect(rowsFor([waiting, mine, old], 'mine')).toEqual([mine])
    expect(rowsFor([waiting, mine, old], 'all')).toHaveLength(3)
    expect([statusFor('waiting'), statusFor('mine'), statusFor('all')]).toEqual(['pending', 'pending', 'all'])
    expect(emptyTitle('waiting')).toBe('Nothing waiting on you.')
    expect(emptyTitle('mine')).toBe('You have no open requests.')
    expect(emptyTitle('all')).toBe('No requests yet.')
  })

  it('maps full action paths to the JM/JP transport and refuses anything else', () => {
    expect(endpointFor('/api/jp/owner-requests/r1/approve/')).toEqual({ base: 'jp', url: '/owner-requests/r1/approve/' })
    expect(endpointFor('/api/jm/admin/approvals/7/deny/')).toEqual({ base: 'jm', url: '/admin/approvals/7/deny/' })
    for (const bad of ['https://evil.test/api/jm/x/', '/api/other/x/', '/api/jm/../x/', '/api/jm//x/', '/api/jm/x%2f/', '/api/jm/x']) expect(endpointFor(bad)).toBeNull()
  })

  it('links each kind to its Universal page', () => {
    expect(appHref(item())).toBe('/passwords?vault=v1')
    expect(appHref(item({ kind: 'admin', link: '/admin/approvals' }))).toBe('/admin?tab=approvals')
    expect(appHref(item({ kind: 'emergency_access', link: '/passwords/break-glass' }))).toBe('/passwords?view=break-glass')
    expect(appHref(item({ link: '/elsewhere' }))).toBe('/passwords')
  })

  it('formats badge, meta, tone and confirmation copy', () => {
    expect([badgeText(0), badgeText(undefined), badgeText(3), badgeText(120)]).toEqual(['', '', '3', '99+'])
    expect(metaLine(item({ expires_at: '2026-11-03T00:00:00Z' }), v => v.slice(0, 10))).toBe('Asked by Pia Admin · 2026-11-02 · expires 2026-11-03')
    expect(metaLine(item({ status: 'denied', requested_by: null, decided_by: { id: 'u2', name: 'Bo' } }), () => 'T')).toBe('Asked by someone · T · denied by Bo')
    expect([statusTone('pending'), statusTone('active'), statusTone('denied'), statusTone('expired')]).toEqual(['warning', 'success', 'danger', 'neutral'])
    expect(confirmCopy(item(), 'approve')).toMatchObject({ title: 'Approve: Make Otto an owner?', label: 'Approve' })
    expect(confirmCopy(item(), 'deny')).toMatchObject({ title: 'Deny this request?', label: 'Deny' })
    expect([doneMessage('approve'), doneMessage('deny'), doneMessage('cancel')]).toEqual(['Approved', 'Denied', 'Request withdrawn'])
    expect([resultLink({ result: { link: 'L' } }), resultLink({ link: 'M' }), resultLink(null), resultLink({ result: { link: 5 } })]).toEqual(['L', 'M', '', ''])
  })

  it('gates the navigation entry like the web registry', () => {
    expect(allows([], APPROVALS_ACCESS)).toBe(false)
    expect(allows(['JP_ACCESS'], APPROVALS_ACCESS)).toBe(true)
    expect(allows(['ADMIN_USERS'], APPROVALS_ACCESS)).toBe(true)
  })
})
