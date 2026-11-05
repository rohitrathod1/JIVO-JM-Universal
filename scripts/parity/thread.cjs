// Thread parity: bubbles + composer in both apps with synthetic fixtures. Never reaches a backend.
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const dir = path.resolve(__dirname, '../../test-results/parity/thread')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const person = (id, name) => ({ id, name, full_name: name, email: `${id}@example.invalid`, avatar_url: null, company: null, is_active: true })
const peer = person('peer', 'Example Colleague'), third = person('third', 'Riya Sharma')
const me = { ...person('me', 'Example Tester'), display_name: 'Example Tester', phone: '', bio: '', can_create_groups: true, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JP_ACCESS', 'ADMIN_USERS'], session: { id: 'p', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
const now = new Date().toISOString()
const att = (id, kind, name, extra = {}) => ({ id, status: 'ready', reject_reason: '', name, size: 245760, mime: kind === 'image' ? 'image/png' : kind === 'audio' ? 'audio/webm' : 'application/pdf', kind, width: kind === 'image' ? 800 : null, height: kind === 'image' ? 600 : null, duration_ms: kind === 'audio' ? 14000 : null, blurhash: '', thumb_url: kind === 'image' ? `/api/jm/media/${id}.png` : null, preview_url: kind === 'image' ? `/api/jm/media/${id}.png` : null, download_url: `/api/jm/media/${id}.bin`, created_at: now, ...extra })
let seq = 0
const msg = (conv, sender, body, extra = {}) => ({ id: `${conv}-m${++seq}`, seq, body, conversation: conv, sender, client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null, deleted: false, deleted_by_moderator: false, system: null, created_at: now, updated_at: now, status: 'sent', can: { edit: sender === me, delete_for_everyone: sender === me, react: true, reply: true, forward: true, vote: true }, ...extra })
const conv = (id, kind, title, list) => ({ id, title, kind, avatar_url: null, peer: kind === 'direct' ? peer : null, restricted_company: null, is_self: false, member_count: kind === 'group' ? 3 : 2, last_message: { ...list.at(-1), preview: list.at(-1).body }, last_seq: list.at(-1).seq, last_read_seq: list.at(-1).seq, unread_count: 0, mention_unread: false, muted_until: null, pinned_at: null, archived_at: null, locked: false, disappearing_seconds: 0, left: false, send_mode: 'all', send_block: null, notify_preview: null, updated_at: now, my_role: 'member', description: '', created_at: now, visible_from_seq: 1, is_owner: false, can: { send: true, send_file: true, edit_info: false, manage_members: false, leave: false, call: true, set_disappearing: true } })
seq = 0
const direct = [
  msg('chat', null, '', { kind: 'system', system: { text: 'Example Tester created this chat' } }),
  msg('chat', peer, 'Good morning! The project update is ready.'),
  msg('chat', peer, 'Can you check the numbers on slide 4 before lunch? I think the Q3 totals are off by a small margin.'),
  msg('chat', me, 'Thanks, I will review it this afternoon.', { reactions: [{ emoji: '👍', count: 1, me: false }] }),
  msg('chat', me, 'Sure, looking now.', { reply_to: { id: 'x', seq: 3, sender_name: 'Example Colleague', preview: 'Can you check the numbers on slide 4 before lunch?', deleted: false, unavailable: false }, edited_at: now }),
  msg('chat', peer, 'Here is the doc', { forwarded: true, attachments: [att('f1', 'file', 'Quarterly-report.pdf')] }),
  msg('chat', peer, '', { deleted: true }),
  msg('chat', me, 'Lovely! 🎉', { reactions: [{ emoji: '❤️', count: 2, me: true }, { emoji: '😂', count: 1, me: false }] }),
]
seq = 0
const group = [
  msg('team', third, 'Standup in 5 minutes'),
  msg('team', third, 'Please share blockers in the thread'),
  msg('team', peer, 'On my way'),
  msg('team', me, 'Joining now'),
]
seq = 0
// Round 2: poll, contact and event cards (JM_CONVS=cards). Event starts tomorrow 10:00 so the date tile is stable.
const tomorrow = new Date(Date.now() + 86400000); tomorrow.setHours(10, 0, 0, 0)
const cards = [
  msg('cards', peer, 'Cards below'),
  msg('cards', peer, '', { kind: 'poll', poll: { question: 'Where should we have the team lunch?', allow_multiple: false, voters: 3, total_votes: 3, options: [{ id: 'o1', text: 'Italian place', votes: 2, me: true }, { id: 'o2', text: 'Sushi bar', votes: 1, me: false }, { id: 'o3', text: 'Cafeteria', votes: 0, me: false }] } }),
  msg('cards', me, '', { kind: 'contact', contact: third }),
  msg('cards', peer, '', { kind: 'event', event: { title: 'Quarterly planning review', starts_at: tomorrow.toISOString(), ends_at: new Date(tomorrow.getTime() + 3600000).toISOString(), place: 'Board room, 3rd floor', place_point: null, description: 'Bring your Q3 numbers.', link: 'https://meet.example.invalid/abc', reminder_minutes: 15, cancelled: false, counts: { going: 2, maybe: 1, not_going: 0 }, my_answer: 'going' }, can: { edit: false, delete_for_everyone: false, react: true, reply: true, forward: true, vote: true, respond: true, edit_event: false } }),
]
const convs = { chat: conv('chat', 'direct', peer.name, direct), team: conv('team', 'group', 'Design Team', group), cards: conv('cards', 'direct', peer.name, cards) }
const msgs = { chat: direct, team: group, cards }
async function fixtures(context) {
  await context.route('**/api/jm/**', async route => {
    const p = new URL(route.request().url()).pathname
    if (p.startsWith('/api/jm/media/')) return route.fulfill({ status: 200, contentType: 'image/png', body: png })
    let data = { results: [], next_cursor: null }
    const m = p.match(/^\/api\/jm\/conversations\/([^/]+)\/(messages\/|members\/)?$/)
    if (p === '/api/jm/me/') data = me
    else if (p === '/api/jm/auth/options/') data = { passkey_sign_in: false }
    else if (p === '/api/jm/appearance/') data = { type: 'default', color: null, image_url: null }
    else if (p === '/api/jm/conversations/') data = { results: Object.values(convs), next_cursor: null }
    else if (m && convs[m[1]] && !m[2]) data = convs[m[1]]
    else if (m && convs[m[1]] && m[2] === 'members/') data = { results: [me, peer, third].map(user => ({ user, role: 'member', is_me: user.id === me.id, can_send: true, joined_at: now })) }
    else if (m && convs[m[1]] && m[2] === 'messages/') { const list = msgs[m[1]]; data = { results: list, mode: 'latest', oldest_seq: 1, newest_seq: list.length, has_more_before: false, has_more_after: false, first_unread_seq: null, last_read_seq: list.length, last_seq: list.length, visible_from_seq: 1, receipts: { read_seq: list.length, delivered_seq: list.length }, server_time: now } }
    else if (p === '/api/jm/users/presence/') data = { results: { peer: { online: true, last_seen_at: null } } }
    else if (p === '/api/jm/notifications/summary/') data = { unread_conversations: 0, unread_messages: 0, unread_notifications: 0, unread_calls: 0, pending_approvals: 0, mention_unread: false }
    else if (p === '/api/jm/me/notification-preferences/') data = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: false, sound_enabled: false, vibrate_enabled: false }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.routeWebSocket('**/ws/**', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(raw => { if (JSON.parse(raw).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
}
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const widths = (process.env.JM_WIDTHS || '390,1440').split(',').map(Number)
  const themes = (process.env.JM_THEMES || 'light,dark').split(',')
  const ids = (process.env.JM_CONVS || 'chat,team').split(',')
  try {
    for (const [app, base] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of themes) for (const width of widths) for (const id of ids) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context)
        const page = require('./settle.cjs').settleImages(await context.newPage())
        await page.goto(`${base}${app === 'reference' ? `/messenger/${id}` : `/messenger?conversation=${id}`}`, { waitUntil: 'networkidle' }).catch(() => {})
        await page.getByText(id === 'cards' ? 'Quarterly planning review' : msgs[id][1].body, { exact: true }).first().waitFor({ timeout: 60000 }).catch(e => console.error(app, id, e.message))
        await page.waitForTimeout(800)
        const notNow = page.getByRole('button', { name: 'Not now' })
        if (await notNow.isVisible().catch(() => false)) { await notNow.click(); await page.waitForTimeout(400) }
        const name = `${app}-${id}-${theme}-${width}`
        await page.screenshot({ path: path.join(dir, `${name}.png`) })
        if (id === 'cards' && process.env.JM_SHEET) {
          // Message options sheet on the contact card bubble (own message), then the attach menu.
          const bubble = page.getByText('Example Colleague', { exact: false }).last()
          await page.getByRole('button', { name: app === 'reference' ? 'Message options' : 'Message actions', exact: true }).nth(1).click({ force: true }).catch(e => console.error('sheet', e.message))
          await page.waitForTimeout(400)
          await page.screenshot({ path: path.join(dir, `${name}-sheet.png`) })
          await page.keyboard.press('Escape'); await page.waitForTimeout(300)
          await page.goto(page.url(), { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(800)
          await page.getByRole('button', { name: app === 'reference' ? 'Attach' : /^(Attach|Message tools)$/ }).first().click().catch(e => console.error('attach', e.message))
          await page.waitForTimeout(400)
          await page.screenshot({ path: path.join(dir, `${name}-attach.png`) })
          void bubble
        }
        if (id === 'chat' && width === 1440) {
          await page.getByText(msgs.chat[3].body, { exact: true }).first().hover().catch(() => {})
          await page.waitForTimeout(300)
          await page.screenshot({ path: path.join(dir, `${name}-hover.png`), clip: { x: 400, y: 300, width: 1040, height: 600 } })
        }
        await context.close()
      }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
