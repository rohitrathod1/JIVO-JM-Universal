// Admin / approvals / auth parity capture. Synthetic fixtures only: every /api/** request and the WebSocket are intercepted.
// Usage: node scripts/parity/admin.cjs   (env: PAGES=login,people  WIDTHS=390,1440  THEMES=light  JM_UI_APP=universal  JM_JIVO=1)
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../../test-results/parity/admin')
const now = new Date().toISOString()
const sec = { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false }
const me = { id: 'me', name: 'Example Tester', full_name: 'Example Tester', display_name: 'Example Tester', email: 'tester@example.invalid', avatar_url: null, company: null, is_active: true, phone: '', bio: '', can_create_groups: true, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS', 'ADMIN_USERS', 'ADMIN_AUDIT'], session: { id: 'p', expires_at: '2027-01-01', auth_method: 'password' }, security: sec }
const user = (id, name, extra = {}) => ({ id, name, full_name: name, display_name: name, email: `${id}@example.invalid`, phone: '', employee_code: null, is_active: true, status: 'active', has_password: true, date_joined: now, last_login: now, deactivated_at: null, is_deleted: false, deleted_at: null, deleted_by: null, groups: [], companies: [], mfa_enabled: false, locked_out: false, pending_email: null, pending_email_requested_at: null, is_superuser: false, ...extra })
const users = [
  user('me', 'Example Tester', { groups: ['User administrators'], is_superuser: true, mfa_enabled: true, employee_code: 'E001' }),
  user('anna', 'Anna Sharma', { groups: ['Messenger users', 'Password managers'] }),
  user('ravi', 'Ravi Kumar', { status: 'invited', last_login: null, groups: ['Messenger users'] }),
  user('lee', 'Lee Wong', { status: 'inactive', is_active: false }),
]
const groups = [
  { id: 'g1', name: 'Messenger users', description: 'Can use Messenger.', built_in: true, can_edit: false, can_manage_members: true, member_count: 3, capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE'], created_at: now },
  { id: 'g2', name: 'User administrators', description: 'Manage people and access.', built_in: true, can_edit: false, can_manage_members: true, member_count: 1, capabilities: ['ADMIN_USERS'], created_at: now },
]
const approvals = [{ kind: 'admin', id: 'a1', title: 'Reset two-step verification', subject: 'Anna Sharma', reason: 'Lost phone', status: 'pending', requested_by: { id: 'ravi', name: 'Ravi Kumar', email: 'ravi@example.invalid' }, requested_at: now, expires_at: '2027-01-01T00:00:00Z', decided_by: null, decided_at: null, can: { decide: true, cancel: false }, actions: { approve: '/api/jm/admin/approvals/a1/approve/', deny: '/api/jm/admin/approvals/a1/deny/', cancel: '/api/jm/admin/approvals/a1/cancel/' }, link: '/admin/approvals' }]
async function fixtures(context, signedIn) {
  await context.route(url => url.pathname.startsWith('/api/jm/') || url.pathname.startsWith('/api/jp/'), async route => {
    const p = new URL(route.request().url()).pathname
    let data = { results: [], next_cursor: null }, status = 200
    if (p === '/api/jm/me/') { data = signedIn ? me : { detail: 'Sign in' }; status = signedIn ? 200 : 401 }
    else if (p === '/api/jm/auth/options/') data = { passkey_sign_in: false, identity: process.env.JM_JIVO ? 'jivo' : 'local' }
    else if (p === '/api/jm/appearance/') data = { type: 'default', color: null, image_url: null }
    else if (p === '/api/jm/admin/users/') data = { count: users.length, next: null, previous: null, results: users }
    else if (p.startsWith('/api/jm/admin/users/anna/')) data = p.endsWith('/sessions/') ? [] : users[1]
    else if (p === '/api/jm/admin/groups/') data = groups
    else if (p === '/api/jm/admin/users/group-options/') data = groups.map(g => ({ name: g.name, grantable: true }))
    else if (p === '/api/jm/admin/capabilities/' || p === '/api/jm/admin/companies/') data = []
    else if (p === '/api/jm/admin/security-policy/') data = { two_step_enforced: false, updated_at: null, updated_by: null }
    else if (p === '/api/jm/admin/approvals/') data = { results: [] }
    else if (p === '/api/jm/approvals/') data = { results: approvals, waiting_on_me: 1 }
    else if (p === '/api/jm/notifications/summary/') data = { unread_conversations: 0, unread_messages: 0, unread_notifications: 0, unread_calls: 0, pending_approvals: 1, mention_unread: false }
    else if (p === '/api/jm/me/notification-preferences/') data = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
const pages = {
  login: ['/login', '/login', false],
  people: ['/admin/users', '/admin?tab=people', true],
  person: ['/admin/users/anna', '/admin?tab=people&user=anna', true],
  groups: ['/admin/groups', '/admin?tab=groups', true],
  security: ['/admin/security', '/admin?tab=security', true],
  approvals: ['/approvals', '/approvals', true],
  invite: ['/invite/TOKEN', '/invite/TOKEN', false],
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const only = (process.env.PAGES || '').split(',').filter(Boolean)
  const widths = (process.env.WIDTHS || '390,768,1440').split(',').map(Number)
  const themes = (process.env.THEMES || 'light,dark').split(',')
  try {
    for (const [app, base] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of themes) for (const width of widths) for (const [name, [ref, uni, signedIn]] of Object.entries(pages)) {
        if (only.length && !only.includes(name)) continue
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context, signedIn)
        await context.addInitScript(() => { try { localStorage.setItem('jm.push.prompt-dismissed.me', String(Date.now())) } catch {} })
        const page = require('./settle.cjs').settleImages(await context.newPage())
        try { await page.goto(`${base}${app === 'reference' ? ref : uni}`, { waitUntil: 'networkidle', timeout: 30000 }) } catch (e) { console.error(app, name, e.message) }
        await page.waitForTimeout(1200)
        await page.screenshot({ path: path.join(dir, `${name}-${theme}-${width}-${app}.png`) })
        await context.close()
      }
    }
  } finally { await browser.close() }
}
module.exports = { fixtures }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
