// Info parity capture: Profile page, Group info and Contact info in both apps, synthetic fixtures only (never a backend).
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../../test-results/parity/info')
const now = new Date().toISOString()
const person = (id, name, extra = {}) => ({ id, name, full_name: name, email: `${id}@example.invalid`, avatar_url: null, company: 'Example Foods', is_active: true, ...extra })
const peer = person('peer', 'Example Colleague')
const others = ['Asha Rao', 'Ben Cole', 'Chen Li', 'Dina Shah', 'Eli Park', 'Farah Noor', 'Gita Sen'].map((n, i) => person(`u${i}`, n))
const passkeys = [{ id: 'pk1', name: 'Work laptop', created_at: '2026-10-05T10:00:00Z', last_used_at: now, synced: true }]
const notices = [{ id: 'n1', title: 'New sign-in', body: 'Edge on Windows signed in to your account.', created_at: '2026-11-02T09:00:00Z' }, { id: 'n2', title: 'Passkey added', body: 'A passkey named Work laptop was added.', created_at: '2026-10-05T10:00:00Z' }]
const me = { ...person('me', 'Example Tester'), display_name: 'Example Tester', phone: '+91 98100 00000', bio: 'Dispatch, Plant 2', can_create_groups: true, companies: [], groups: ['Messenger users', 'Dispatch'], is_superuser: false, capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS'], session: { id: 'ui-parity', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: true, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys, recovery_codes_left: 8, locked_capabilities: [], locked_out: false } }
const msg = (id, seq, body, sender) => ({ id, seq, body, conversation: 'chat', sender, client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null, deleted: false, deleted_by_moderator: false, system: null, created_at: now, updated_at: now, status: 'sent', can: { react: true, reply: true, forward: true } })
const base = { restricted_company: null, is_self: false, last_seq: 2, last_read_seq: 2, unread_count: 0, mention_unread: false, muted_until: null, pinned_at: null, archived_at: null, locked: false, disappearing_seconds: 0, left: false, send_block: null, notify_preview: null, updated_at: now, description: '', created_at: now, visible_from_seq: 1 }
const direct = { ...base, id: 'chat', title: peer.name, kind: 'direct', avatar_url: null, peer, member_count: 2, last_message: { ...msg('m2', 2, 'See you at 3.', me), preview: 'See you at 3.' }, send_mode: 'everyone', my_role: 'member', is_owner: false, can: { send: true, send_file: true, edit_info: false, manage_members: false, leave: false, call: true, set_disappearing: true } }
const group = { ...base, id: 'grp', title: 'Plant 2 Dispatch', kind: 'group', avatar_url: null, peer: null, description: 'Daily dispatch coordination for Plant 2.', member_count: 9, last_message: { ...msg('g2', 2, 'Trucks leave at 6.', peer), preview: 'Trucks leave at 6.' }, send_mode: 'everyone', my_role: 'owner', is_owner: true, can: { send: true, send_file: true, edit_info: true, manage_members: true, leave: true, call: false, set_disappearing: true } }
const members = [{ user: me, role: 'owner', is_me: true, can_send: true, joined_at: now }, { user: peer, role: 'admin', is_me: false, can_send: true, joined_at: now }, ...others.map(u => ({ user: u, role: 'member', is_me: false, can_send: true, joined_at: now }))]
const profile = { ...peer, bio: 'Logistics lead, available 9 to 6', phone: '+91 98100 11111', companies: [{ id: 'c1', company: 'c1', company_name: 'Example Foods', company_color: '#16a34a', title: 'Lead', department: 'Logistics' }] }
const sessions = [{ id: 's1', device_label: 'Edge on Windows', auth_method: 'password', current: true, last_seen_at: now, created_at: now, ip_last: '10.0.0.1' }, { id: 's2', device_label: 'JM on Android', auth_method: 'passkey', current: false, last_seen_at: now, created_at: now, ip_last: null }]
async function fixtures(context) {
  await context.route('**/api/jm/**', async route => {
    const p = new URL(route.request().url()).pathname
    let data = { results: [], next_cursor: null }
    if (p === '/api/jm/me/') data = me
    else if (p === '/api/jm/auth/options/') data = { passkey_sign_in: false }
    else if (p === '/api/jm/auth/mfa/') data = { mfa_enrolled: true, mfa_required: false, passkeys, recovery_codes_left: 8 }
    else if (p === '/api/jm/auth/sessions/') data = sessions
    else if (p === '/api/jm/me/security-notices/') data = { results: notices, next_cursor: 'older', unavailable_count: 0 }
    else if (p === '/api/jm/appearance/') data = { type: 'default', color: null, image_url: null }
    else if (p === '/api/jm/conversations/') data = { results: [group, direct], next_cursor: null }
    else if (p === '/api/jm/conversations/chat/') data = direct
    else if (p === '/api/jm/conversations/grp/') data = group
    else if (p === '/api/jm/conversations/grp/members/') data = { results: members }
    else if (p === '/api/jm/conversations/chat/members/') data = { results: members.slice(0, 2) }
    else if (p.endsWith('/shared/')) data = { results: [], next_before: null }
    else if (p.endsWith('/messages/')) { const id = p.split('/')[4]; const ms = [msg(`${id}1`, 1, 'Good morning! The update is ready.', peer), msg(`${id}2`, 2, 'Thanks, reviewing now.', me)].map(m => ({ ...m, conversation: id })); data = { results: ms, mode: 'latest', oldest_seq: 1, newest_seq: 2, has_more_before: false, has_more_after: false, first_unread_seq: null, last_read_seq: 2, last_seq: 2, visible_from_seq: 1, receipts: { read_seq: 2, delivered_seq: 2 }, server_time: now } }
    else if (p === '/api/jm/users/presence/') data = { results: {} }
    else if (p === '/api/jm/users/peer/') data = profile
    else if (/^\/api\/jm\/users\/[^/]+\/$/.test(p)) { const id = p.split('/')[4]; const u = [me, ...others].find(x => x.id === id); if (u) data = { ...u, bio: '', phone: null, companies: [] } }
    else if (p === '/api/jm/notifications/summary/') data = { unread_conversations: 0, unread_messages: 0, unread_notifications: 0, unread_calls: 0, pending_approvals: 0, mention_unread: false }
    else if (p === '/api/jm/me/notification-preferences/') data = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
async function openHeader(page, app, title) {
  if (app === 'reference') await page.locator('header button').filter({ hasText: title }).first().click({ timeout: 8000 })
  else await page.getByRole('button', { name: new RegExp(`^${title}, `) }).first().click({ timeout: 8000 })
  await page.waitForTimeout(1500)
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const only = process.env.PAGES ? process.env.PAGES.split(',') : ['profile', 'group', 'contact']
  const widths = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [390, 1440]
  const themes = process.env.THEMES ? process.env.THEMES.split(',') : ['light', 'dark']
  try {
    for (const [app, url] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of themes) for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context)
        await context.addInitScript(() => { try { localStorage.setItem('jm.push.prompt-dismissed.me', String(Date.now())) } catch {} })
        const page = require('./settle.cjs').settleImages(await context.newPage())
        for (const name of only) {
          const file = path.join(dir, `${name}-${theme}-${width}-${app}.png`)
          try {
            if (name === 'profile') {
              await page.setViewportSize({ width, height: width < 768 ? 3200 : 2200 })
              await page.goto(`${url}/profile`, { waitUntil: 'networkidle' }).catch(() => {})
              await page.waitForTimeout(2000)
              await page.screenshot({ path: file, fullPage: true })
              await page.setViewportSize({ width, height: 1000 })
              continue
            }
            const id = name === 'group' ? 'grp' : 'chat'
            await page.goto(app === 'reference' ? `${url}/messenger/${id}` : `${url}/messenger?conversation=${id}`, { waitUntil: 'networkidle' }).catch(() => {})
            await page.waitForTimeout(2000)
            await openHeader(page, app, name === 'group' ? group.title : peer.name)
            await page.screenshot({ path: file })
          } catch (e) { console.error(app, name, theme, width, e.message); await page.screenshot({ path: file }).catch(() => {}) }
        }
        await context.close()
      }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
