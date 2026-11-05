// Inbox (notifications) + Passwords parity capture. Synthetic fixtures only: every /api/jm/** and /api/jp/** request
// and the WebSocket are intercepted; nothing reaches a backend.
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../../test-results/parity/inbox-vault')
const peer = { id: 'peer', name: 'Example Colleague', full_name: 'Example Colleague', email: 'peer@example.invalid', avatar_url: null, company: null, is_active: true }
const me = { ...peer, id: 'me', name: 'Example Tester', full_name: 'Example Tester', display_name: 'Example Tester', email: 'tester@example.invalid', phone: '', bio: '', last_seen_privacy: 'everyone', can_create_groups: true, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS', 'ADMIN_USERS'], session: { id: 'parity', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
const now = new Date()
const ago = m => new Date(now.getTime() - m * 60000).toISOString()
const notes = [
  { id: 'n1', kind: 'message', title: 'Example Colleague sent you a message', body: 'Good morning! The project update is ready.', link: '/messenger/chat', data: {}, read_at: null, created_at: ago(5) },
  { id: 'n2', kind: 'admin_announcement', title: 'Planned maintenance tonight', body: 'JM will be unavailable from 22:00 to 22:30.', link: null, data: { alert: 'a1', severity: 'warning' }, read_at: null, created_at: ago(90) },
  { id: 'n3', kind: 'mention', title: 'You were mentioned in Project team', body: '@Example Tester can you check the report?', link: '/messenger/chat', data: {}, read_at: ago(60), created_at: ago(60 * 26) },
]
const can = { create_entry: true, edit_folders: true, rename: true, manage_members: true, remove_members: true, trash: true, archive: true, view_activity: true, appoint_owner: true }
const vaults = [
  { id: 'v1', name: 'My vault', description: '', owner_type: 'personal', company: null, my_role: 'owner', break_glass_until: null, entry_count: 3, archived_at: null, legal_hold: false, frozen: false, created_at: ago(9000), mine: true, can },
  { id: 'v2', name: 'Engineering', description: 'Team servers', owner_type: 'shared', company: null, my_role: 'owner', break_glass_until: null, entry_count: 1, archived_at: null, legal_hold: false, frozen: false, created_at: ago(9000), mine: true, can },
]
const ecan = { reveal: true, edit: true, share: true, revoke: true, delete: true, move: true, history: true }
const entries = [
  { id: 'e1', vault: { id: 'v1', name: 'My vault' }, kind: 'login', title: 'Example mail', username: 'tester@example.invalid', url: 'https://mail.example.invalid', tags: ['work'], folder: null, expires_on: null, updated_at: ago(30), password_changed_at: null, version: 2, trashed_at: null, via: 'role', can: ecan },
  { id: 'e2', vault: { id: 'v1', name: 'My vault' }, kind: 'server', title: 'Build server', username: 'deploy', url: '', tags: [], folder: null, expires_on: null, updated_at: ago(600), password_changed_at: null, version: 1, trashed_at: null, via: 'role', can: ecan },
  { id: 'e3', vault: { id: 'v1', name: 'My vault' }, kind: 'wifi', title: 'Office Wi-Fi', username: '', url: '', tags: ['office'], folder: null, expires_on: null, updated_at: ago(6000), password_changed_at: null, version: 1, trashed_at: null, via: 'role', can: ecan },
]
const detail = { ...entries[0], notes_present: false, secret_fields: ['password', 'notes'], versions: [{ version: 2, created_at: ago(30), created_by: me, current: true, shredded: false }, { version: 1, created_at: ago(9000), created_by: me, current: false, shredded: false }], shares: [] }
function jm(p, q) {
  if (p === '/api/jm/me/') return me
  if (p === '/api/jm/auth/options/') return { passkey_sign_in: false }
  if (p === '/api/jm/appearance/') return { type: 'default', color: null, image_url: null }
  if (p === '/api/jm/users/presence/') return { results: {} }
  if (p === '/api/jm/notifications/summary/') return { unread_conversations: 0, unread_messages: 0, unread_notifications: 2, unread_calls: 0, pending_approvals: 0, mention_unread: false }
  if (p === '/api/jm/notifications/') return { results: process.env.EMPTY ? [] : notes.filter(n => q.get('state') === 'unread' ? !n.read_at : q.get('state') === 'read' ? n.read_at : true), next_cursor: null }
  if (p === '/api/jm/me/notification-preferences/') return { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
  if (p.startsWith('/api/jm/alerts/')) return { results: [], next_cursor: null }
  return { results: [], next_cursor: null }
}
function jp(p) {
  if (p === '/api/jp/unlock/') return { unlocked: !process.env.LOCKED, expires_at: null, scope: 'jp', methods: ['password'] }
  if (p === '/api/jp/vaults/') return vaults
  const v = p.match(/^\/api\/jp\/vaults\/(v\d)\/$/); if (v) return vaults.find(x => x.id === v[1])
  if (/\/folders\/$/.test(p)) return [{ id: 'f1', name: 'Work', parent: null }]
  if (/\/files\/$/.test(p)) return { results: [], can: { list: true, download: true, upload: true, rename: true, delete: true }, max_bytes: 10485760 }
  if (/\/members\/$/.test(p)) return []
  if (/owner-requests/.test(p)) return []
  if (p === '/api/jp/entries/') return { results: entries, next_cursor: null }
  if (/^\/api\/jp\/entries\/e\d\/$/.test(p)) return detail
  if (p === '/api/jp/shared-with-me/') return []
  if (p === '/api/jp/audit/') return { results: [], next_cursor: null }
  if (p === '/api/jp/break-glass/') return []
  return {}
}
async function fixtures(context) {
  await context.route(/\/api\/j[mp]\//, async route => {
    const u = new URL(route.request().url())
    const data = u.pathname.startsWith('/api/jp/') ? jp(u.pathname) : jm(u.pathname, u.searchParams)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
const PAGES = {
  notifications: { reference: '/notifications', universal: '/notifications' },
  settings: { reference: '/notifications?tab=settings', universal: '/notifications', click: 'Notification preferences' },
  passwords: { reference: '/passwords', universal: '/passwords' },
  vault: { reference: '/passwords/vaults/v1', universal: '/passwords?vault=v1' },
  entry: { reference: '/passwords/entries/e1', universal: '/passwords?vault=v1&entry=e1' },
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const only = process.env.PAGES ? process.env.PAGES.split(',') : Object.keys(PAGES)
  const widths = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [390, 768, 1440]
  const themes = process.env.THEMES ? process.env.THEMES.split(',') : ['light', 'dark']
  try {
    for (const [app, base] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of themes) for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context)
        await context.addCookies([{ name: 'jm_csrftoken', value: 'parity-synthetic', url: base }, { name: 'csrftoken', value: 'parity-synthetic', url: base }])
        await context.addInitScript(() => { try { localStorage.setItem('jm.push.prompt-dismissed.me', String(Date.now())) } catch {} })
        const page = require('./settle.cjs').settleImages(await context.newPage())
        page.on('pageerror', e => console.log('PAGEERROR', app, e.stack.slice(0, 900)))
        for (const name of only) {
          const spec = PAGES[name]
          await page.goto(`${base}${spec[app]}`, { waitUntil: 'networkidle' }).catch(() => {})
          await page.waitForTimeout(app === 'universal' ? 3000 : 1500)
          if (spec.click && app === 'universal') await page.getByRole('button', { name: spec.click, exact: true }).click({ timeout: 3000 }).then(() => page.waitForTimeout(600)).catch(() => {})
          await page.screenshot({ path: path.join(dir, `${name}-${theme}-${width}-${app}.png`) })
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.log('OVERFLOW', app, name, theme, width)
        }
        await context.close()
      }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
