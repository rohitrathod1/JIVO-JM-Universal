// Equivalent synthetic accounts/messages in both apps. Never sends requests to a backend.
const { chromium, expect } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../test-results/ui-parity')
const peer = { id: 'peer', name: 'Example Colleague', full_name: 'Example Colleague', email: 'peer@example.invalid', avatar_url: null, company: null, is_active: true }
const me = { ...peer, id: 'me', name: 'Example Tester', full_name: 'Example Tester', display_name: 'Example Tester', email: 'tester@example.invalid', phone: '', bio: '', can_create_groups: true, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS', 'ADMIN_USERS'], session: { id: 'ui-parity', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
const now = new Date().toISOString()
const messages = ['Good morning! The project update is ready.', 'Thanks, I’ll review it this afternoon.'].map((body, index) => ({ id: `message-${index}`, seq: index + 1, body, conversation: 'chat', sender: index ? me : peer, client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null, deleted: false, deleted_by_moderator: false, system: null, created_at: now, updated_at: now, status: 'sent', can: { edit: !!index, delete_for_everyone: !!index, react: true, reply: true, forward: true, vote: false } }))
const conversation = { id: 'chat', title: peer.name, kind: 'direct', avatar_url: null, peer, restricted_company: null, is_self: false, member_count: 2, last_message: { ...messages[1], preview: messages[1].body }, last_seq: 2, last_read_seq: 2, unread_count: 0, mention_unread: false, muted_until: null, pinned_at: null, archived_at: null, locked: false, disappearing_seconds: 0, left: false, send_mode: 'all', send_block: null, notify_preview: null, updated_at: now, my_role: 'member', description: '', created_at: now, visible_from_seq: 1, is_owner: false, can: { send: true, send_file: true, edit_info: false, manage_members: false, leave: false, call: true, set_disappearing: true } }
async function fixtures(context, signedIn) {
  await context.route('**/api/jm/**', async route => {
    const p = new URL(route.request().url()).pathname
    let data = { results: [], next_cursor: null }, status = 200
    if (p === '/api/jm/me/') { data = signedIn ? me : { detail: 'Sign in' }; status = signedIn ? 200 : 401 }
    else if (p === '/api/jm/auth/options/') data = { passkey_sign_in: false }
    else if (p === '/api/jm/appearance/') data = { type: 'default', color: null, image_url: null }
    else if (p === '/api/jm/conversations/') data = { results: [conversation], next_cursor: null }
    else if (p === '/api/jm/conversations/chat/') data = conversation
    else if (p === '/api/jm/conversations/chat/members/') data = { results: [me, peer].map(user => ({ user, role: 'member', is_me: user.id === me.id, can_send: true, joined_at: now })) }
    else if (p === '/api/jm/conversations/chat/messages/') data = { results: messages, mode: 'latest', oldest_seq: 1, newest_seq: 2, has_more_before: false, has_more_after: false, first_unread_seq: null, last_read_seq: 2, last_seq: 2, visible_from_seq: 1, receipts: { read_seq: 2, delivered_seq: 2 }, server_time: now }
    else if (p === '/api/jm/users/presence/') data = { results: { peer: { online: true, last_seen_at: null } } }
    else if (p === '/api/jm/notifications/summary/') data = { unread_conversations: 0, unread_messages: 0, unread_notifications: 0, unread_calls: 0, pending_approvals: 0, mention_unread: false }
    else if (p === '/api/jm/me/notification-preferences/') data = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const report = []
  try {
    for (const [app, base] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://127.0.0.1:4175']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context, false)
        const page = require('./parity/settle.cjs').settleImages(await context.newPage()); const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
        await expect(page.getByLabel('Email', { exact: true })).toBeVisible().catch(async error => { console.error(app, theme, width, errors, await page.locator('body').innerText()); throw error })
        await page.screenshot({ path: path.join(dir, `${app}-login-${theme}-${width}.png`) })
        await context.unroute('**/api/jm/**'); await fixtures(context, true)
        await page.goto(`${base}/messenger`, { waitUntil: 'networkidle' })
        await expect(page.getByText(peer.name, { exact: true }).first()).toBeVisible()
        await page.screenshot({ path: path.join(dir, `${app}-list-${theme}-${width}.png`) })
        await page.goto(`${base}${app === 'reference' ? '/messenger/chat' : '/messenger?conversation=chat'}`, { waitUntil: 'networkidle' })
        await expect(page.getByText(messages[0].body, { exact: true })).toBeVisible({ timeout: 20000 }).catch(async error => { console.error(app, theme, width, errors, await page.locator('body').innerText()); await page.screenshot({ path: path.join(dir, `${app}-failure-${theme}-${width}.png`) }); throw error })
        await page.screenshot({ path: path.join(dir, `${app}-chat-${theme}-${width}.png`) })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        if (overflow) throw new Error(`${app} ${theme} ${width}: horizontal page overflow`)
        report.push({ app, theme, width, errors, overflow })
        await context.close()
      }
    }
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ at: new Date().toISOString(), fixtures: 'synthetic; all API requests intercepted', results: report }, null, 2))
    console.log(JSON.stringify(report))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
