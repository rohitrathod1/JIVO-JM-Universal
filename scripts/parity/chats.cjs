// Chats list + chat frame parity captures. Synthetic fixtures only; never reaches a backend.
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../../test-results/parity/chats')
const person = (id, name) => ({ id, name, full_name: name, email: `${id}@example.invalid`, avatar_url: null, company: 'JIVO', is_active: true })
const peer = person('peer', 'Example Colleague'), ana = person('ana', 'Ana Patel'), raj = person('raj', 'Raj Kumar')
const me = { ...person('me', 'Example Tester'), display_name: 'Example Tester', phone: '', bio: '', can_create_groups: true, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS'], session: { id: 'p', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
const now = Date.now(); const iso = ms => new Date(ms).toISOString()
const msg = (id, seq, body, sender, at) => ({ id, seq, body, conversation: 'chat', sender, client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null, deleted: false, deleted_by_moderator: false, system: null, created_at: iso(at), updated_at: iso(at), status: 'sent', can: { edit: sender === me, delete_for_everyone: sender === me, react: true, reply: true, forward: true, vote: false } })
const messages = [msg('m1', 1, 'Hi! Are we still on for the review?', peer, now - 86400000 * 2), msg('m2', 2, 'Yes, Thursday at 3.', me, now - 86400000 * 2 + 60000), msg('m3', 3, 'Good morning! The project update is ready.', peer, now - 3600000), msg('m4', 4, 'Thanks, I will review it this afternoon.', me, now - 3000000)]
const base = { restricted_company: null, is_self: false, last_read_seq: 0, mention_unread: false, muted_until: null, pinned_at: null, archived_at: null, locked: false, disappearing_seconds: 0, left: false, send_mode: 'all', send_block: null, notify_preview: null, my_role: 'member', description: '', created_at: iso(now), visible_from_seq: 1, is_owner: false, can: { send: true, send_file: true, edit_info: false, manage_members: false, leave: true, call: true, set_disappearing: true } }
const lm = (m, extra = {}) => ({ ...m, preview: m.body, text: m.body, media: null, ...extra })
const conversations = [
  { ...base, id: 'chat', title: peer.name, kind: 'direct', avatar_url: null, peer, member_count: 2, last_message: lm(messages[3]), last_seq: 4, last_read_seq: 4, unread_count: 0, updated_at: iso(now - 3000000), pinned_at: iso(now) },
  { ...base, id: 'g1', title: 'Design team', kind: 'group', avatar_url: null, peer: null, member_count: 5, last_message: lm(msg('g1m', 9, 'Shared the new mockups', ana, now - 7200000)), last_seq: 9, unread_count: 3, updated_at: iso(now - 7200000) },
  { ...base, id: 'd2', title: raj.name, kind: 'direct', avatar_url: null, peer: raj, member_count: 2, last_message: lm(msg('d2m', 5, 'See you tomorrow', raj, now - 86400000)), last_seq: 5, last_read_seq: 5, unread_count: 0, updated_at: iso(now - 86400000), muted_until: '2099-01-01T00:00:00Z' },
  { ...base, id: 'd3', title: ana.name, kind: 'direct', avatar_url: null, peer: ana, member_count: 2, last_message: lm(msg('d3m', 2, 'Can you send the invoice?', ana, now - 86400000 * 5)), last_seq: 2, unread_count: 12, updated_at: iso(now - 86400000 * 5), mention_unread: true },
]
async function fixtures(context) {
  await context.route('**/api/jm/**', async route => {
    const p = new URL(route.request().url()).pathname
    let data = { results: [], next_cursor: null }
    const conv = p.match(/^\/api\/jm\/conversations\/([^/]+)\/$/)
    if (p === '/api/jm/me/') data = me
    else if (p === '/api/jm/auth/options/') data = { passkey_sign_in: false }
    else if (p === '/api/jm/appearance/') data = { type: 'default', color: null, image_url: null }
    else if (p === '/api/jm/conversations/') data = { results: conversations, next_cursor: null, locked_count: 0 }
    else if (conv) data = conversations.find(c => c.id === conv[1]) ?? conversations[0]
    else if (/members\/$/.test(p)) data = { results: [me, peer].map(user => ({ user, role: 'member', is_me: user.id === me.id, can_send: true, joined_at: iso(now) })), next_cursor: null }
    else if (/messages\/$/.test(p) && p.includes('/chat/')) data = { results: messages, mode: 'latest', oldest_seq: 1, newest_seq: 4, has_more_before: false, has_more_after: false, first_unread_seq: null, last_read_seq: 4, last_seq: 4, visible_from_seq: 1, receipts: { read_seq: 4, delivered_seq: 4 }, server_time: iso(now) }
    else if (p === '/api/jm/search/messages/') data = { results: [{ message: messages[0], conversation: { id: 'chat', title: peer.name, kind: 'direct' }, highlight: 'Hi! Are we still on for the [[review]]?' }, { message: messages[3], conversation: { id: 'chat', title: peer.name, kind: 'direct' }, highlight: 'Thanks, I will [[review]] it this afternoon.' }], next_cursor: null, incomplete: false }
    else if (p === '/api/jm/users/presence/') data = { results: { peer: { online: true, last_seen_at: null } } }
    else if (p.startsWith('/api/jm/users/')) data = { results: [peer, ana, raj], next_cursor: null }
    else if (p === '/api/jm/notifications/summary/') data = { unread_conversations: 2, unread_groups: 1, unread_archived: 0, unread_messages: 15, unread_notifications: 0, unread_calls: 0, pending_approvals: 0, mention_unread: true }
    else if (p === '/api/jm/me/notification-preferences/') data = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { context._jmSocket = socket; socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const only = process.env.JM_UI_APP
  const widths = (process.env.JM_WIDTHS || '390,1440').split(',').map(Number)
  const themes = (process.env.JM_THEMES || 'light').split(',')
  const shots = (process.env.JM_SHOTS || 'list,newchat,chat').split(',')
  try {
    for (const [app, url] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (only && only !== app) continue
      for (const theme of themes) for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 860 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context)
        await context.addInitScript(() => { try { localStorage.setItem('jm.push.prompt-dismissed.me', String(Date.now())) } catch {} })
        const page = require('./settle.cjs').settleImages(await context.newPage())
        const shot = name => page.screenshot({ path: path.join(dir, `${app}-${name}-${theme}-${width}.png`) })
        if (shots.includes('list') || shots.includes('newchat')) {
          await page.goto(`${url}/messenger`, { waitUntil: 'networkidle' })
          await page.getByText('Design team').first().waitFor({ timeout: 20000 }).catch(() => {})
          await page.waitForTimeout(2000); await shot('list')
          if (shots.includes('typing')) {
            context._jmSocket?.send(JSON.stringify({ type: 'TYPING_STARTED', data: { conversation: 'g1', user: 'ana' } }))
            await page.waitForTimeout(500); await shot('typing')
          }
          if (shots.includes('rowmenu')) {
            await page.getByText('Design team').first().click({ button: 'right' }).catch(() => {})
            await page.waitForTimeout(600); await shot('rowmenu')
            await page.keyboard.press('Escape'); await page.waitForTimeout(300)
            if (await page.getByText('Pin to top').count()) await page.mouse.click(5, 5)
          }
          if (shots.includes('search')) {
            const box = app === 'reference' ? page.getByPlaceholder('Search chats') : page.getByLabel('Search conversations')
            await box.first().fill('review').catch(() => {})
            await page.waitForTimeout(1200); await shot('search')
            await box.first().fill('').catch(() => {})
          }
          if (shots.includes('newchat')) {
            await page.getByRole('button', { name: 'New chat' }).first().click().catch(() => {})
            await page.waitForTimeout(800); await shot('newchat')
            await page.keyboard.press('Escape')
          }
        }
        if (shots.includes('chat')) {
          await page.goto(`${url}${app === 'reference' ? '/messenger/chat' : '/messenger?conversation=chat'}`, { waitUntil: 'networkidle' })
          await page.getByText(messages[0].body).first().waitFor({ timeout: 20000 }).catch(() => {})
          await page.waitForTimeout(800); await shot('chat')
          if (shots.includes('menu')) {
            await page.getByRole('button', { name: app === 'reference' ? 'Chat options' : 'Conversation options' }).first().click().catch(() => {})
            await page.waitForTimeout(600); await shot('menu')
          }
        }
        await context.close()
      }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
