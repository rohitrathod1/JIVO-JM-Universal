import { describe, expect, it } from 'vitest'
import type { Member } from './api'
import { dialablePeer, headerInfo, isEmptySystemNotice, memberWindow, moreMembersLabel, safeMailHref, sendModeNote } from './conversationInfo'
import { sharedTabs } from './sharedMedia'

const member = (i: number, company: string | null = null): Member => ({ user: { id: `u${i}`, name: `Person ${i}`, avatar_url: null, company, is_active: true }, role: 'member', can_send: true, joined_at: '', is_me: false })
const peer = { id: 'p1', name: 'Asha', avatar_url: null, company: 'JIVO', is_active: true }

describe('group info members', () => {
  const rows = Array.from({ length: 23 }, (_, i) => member(i + 1, i === 22 ? 'Acme' : null))
  it('shows the first 5, then 10 more at a time', () => {
    expect(memberWindow(rows, '', 5)).toMatchObject({ left: 18 })
    expect(memberWindow(rows, '', 5).visible).toHaveLength(5)
    expect(moreMembersLabel(18)).toBe('Show 10 more · 18 left')
    expect(memberWindow(rows, '', 15).left).toBe(8)
    expect(moreMembersLabel(8)).toBe('Show 8 more')
    expect(memberWindow(rows, '', 25)).toMatchObject({ left: 0 })
  })
  it('searches every member by name or company, without the 5-row limit', () => {
    expect(memberWindow(rows, ' person 1', 5).visible.map(m => m.user.id)).toEqual(['u1', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u19'])
    expect(memberWindow(rows, 'acme', 5).visible.map(m => m.user.id)).toEqual(['u23'])
    expect(memberWindow(rows, 'nobody', 5)).toMatchObject({ visible: [], left: 0 })
  })
})

describe('conversation info rules', () => {
  it('offers Media, Docs and Links tabs in that order', () => {
    expect(sharedTabs.map(t => t.label)).toEqual(['Media', 'Docs', 'Links'])
  })
  it('explains restricted sending only when it applies', () => {
    expect(sendModeNote('everyone', false)).toBeNull()
    expect(sendModeNote('admins', true)).toBe('Only admins can send messages in this group. You can read, react and vote.')
    expect(sendModeNote('selected', false)).toBe('Only selected members can send messages in this group. You can send.')
  })
  it('builds mailto links only for plain addresses', () => {
    expect(safeMailHref('asha@jivo.in')).toBe('mailto:asha@jivo.in')
    for (const bad of ['', null, undefined, 'asha@jivo.in?cc=x@y.z', 'a b@c.d', 'javascript:alert(1)', 'no-at.example']) expect(safeMailHref(bad)).toBeNull()
  })
  it('dials only an active peer of an unlocked direct chat that is not yourself', () => {
    expect(dialablePeer({ kind: 'direct', peer, is_self: false, locked: false })).toBe('p1')
    expect(dialablePeer({ kind: 'direct', peer, is_self: true })).toBeNull()
    expect(dialablePeer({ kind: 'direct', peer: { ...peer, is_active: false } })).toBeNull()
    expect(dialablePeer({ kind: 'direct', peer, locked: true })).toBeNull()
    expect(dialablePeer({ kind: 'group', peer: null })).toBeNull()
  })
  it('hides system notices that have no text', () => {
    expect(isEmptySystemNotice({ kind: 'system', system: { type: 'call', actor: null, users: [], text: '' } })).toBe(true)
    expect(isEmptySystemNotice({ kind: 'system', system: null })).toBe(true)
    expect(isEmptySystemNotice({ kind: 'system', system: { type: 'joined', actor: null, users: [], text: 'Asha joined' } })).toBe(false)
    expect(isEmptySystemNotice({ kind: 'text', system: null })).toBe(false)
  })
  it('describes the chat under its title', () => {
    expect(headerInfo({ kind: 'direct', is_self: true, member_count: 1, restricted_company: null, peer })).toBe('Message yourself')
    expect(headerInfo({ kind: 'group', member_count: 4, restricted_company: 'JIVO', peer: null })).toBe('4 members · JIVO only')
    expect(headerInfo({ kind: 'direct', member_count: 2, restricted_company: null, peer })).toBe('JIVO')
  })
})
