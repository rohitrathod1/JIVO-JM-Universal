// Shell parity capture: Home + messenger list (rail, phone bars) in both apps with synthetic fixtures only.
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../../test-results/parity/shell')
const peer = { id: 'peer', name: 'Example Colleague', full_name: 'Example Colleague', email: 'peer@example.invalid', avatar_url: null, company: null, is_active: true }
const me = { ...peer, id: 'me', name: 'Example Tester', full_name: 'Example Tester', display_name: 'Example Tester', email: 'tester@example.invalid', phone: '', bio: '', can_create_groups: true, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS', 'ADMIN_USERS'], session: { id: 'ui-parity', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
const now = new Date().toISOString()
const msg = { id: 'm1', seq: 2, body: 'Thanks, I’ll review it this afternoon.', conversation: 'chat', sender: me, client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null, deleted: false, deleted_by_moderator: false, system: null, created_at: now, updated_at: now, status: 'sent', can: {} }
const conversation = { id: 'chat', title: peer.name, kind: 'direct', avatar_url: null, peer, restricted_company: null, is_self: false, member_count: 2, last_message: { ...msg, preview: msg.body }, last_seq: 2, last_read_seq: 1, unread_count: 1, mention_unread: false, muted_until: null, pinned_at: null, archived_at: null, locked: false, disappearing_seconds: 0, left: false, send_mode: 'all', send_block: null, notify_preview: null, updated_at: now, my_role: 'member', description: '', created_at: now, visible_from_seq: 1, is_owner: false, can: { send: true } }
async function fixtures(context) {
  await context.route('**/api/jm/**', async route => {
    const p = new URL(route.request().url()).pathname
    let data = { results: [], next_cursor: null }
    if (p === '/api/jm/me/') data = me
    else if (p === '/api/jm/auth/options/') data = { passkey_sign_in: false }
    else if (p === '/api/jm/appearance/') data = { type: 'default', color: null, image_url: null }
    else if (p === '/api/jm/conversations/') data = { results: [conversation], next_cursor: null }
    else if (p === '/api/jm/notifications/') data = { results: [{ id: 'n1', kind: 'mention', title: 'Example Colleague mentioned you', body: 'Can you check the update?', link: '/messenger/chat', data: {}, read_at: null, created_at: now }, { id: 'n2', kind: 'system', title: 'New sign-in on Windows', body: '', link: '', data: {}, read_at: now, created_at: now }], next_cursor: null }
    else if (p === '/api/jm/users/presence/') data = { results: {} }
    else if (p === '/api/jm/notifications/summary/') data = { unread_conversations: 1, unread_messages: 1, unread_notifications: 2, unread_calls: 0, pending_approvals: 0, mention_unread: false }
    else if (p === '/api/jm/me/notification-preferences/') data = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const only = process.env.PAGES ? process.env.PAGES.split(',') : ['home', 'messenger']
  const widths = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [390, 768, 1440]
  const themes = process.env.THEMES ? process.env.THEMES.split(',') : ['light', 'dark']
  try {
    for (const [app, base] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of themes) for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context)
        await context.addInitScript(() => { try { localStorage.setItem('jm.push.prompt-dismissed.me', String(Date.now())) } catch {} })
        const page = require('./settle.cjs').settleImages(await context.newPage())
        if (process.env.DEBUG) { page.on('pageerror', e => console.log(app, 'pageerror', e.message)); page.on('console', m => m.type() === 'error' && console.log(app, m.text().slice(0, 400))) }
        for (const name of only) {
          await page.goto(`${base}/${name}`, { waitUntil: 'networkidle' }).catch(() => {})
          await page.waitForTimeout(1500)
          await page.screenshot({ path: path.join(dir, `${name}-${theme}-${width}-${app}.png`) })
          if (name === 'home' && width >= 768 && process.env.BELL) {
            await page.getByRole('button', { name: /^Notifications/ }).first().click(); await page.waitForTimeout(1200)
            await page.screenshot({ path: path.join(dir, `bell-${theme}-${width}-${app}.png`) }); await page.keyboard.press('Escape'); await page.mouse.click(width - 20, 880)
            await page.getByLabel('Passwords', { exact: true }).first().hover(); await page.waitForTimeout(400)
            await page.screenshot({ path: path.join(dir, `tip-${theme}-${width}-${app}.png`), clip: { x: 0, y: 0, width: 400, height: 500 } })
          }
        }
        await context.close()
      }
    }
  } finally { await browser.close() }
}
module.exports = { fixtures, me }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
