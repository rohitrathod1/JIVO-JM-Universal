const { chromium, expect } = require('@playwright/test')
const fs = require('node:fs')
const captureTests=require('./capture-interactions.cjs')
const assert = require('node:assert/strict')
const base = 'http://localhost:' + Number(fs.readFileSync('.local-ui-port', 'utf8'))
const person = { id: 'peer', name: 'Example Colleague', email: 'colleague@example.invalid', avatar_url: null, company: 'Example Company', is_active: true }
const me = { id: 'me', name: 'Example Tester', display_name: 'Example Tester', full_name: 'Example Tester', email: 'tester@example.invalid', phone: '+91 98100 00000', bio: '', avatar_url: null,
  can_create_groups: true, pending_email: null, pending_email_requested_at: null, employee_code: null, date_joined: '2026-01-01', last_seen_privacy: 'everyone',
  companies: [], capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JM_CREATE_GROUP', 'JM_SEND_ALERT', 'JP_ACCESS', 'JP_MANAGE_VAULT', 'JP_REQUEST_EMERGENCY', 'ADMIN_USERS'], groups: [],
  session: { id: 'current-device', expires_at: '2027-01-01', auth_method: 'password' },
  security: { mfa_enrolled: true, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [{id:'synthetic-key',name:'Synthetic key'}], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
function message(id, seq, body, own = false) {
  return { id, seq, body, conversation: 'chat', sender: own ? { ...person, id: 'me', name: me.name } : person,
    client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null, deleted: false,
    deleted_by_moderator: false, system: null, created_at: '2026-10-20T06:00:00Z', updated_at: '2026-10-20T06:00:00Z', status: 'sent',
    can: { edit: own, delete_for_everyone: own, react: true, reply: true, forward: true, vote: false } }
}
function mockWave() {
  const samples = 8000 * 8, buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40); return buffer
}
// Navigation as in the reference shell: rail links from 768px, the five phone tabs below it, and the account menu
// (hold Profile) for Approvals, Administration and Sign out.
async function accountMenu(page) {
  await page.getByRole('link', { name: /^Profile: / }).last().click({ delay: 700 })
}
async function nav(page, width, railName, tabName, menuName) {
  if (width >= 768) return page.getByRole('link', { name: railName, exact: true }).last().click()
  if (tabName) return page.getByRole('link', { name: tabName, exact: true }).last().click()
  await accountMenu(page)
  await page.getByRole('menu', { name: 'Account' }).getByRole('menuitem', { name: menuName, exact: true }).click()
}
// Administration has no tab row any more (reference): the rail links each section on desktop, a tab strip on phones.
async function adminSection(page, width, name) {
  if (width >= 768) return page.getByRole('link', { name, exact: true }).last().click()
  return page.getByRole('tablist', { name: 'Administration' }).getByRole('tab', { name, exact: true }).click()
}
// Media and image bubbles follow the reference (no inline export button); export lives in the message actions sheet.
async function exportFromActions(page, name) {
  const bubble = page.getByLabel(/^Message from /).filter({ has: page.getByRole('button', { name: new RegExp('^(Open media|View image) ' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).last()
  await bubble.hover()
  await bubble.getByRole('button', { name: 'Message actions', exact: true }).click()
  await page.getByRole('button', { name: 'Export attachment ' + name, exact: true }).click()
}
// Desktop rail bell is a menu button (reference BellMenu); the full page is behind "View all notifications & settings".
async function openNotifications(page, width) {
  // Phones: the header bell opens the Notifications page (Workspace header; there is no Inbox tab since 2e4a6d4).
  if (width < 768) { await page.getByRole('button', { name: /^Notifications(, \d+ unread)?$/ }).first().click(); return page.waitForURL(u => new URL(u).pathname === '/notifications') }
  await page.getByRole('button', { name: /^Notifications(, \d+ unread)?$/ }).last().click()
  await page.getByRole('menuitem', { name: 'View all notifications & settings', exact: true }).click()
}
async function signOut(page) {
  await accountMenu(page)
  await page.getByRole('menu', { name: 'Account' }).getByRole('menuitem', { name: 'Sign out', exact: true }).click()
  await page.getByText('Sign out of JM?', { exact: true }).waitFor()
  await page.getByRole('dialog', { name: 'Sign out of JM?' }).getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    fs.mkdirSync('test-results', { recursive: true })
    for (const [width, height] of [[360, 1000], [768, 1000], [1440, 1000], [844, 390]].filter(([width]) => !process.env.JM_UI_WIDTH || width === Number(process.env.JM_UI_WIDTH))) {
      const context = await browser.newContext({ viewport: { width, height } })
      await captureTests.installStubs(context)
      const page = await context.newPage()
      try {
      const runtimeErrors = [], unexpected = [], mutations = []
      let stepMethods=['password'],vaultVerified=false,unlockCalls=0;let signedIn = false, verified = false, denied = false, socketClient; let appearance={type:'default',color:null,image_url:null,updated_at:'2026-10-20'};let passwordPending=false;let failNextSend=false; let recoveryReply; let recoveryRequested = false
      let messages = [message('first', 1, 'Hello from the mocked API')]
      messages[0].attachments = [{ id: 'audio', name: 'Example audio.wav', kind: 'audio', status: 'ready', preview_url: '/api/jm/media/mock.wav', download_url: '/api/jm/media/export-mock.bin', thumb_url: null, mime: 'audio/wav', size: 128044 }]
      const audioAttachment = messages[0].attachments[0];let holdAttachment=false,attachmentRequested=false,releaseAttachment;let attachmentDownloads=0
      let notes = [{ id: 'n1', kind: 'message', title: 'Example activity', body: 'A mocked notification', link: '/messenger/chat?seq=1', data: {}, read_at: null, created_at: '2026-10-20T06:00:00Z' }]
      const vault = { id: 'vault', name: 'Example vault', description: 'Mocked personal vault', owner_type: 'personal', company: null, my_role: 'owner', break_glass_until: null, entry_count: 1, archived_at: null, legal_hold: false, frozen: false, created_at: '2026-01-01', mine: true, can: { create_entry: true, edit_folders: true, rename: true, manage_members: true, remove_members: true, trash: true, archive: true, view_activity: true, appoint_owner: true } }
      let entries = [{ id: 'entry', vault: { id: 'vault', name: vault.name }, kind: 'login', title: 'Example entry', username: 'example', url: 'https://example.invalid', tags: [], folder: null, expires_on: null, updated_at: '2026-10-20', password_changed_at: null, version: 1, trashed_at: null, via: 'role', can: { reveal: true, edit: true, share: true, revoke: true, delete: true, move: true, history: true } }]
      let folders = []; let shares = []; let sentAlerts = []
      let preferences = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: true, sound_enabled: true, vibrate_enabled: true }
      const adminPerson = { ...me, status: 'active', companies: [], groups: [], mfa_enabled: false, employee_code: null, is_active: true, is_deleted: false }

      const managedUsers = [adminPerson]; let policy = { two_step_enforced: false, updated_at: null, updated_by: null }; let approvalDecided = false; const permissionGroups = []; const teamVaults = []; const ownerRequests = []; const teamMembers = [{ user: person, role: 'owner', super_owner: true, via_break_glass: false, added_by: person, added_at: '2026-01-01', expires_at: null }]; let emergency = []
      let fileRows = [{id:'file',name:'mock.pem',size:12,created_at:'2026-10-20',updated_at:'2026-10-20',created_by:me,previewable:true}]; let fileRenameAllowed=true; let delayedPreview=false; let previewReply; let previewRequested=false
      let holdDownload=false;let downloadRequested=false;let downloadReply

      let chatPolicy={mode:'all',can_create_groups:true,allowed_count:0};let allowedPeople=[]

      let deviceRows=[{id:'mock-device',device_label:'Mock tablet',auth_method:'password',created_at:'2026-01-01',last_seen_at:'2026-10-20'}]; let approvalRows=[]

      const pendingApproval = { id: 'approval', kind: 'reactivate', label: 'Reactivate person', target: null, requested_by: me, reason: '', status: 'pending', created_at: '2026-10-20', expires_at: '2026-10-21', decided_by: null, decided_at: null, can: { decide: false, cancel: true } }
      const members = [{ user: { ...person, id: 'me', name: 'Example Tester' }, role: 'owner', can_send: true, joined_at: '2026-01-01', is_me: true }, { user: person, role: 'member', can_send: true, joined_at: '2026-01-01', is_me: false }]
      const conversation = { id: 'chat', kind: 'group', title: 'Example conversation', avatar_url: null, peer: person, member_count: 2, last_message: null,
        restricted_company: null, send_mode: 'everyone', send_block: null, notify_preview: null, last_seq: 1, last_read_seq: 0, unread_count: 1,
        mention_unread: false, muted_until: null, pinned_at: null, archived_at: null, left: false, updated_at: '2026-10-20T06:00:00Z',
        can: { send: true, send_file: true, edit_info: true, manage_members: true, leave: true, set_disappearing: true }, disappearing_seconds: 0 }
      page.on('pageerror', e => runtimeErrors.push(e.message))
      page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) runtimeErrors.push(message.text()) })
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) { unexpected.push(url.origin); return route.abort() }
        return route.continue()
      })
      await page.routeWebSocket('**/ws/', socket => {
        socketClient = socket; socket.send(JSON.stringify({ type: 'HELLO', data: {} }))
        socket.onMessage(data => { if (JSON.parse(data).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) })
      })
      await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
        const send = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers })
        if (path === '/api/jm/auth/recovery-codes/regenerate/') { recoveryRequested = true; await new Promise(resolve => { recoveryReply = resolve }); return send({ recovery_codes: ['MOCK_DELAYED_RECOVERY'] }) }
        if (path === '/api/jm/conversations/chat/' && method === 'GET' && denied) return send({ code: 'forbidden' }, 403)
        let body = {}
        if (req.headers()['content-type']?.includes('application/json')) body = req.postDataJSON() || {}
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          assert.equal(req.headers()['x-csrftoken'], 'mock-csrf', `Missing CSRF on ${path}`)
          mutations.push({ path, method, body })
        }
        if(path==='/api/jm/media/export-mock.bin'){attachmentDownloads++;if(holdAttachment){attachmentRequested=true;await new Promise(resolve=>releaseAttachment=resolve)}return route.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.from('SYNTHETIC_ATTACHMENT')}).catch(()=>{})}
        if (path === '/api/jm/media/mock.wav') return route.fulfill({ status: 200, contentType: 'audio/wav', body: mockWave() })
        if (path === '/api/jm/auth/csrf/') return send({}, 200, { 'set-cookie': 'jm_csrftoken=mock-csrf; Path=/; SameSite=Lax' })
        if (path === '/api/jm/appearance/') return send(appearance)
        if (path === '/api/jm/admin/appearance/') { appearance=method==='DELETE'?{type:'default',color:null,image_url:null,updated_at:'2026-10-20'}:{...appearance,...body,image_url:body.type==='image'?'/api/jm/media/mock.png':appearance.image_url}; return send(appearance) }
        if (path === '/api/jm/me/avatar/') { me.avatar_url=method==='DELETE'?null:'/api/jm/media/mock.png';return send({}) }
        if (path === '/api/jm/media/mock.png') return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC8sAAAAASUVORK5CYII=','base64')})
        if(path==='/api/jm/uploads/synthetic-image/'&&method==='DELETE')return send({})
        if (path === '/api/jm/uploads/' && method==='POST') { const multipart=req.postDataBuffer().toString(); assert.match(multipart,/name="purpose"/);assert.match(multipart,/avatar|background|group_avatar|attachment/);return send({id:'synthetic-image',status:'ready',scan_status:'clean',kind:'image',name:'synthetic.png',mime:'image/png',size:68,preview_url:'/api/jm/media/mock.png',thumb_url:'/api/jm/media/mock.png',download_url:'/api/jm/media/mock.png'}) }
        if(path==='/api/jm/admin/users/new-user/set-password/')return passwordPending?send({approval:{...pendingApproval,kind:'reset_password'}},202):send(managedUsers[1])
        if (path === '/api/jp/unlock/') {unlockCalls++;return vaultVerified?send({unlocked:true,expires_at:null}):send({code:'step_up_required',scope:'jp',methods:['password']},403)}
        if (path === '/api/jm/auth/mfa/') return send(me.security)
        if (path === '/api/jm/auth/options/') return send({ passkey_sign_in: false })
        if (path === '/api/jm/auth/login/') { signedIn = true; return send({ status: 'ok' }) }
        if (path === '/api/jm/auth/logout/') { signedIn = false; return send({ status: 'ok' }) }
        if (path === '/api/jm/me/security-notices/' && method === 'GET') return send({ results: [], next_cursor: null, unavailable_count: 0 })
        if (path === '/api/jm/me/' && method === 'GET') return signedIn ? send(me) : send({ detail: 'Sign in' }, 401)
        if (path === '/api/jm/me/' && method === 'PATCH') {
          if (!verified) return send({ code: 'step_up_required', scope: 'security_settings', methods: stepMethods }, 403)
          Object.assign(me, body); return send(me)
        }
        if(path==='/api/jm/auth/step-up/options/')return send({methods:body.scope==='app_unlock'?['passkey','password']:stepMethods,passkey:(body.scope==='app_unlock'||stepMethods.includes('passkey'))?{flow:'synthetic-flow',options:{challenge:'AQIDBAUGBwgJCgsMDQ4PEA',rpId:'localhost',allowCredentials:[],userVerification:'preferred'}}:null})
        if (path === '/api/jm/approvals/') { const items = approvalDecided ? [] : [{ kind: 'admin', id: 'approval-1', title: 'Reset two-step verification', subject: 'Example Colleague', reason: 'Lost phone', status: 'pending', requested_by: { id: 'peer', name: 'Example Colleague' }, requested_at: '2026-11-01T10:00:00Z', expires_at: null, decided_by: null, decided_at: null, can: { decide: true, cancel: false }, actions: { approve: '/api/jm/admin/approvals/approval-1/approve/', deny: '/api/jm/admin/approvals/approval-1/deny/', cancel: '/api/jm/admin/approvals/approval-1/cancel/' }, link: '/admin?tab=approvals' }]; return send({ results: items, waiting_on_me: items.length }) }
        if (path === '/api/jm/admin/approvals/approval-1/approve/' && method === 'POST') { approvalDecided = true; return send({ status: 'approved' }) }
        if (path === '/api/jm/auth/step-up/') { if(body.scope==='jp')vaultVerified=true;verified = true; return send({ status: 'ok' }) }
        if (path === '/api/jm/search/messages/') return send({ results: messages.filter(m => m.body.includes(url.searchParams.get('q'))).map(m => ({ message: m, conversation: { id: 'chat', title: 'Example conversation', kind: 'direct' } })), next_cursor: null })
        if (path === '/api/jm/conversations/chat/polls/') { const msg = { ...message('poll-' + messages.length, messages.length + 1, '', true), kind: 'poll', poll: { question: body.question, options: body.options.map((text, index) => ({ id: 'o' + index, text, votes: 0, me: false })), allow_multiple: body.allow_multiple, voters: 0, total_votes: 0 } }; messages.push(msg); return send(msg) }
        if (/^\/api\/jm\/messages\/[^/]+\/poll-votes\/$/.test(path)) return send([{ id: 'o0', text: 'First choice', users: [person] }])
        if (path === '/api/jm/users/peer/') return send({ ...person, full_name: person.name, bio: 'Synthetic colleague profile', email: 'peer@example.invalid', phone: null, companies: [] })
        if (/^\/api\/jm\/messages\/[^/]+\/forward\/$/.test(path)) return send({})
        if (path === '/api/jm/conversations/') return send({ results: [conversation], next_cursor: null })
        if (path === '/api/jm/conversations/chat/') { if (method === 'PATCH') {Object.assign(conversation, body);if('avatar_upload_id' in body)conversation.avatar_url=body.avatar_upload_id?'/api/jm/media/mock.png':null;} return send({ ...conversation, my_role: 'owner', description: '', created_at: '2026-01-01', visible_from_seq: 1, is_owner: true }) }
        if (path === '/api/jm/conversations/chat/members/') { if (method === 'POST') body.user_ids.forEach(id => members.push({ user: { ...person, id, name: 'New Example Member' }, role: 'member', can_send: true, joined_at: '2026-01-01', is_me: false })); return send({ results: members }) }
        if (path === '/api/jm/conversations/chat/members/peer/') { if (method === 'PATCH') members[1].role = body.role; return send({ results: members }) }
        if (path === '/api/jm/users/presence/') return send({results:{peer:{online:true,last_seen_at:null}}})
        if (/^\/api\/jm\/messages\/[^/]+\/info\/$/.test(path)) return send({sent_at:'2026-10-20T06:00:00Z',read_by:[{...person,read:true,delivered:true,read_at:'2026-10-20T06:01:00Z',delivered_at:null}],delivered_to:[],pending:[]})
        if (/^\/api\/jm\/messages\/[^/]+\/reactions\/$/.test(path)) return send([{emoji:'👍',users:[person]}])
        if (path === '/api/jm/users/') return send({ results: [{ ...person, id: 'new-member', name: 'New Example Member' }], next_cursor: null })
        if (path === '/api/jm/conversations/chat/send-mode/') { conversation.send_mode = body.mode; return send({ send_mode: body.mode, results: members }) }
        if (path === '/api/jm/conversations/chat/settings/') { Object.assign(conversation, body); return send(conversation) }
        if (path === '/api/jm/conversations/chat/shared/') return send({ results: url.searchParams.get('type') === 'docs' ? [{ message: { id: 'shared-doc', seq: 1, created_at: '2026-10-20T06:00:00Z', sender: person }, attachment: { ...audioAttachment, id: 'shared-document', name: 'Synthetic shared document.pdf', kind: 'file', mime: 'application/pdf' } }] : [], next_before: null })
        if (path === '/api/jm/conversations/chat/disappearing/') { conversation.disappearing_seconds = body.seconds; return send(conversation) }
        if (path === '/api/jm/messages/event-synthetic/event-response/') { const event = messages.find(m => m.id === 'event-synthetic').event; event.my_answer = method === 'DELETE' ? null : body.answer; event.counts.going = event.my_answer === 'going' ? 1 : 0; return send(event) }
        if (path === '/api/jm/messages/event-synthetic/event-answers/') return send([{ answer: 'going', users: [person] }])
        if (path === '/api/jm/conversations/chat/clear/') { messages = []; return send(conversation) }
        if (path === '/api/jm/conversations/chat/messages/' && method === 'GET') return send({ results: messages, mode: 'latest', oldest_seq: 1, newest_seq: messages.length, has_more_before: false, has_more_after: false, first_unread_seq: 1, last_read_seq: 0, last_seq: messages.length, visible_from_seq: 1, receipts: { read_seq: 0, delivered_seq: 0 }, server_time: new Date().toISOString() })
        if (path === '/api/jm/conversations/chat/messages/' && method === 'POST') {
          if(failNextSend)return route.abort('connectionfailed')
          const msg = message('sent-' + messages.length, messages.length + 1, body.body, true); messages.push(msg); return send(msg)
        }
        if (/\/conversations\/chat\/(read|delivered)\/$/.test(path)) return send({})
        if (/\/messages\/[^/]+\/reaction\/$/.test(path)) {
          const id = path.split('/')[4], msg = messages.find(m => m.id === id)
          if (msg) msg.reactions = method === 'DELETE' ? [] : [{ emoji: body.emoji, count: 1, me: true }]
          return send(msg?.reactions || [])
        }
        if (/\/messages\/[^/]+\/$/.test(path) && method === 'PATCH') {
          const msg = messages.find(m => m.id === path.split('/')[4]); msg.body = body.body; msg.edited_at = new Date().toISOString(); return send(msg)
        }
        if (/\/messages\/[^/]+\/$/.test(path) && method === 'DELETE') {
          messages = messages.filter(m => m.id !== path.split('/')[4]); return send({})
        }
        if (path === '/api/jm/auth/sessions/') return send([{ id: 'current-device', device_label: 'This test browser', auth_method: 'password', created_at: '2026-01-01', last_seen_at: '2026-10-20T06:00:00Z', ip_last: null, current: true }])
        if (path === '/api/jm/alerts/active/' || path === '/api/jm/alerts/') return send({ results: [], next_cursor: null })
        if (path === '/api/jm/admin/alerts/people/') return send({ results: [person], next_cursor: null })
        if (path === '/api/jm/admin/alerts/') { if (method === 'POST') { const alert = { ...body, id: 'alert', created_at: '2026-10-20', status: 'active', recipient_count: body.user_ids?.length || 1, cancelled_at: null }; sentAlerts.push(alert); return send(alert) } return send({ results: sentAlerts, next_cursor: null }) }
        if (path === '/api/jm/admin/alerts/alert/cancel/') { sentAlerts[0].status = 'cancelled'; return send(sentAlerts[0]) }
        if (path === '/api/jm/notifications/summary/') return send({ unread_conversations: 0, unread_messages: 0, unread_notifications: 0, mention_unread: false })
        if (path === '/api/jm/notifications/') return send({ results: notes.filter(n => url.searchParams.get('state') !== 'unread' || !n.read_at), next_cursor: null })
        if (path === '/api/jm/notifications/read/') { notes.forEach(n => { n.read_at = '2026-10-20' }); return send({}) }
        if (path === '/api/jm/notifications/delete/') { notes = notes.filter(n => !body.ids.includes(n.id)); return send({ removed: 1 }) }
        if (path === '/api/jm/me/notification-preferences/') { if (method === 'PATCH') Object.assign(preferences, body); return send(preferences) }
        if (path === '/api/jp/vaults/') { if(method==='POST') { const created={id:'team',...body,company:null,entry_count:0,owners:[person],owner_user:person,archived_at:null,frozen:false,my_role:null}; teamVaults.push(created); return send(created) } return send([vault]) }
        if(path==='/api/jp/vaults/vault/files/') {if(method==='PUT'){assert.equal(req.headers()['content-type'],'application/octet-stream');assert.equal(req.postDataBuffer().toString(),'MOCK UPLOAD');fileRows.push({id:'uploaded',name:decodeURIComponent(req.headers()['x-file-name']),size:11,created_by:me,previewable:true});return send(fileRows.at(-1))}return send({results:fileRows,can:{list:true,download:true,upload:true,rename:fileRenameAllowed,delete:true},max_bytes:1024})}
        if(path==='/api/jp/files/file/preview/'){if(delayedPreview){previewRequested=true;await new Promise(resolve=>previewReply=resolve)}return send({name:'mock.pem',text:delayedPreview?'MOCK_LATE_FILE':'MOCK_FILE_PREVIEW',expires_in:1})}
        if(path==='/api/jp/files/file/download/'){if(!verified)return send({code:'step_up_required',scope:'vault_download',methods:['password']},403);if(holdDownload){downloadRequested=true;await new Promise(resolve=>downloadReply=resolve)}return route.fulfill({status:200,contentType:'application/octet-stream',body:'MOCK DOWNLOAD'})}
        if(/^\/api\/jp\/files\/[^/]+\/$/.test(path)){const id=path.split('/')[4];if(method==='PATCH')fileRows.find(f=>f.id===id).name=body.name;if(method==='DELETE')fileRows=fileRows.filter(f=>f.id!==id);return send(fileRows.find(f=>f.id===id)||{})}
        if(path==='/api/jm/admin/companies/')return send([{id:'company',code:'EX',name:'Example Company',is_active:true,is_deleted:false}])
        if(path==='/api/jm/admin/memberships/'){assert.equal(body.company,'EX');managedUsers[1].companies.push({id:'membership',company:'EX',company_name:'Example Company',company_color:'#15803D',title:body.title,department:body.department,is_active:true,is_default:false});return send(managedUsers[1].companies.at(-1))}
        if(path==='/api/jm/admin/memberships/membership/'){const own=managedUsers[1].companies.find(m=>m.id==='membership');if(method==='DELETE')managedUsers[1].companies=managedUsers[1].companies.filter(m=>m!==own);else{if(body.is_default)managedUsers[1].companies.forEach(m=>{m.is_default=false});Object.assign(own,body)}return send({})}
        if(path==='/api/jm/admin/users/new-user/chat-access/'){if(method==='PUT')Object.assign(chatPolicy,body);return send(chatPolicy)}
        if(path==='/api/jm/admin/users/new-user/chat-access/allowed/'){if(method==='POST'){if(body.add)allowedPeople=body.add.map(id=>managedUsers.find(p=>p.id===id));if(body.remove)allowedPeople=allowedPeople.filter(p=>!body.remove.includes(p.id));chatPolicy.allowed_count=allowedPeople.length;return send(chatPolicy)}return send({results:allowedPeople,next_cursor:null})}

        if(path==='/api/jm/admin/users/new-user/sessions/')return send(deviceRows)
        if(path==='/api/jm/admin/users/new-user/sessions/mock-device/revoke/'){deviceRows=[];return send({})}
        if(path==='/api/jm/admin/approvals/')return send({results:approvalRows.filter(a=>url.searchParams.get('status')==='all'||a.status==='pending')})
        if(/^\/api\/jm\/admin\/approvals\/[^/]+\/(approve|deny|cancel)\/$/.test(path)){const row=approvalRows.find(a=>a.id===path.split('/')[5]);row.status=path.split('/')[6];row.can={decide:false,cancel:false};return send({...row,...(row.status==='approve'?{result:{link:'https://example.invalid/reset/MOCK_APPROVED'}}:{})})}

        if (path === '/api/jp/vaults/vault/folders/') { if (method === 'POST') folders.push({ id: 'folder', name: body.name, parent: body.parent }); return send(method === 'POST' ? folders.at(-1) : folders) }
        if (path === '/api/jp/vaults/vault/folders/folder/') { if (method === 'PATCH') folders[0].name = body.name; else if (method === 'DELETE') folders = []; return send(folders[0] || {}) }
        if (path === '/api/jp/people/') return send([{ id: 'peer', name: 'Example Colleague', email: 'colleague@example.invalid', is_active: true }, { id: 'peer-2', name: 'Example Second Owner', email: 'second@example.invalid', is_active: true }])
        if (path === '/api/jp/entries/entry/shares/') { const share = { id: 'share', grantee: { id: 'peer', name: 'Example Colleague' }, granted_by: { id: 'me', name: 'Example Tester' }, granted_at: '2026-10-20', expires_at: body.expires_at || null }; shares.push(share); return send(share) }
        if (path === '/api/jp/entries/entry/shares/share/') { shares = []; return send({}) }
        if (path === '/api/jp/entries/entry/move/') { entries[0].folder = body.folder; return send(entries[0]) }
        if (path === '/api/jp/entries/' && method === 'GET') return send({ results: entries.filter(e => url.searchParams.get('trashed') === '1' ? e.trashed_at : !e.trashed_at), next_cursor: null })
        if (path === '/api/jp/entries/' && method === 'POST') { const entry = { ...entries[0], ...body, id: 'entry-new', vault: entries[0].vault }; delete entry.secret; entries.push(entry); return send(entry) }
        if (/^\/api\/jp\/entries\/[^/]+\/$/.test(path)) { const entry = entries.find(e => e.id === path.split('/')[4]); if (method === 'PATCH') { const { secret, ...metadata } = body; Object.assign(entry, metadata) } return send({ ...entry, versions: [{ version: 1, current: true, shredded: false, created_at: '2026-10-20' }, { version: 0, current: false, shredded: false, created_at: '2026-10-19' }], shares, secret_fields: ['password'] }) }
        if (path === '/api/jp/entries/entry/copy-event/') return send({})
        if (path === '/api/jp/entries/entry/reveal/') return send({ field: 'password', value: 'MOCK_REVEAL_ONLY', version: 1, expires_in: 1 })
        if (path === '/api/jp/entries/entry/trash/') { entries[0].trashed_at = '2026-10-20'; return send(entries[0]) }
        if (path === '/api/jp/entries/entry/restore/') { entries[0].trashed_at = null; return send(entries[0]) }
        if (path === '/api/jm/admin/users/') { if (method === 'POST') { const created = { ...adminPerson, id:'new-user', name:body.full_name, full_name:body.full_name, email:body.email, has_password:false, is_deleted:false, groups:[] }; managedUsers.push(created); return send({ ...created, invite_link:'https://example.invalid/invite/MOCK_ONLY', password_set:false }) } return send({count:managedUsers.length,next:null,previous:null,results:managedUsers}) }
        if (path === '/api/jm/admin/users/group-options/') return send([{name:'Team access',grantable:true},{name:'Protected access',grantable:false}])
        if (path === '/api/jm/admin/users/new-user/') return send(managedUsers[1])
        if (path === '/api/jm/admin/users/new-user/deactivate/') { managedUsers[1].is_active=false; managedUsers[1].status='inactive'; return send(managedUsers[1]) }
        if (path === '/api/jm/admin/users/new-user/activate/') return send({ approval:pendingApproval },202)
        if (path === '/api/jm/admin/users/new-user/groups/') { managedUsers[1].groups=body.groups; return send(managedUsers[1]) }
        if (path === '/api/jm/admin/capabilities/') return send([{key:'JM_ACCESS',label:'Messenger access',held:true},{key:'JP_MANAGE_VAULT',label:'Manage vaults',held:false}])
        if (path === '/api/jm/admin/groups/') { if(method==='POST') { const group={id:'new-group',...body,built_in:false,can_edit:true,can_manage_members:true,member_count:0,created_at:'2026-10-20'}; permissionGroups.push(group); return send(group) } return send(permissionGroups) }
        if (path === '/api/jm/admin/security-policy/') { if(method==='PUT') { if(!body.two_step_enforced) return send({approval:{...pendingApproval,kind:'two_step_off'}},202); policy.two_step_enforced=true } return send(policy) }
        if (path === '/api/jm/companies/') return send([{id:'company',code:'EX',name:'Example Company'}])
        if (path === '/api/jp/admin/vaults/') return send([...teamVaults,{id:'emergency-vault',name:'Emergency example',owner_type:'shared',company:null,entry_count:0,owners:[],owner_user:null,archived_at:null,frozen:false,my_role:null}])
        if (path === '/api/jp/owner-requests/pending/' || path === '/api/jp/vaults/team/owner-requests/') return send(ownerRequests)
        if (path === '/api/jp/vaults/team/members/') { if(method==='POST') { const request={id:'owner-request',vault:{id:'team',name:'Mock team vault'},user:{...person,id:body.user_id},action:'appoint',requested_by:me,reason:'',status:'pending',requested_at:'2026-10-20',decided_by:null,decided_at:null,can:{decide:false,cancel:true}}; ownerRequests.push(request); return send({status:'pending',request},202) } return send(teamMembers) }
        if (path === '/api/jp/audit/') return send({results:[{id:7,at:'2026-10-20',action:'vault_created',actor:person,outcome:'success',ip:null,details:{}}],next_cursor:null})
        if (path === '/api/jp/vaults/vault/') { if(method==='PATCH') vault.name=body.name; return send(vault) }
        if (path === '/api/jp/vaults/vault/archive/') { vault.archived_at=body.archived?'2026-10-20':null; return send(vault) }
        if (path === '/api/jp/break-glass/') { if(method==='POST') { const request={id:'emergency-request',vault:{id:body.vault_id,name:'Emergency example',owner_type:'shared'},requested_by:me,reason:body.reason,requested_at:'2026-10-20',approved_by:null,approved_at:null,denied_at:null,expires_at:null,status:'pending',can:{decide:false,revoke:false}}; emergency.push(request); return send(request) } return send(emergency) }
        if (path === '/api/jm/admin/users/me/' && method === 'PATCH') { Object.assign(adminPerson, body); return send(adminPerson) }
        if (path === '/api/jm/auth/invitations/accept/' || path === '/api/jm/auth/password/reset/') { if (method === 'GET') return send({ valid: url.searchParams.get('token') === 'mock-token', email: 'tester@example.invalid', full_name: 'Example Tester' }); signedIn = true; return send({ status: 'ok' }) }
        // Ask Atlas is opt-in during the beta (backend BE-102): this mocked person is not an Atlas tester.
        if (path === '/api/jm/atlas/status/') return send({ enabled: true, allowed: false, message: null })
        unexpected.push(method + ' ' + path); return send({ detail: 'Unmocked endpoint' }, 501)
      })
      await page.goto(base + '/login')
      await page.getByLabel('Email', { exact: true }).fill('tester@example.invalid')
      await page.getByLabel('Password', { exact: true }).fill('mock-only-password')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.getByRole('button', { name: 'Open Example conversation', exact: true }).click()
      await page.getByText('Hello from the mocked API', { exact: true }).waitFor()
      await exportFromActions(page,'Example audio.wav')
      const attachmentDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Confirm attachment export',exact:true}).click();assert.equal((await attachmentDownload).suggestedFilename(),'export-Example_audio.wav');await page.getByRole('button',{name:'Close attachment export',exact:true}).click()
      await page.evaluate(()=>{window.attachmentURLs=0;const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.attachmentURLs++;return create(blob)}})
      await exportFromActions(page,'Example audio.wav');holdAttachment=true;await page.getByRole('button',{name:'Confirm attachment export',exact:true}).click();await expect.poll(()=>attachmentRequested).toBe(true);await page.getByRole('button',{name:'Cancel attachment export',exact:true}).click();releaseAttachment();holdAttachment=false;assert.equal(await page.evaluate(()=>window.attachmentURLs),0)
      await exportFromActions(page,'Example audio.wav');messages[0].deleted=true;await page.getByRole('button',{name:'Confirm attachment export',exact:true}).click();await page.getByText('This attachment is no longer available.',{exact:true}).waitFor();assert.equal(attachmentDownloads,2);messages[0].deleted=false;await page.getByRole('button',{name:'Close attachment export',exact:true}).click()

      await page.getByRole('button', { name: 'Open media Example audio.wav', exact: true }).click()
      await page.getByRole('button', { name: 'Play audio', exact: true }).click()
      await page.getByRole('button', { name: 'Pause audio', exact: true }).click()
      messages[0] = { ...messages[0], deleted: true, attachments: [] }
      socketClient.send(JSON.stringify({ type: 'MESSAGE_DELETED', data: { conversation: 'chat', id: 'first', seq: 1, updated_at: '2026-10-20T07:00:00Z' } }))
      await page.getByRole('button', { name: 'Close media', exact: true }).waitFor({ state: 'hidden' })
      for (let seq = 2; seq <= 25; seq++) { const incoming = message('reader-' + seq, seq, 'Reader sample ' + seq); messages.push(incoming); socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: incoming })) }
      await expect(page.getByText('Reader sample 25', { exact: true })).toBeInViewport().catch(async error => { console.log('READER_GEOMETRY', await page.getByText('Reader sample 25', { exact: true }).evaluate(node => { const result = []; for (let n = node; n; n = n.parentElement) result.push({ tag: n.tagName, height: n.clientHeight, scroll: n.scrollHeight, top: n.scrollTop, y: n.getBoundingClientRect().y, overflow: getComputedStyle(n).overflowY }); return result })); console.log('INDICATOR', await page.getByRole('button', { name: 'New messages \u2014 jump to latest', exact: true }).count()); await page.screenshot({ path: 'test-results/reader-failure.png' }); throw error })
      await page.getByText('Reader sample 25', { exact: true }).hover()
      await page.getByText('Reader sample 25', { exact: true }).evaluate(node => { let scroll = node.parentElement; while (scroll && !(scroll.scrollHeight > scroll.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement; if (!scroll) throw Error('Message scroll container missing'); scroll.scrollTop = 0; scroll.dispatchEvent(new Event('scroll')) })
      await expect(page.getByText(/^(This message was deleted|You deleted this message)$/)).toBeInViewport()
      await page.getByLabel('Message history', { exact: true }).waitFor()
      const incoming = message('reader-26', 26, 'Arrival while reading history'); messages.push(incoming); socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: incoming }))
      await page.getByRole('button', { name: 'New messages \u2014 jump to latest', exact: true }).waitFor()
      await expect(page.getByText(/^(This message was deleted|You deleted this message)$/)).toBeInViewport()
      await page.getByRole('button', { name: 'New messages \u2014 jump to latest', exact: true }).click()
      await expect(page.getByText('Arrival while reading history', { exact: true })).toBeInViewport()
      socketClient.send(JSON.stringify({type:'TYPING_STARTED',data:{conversation:'chat',user:'peer'}}))
        await page.getByText('Example is typing\u2026',{exact:true}).waitFor()
        socketClient.send(JSON.stringify({type:'TYPING_STOPPED',data:{conversation:'chat',user:'peer'}}))
        await page.getByLabel('Message',{exact:true}).fill('@Example')
        await page.getByRole('button',{name:'Mention Example Colleague',exact:true}).click()
        await expect(page.getByLabel('Message',{exact:true})).toHaveValue('@Example Colleague ')
        failNextSend=true
        await page.getByLabel('Message', { exact: true }).fill('Mocked text message')
      await page.getByRole('button', { name: 'Send message', exact: true }).click()
      await expect(page.getByText('Waiting for network \u00b7 sends automatically', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Discard queued message', exact: true })).toBeVisible()
      failNextSend=false
        await expect.poll(() => mutations.filter(m => m.path.endsWith('/messages/') && m.method === 'POST').length).toBeGreaterThanOrEqual(2)
        await page.getByText('Mocked text message', { exact: true }).waitFor()
        const retries=mutations.filter(m=>m.path.endsWith('/messages/')&&m.method==='POST');assert.equal(retries[0].body.client_id,retries[1].body.client_id)
      const post = mutations.find(m => m.path.endsWith('/messages/') && m.method === 'POST')
      assert.match(post.body.client_id, /^[0-9a-f-]{36}$/)
      await page.getByRole('button', { name: 'Message actions', exact: true }).last().click()
      await page.getByRole('button',{name:'Message information',exact:true}).click()
        await page.getByText('Read by',{exact:true}).waitFor()
        await page.getByText('Reactions',{exact:true}).waitFor()
        await page.getByRole('button',{name:'Close message information',exact:true}).click()
        await page.getByLabel('Message', { exact: true }).fill('Draft before editing')
        await page.getByRole('button',{name:'Message actions',exact:true}).last().click()
        await page.getByRole('button', { name: 'Edit message', exact: true }).click()
      await page.getByLabel('Message', { exact: true }).fill('Edited mocked message')
      await page.getByRole('button', { name: 'Save edit', exact: true }).click()
      await page.getByText('Edited mocked message', { exact: true }).waitFor()
      await expect(page.getByLabel('Message', { exact: true })).toHaveValue('Draft before editing')
      await page.getByLabel('Message', { exact: true }).fill('')
      await captureTests.capture(page,height)
      const sendBounds = await page.getByRole('button', { name: /^(Send message|Record a voice message|Hold to record a voice message)$/ }).boundingBox()
      assert.ok(sendBounds && sendBounds.y + sendBounds.height <= height, 'Composer is reachable inside the viewport');assert.ok(sendBounds.height<=52,'Send label fits without excessive wrapping')
      await page.getByRole('button', { name: 'Attach', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Poll', exact: true }).click()
      await page.getByLabel('Poll question', { exact: true }).fill('Mock poll question')
      await page.getByLabel('Poll choices (one per line)', { exact: true }).fill('First choice\nSecond choice')
      await page.getByRole('button', { name: 'Send poll', exact: true }).click()
      await page.getByText('Mock poll question', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'View votes (0)', exact: true }).click()
      await page.getByRole('button', { name: 'Example Colleague', exact: true }).click()
      await page.getByText('Synthetic colleague profile', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Close profile', exact: true }).click()
      await page.getByRole('button', { name: 'Conversation options', exact: true }).click()
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByLabel('Search messages', { exact: true }).fill('Edited mocked')
      await page.getByRole('button', { name: 'Find messages', exact: true }).click()
      await page.getByRole('button', { name: 'Jump to message', exact: true }).click()
      await page.getByRole('button', { name: 'Close search', exact: true }).waitFor({ state: 'hidden' })
      await expect(page.getByText('Edited mocked message', { exact: true })).toBeInViewport()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Messenger overflow at ' + width)
      await page.getByRole('button', { name: 'Close actions', exact: true }).waitFor({ state: 'hidden' })
      await page.screenshot({ path: `test-results/messenger-mocked-${width}.png`, fullPage: true })
      if (width === 360) await require('./scripts/special-message-ui.cjs')(page, { base, person, message, getMessages: () => messages, setMessages: value => { messages = value } })
      const eventMessage = { ...message('event-synthetic', messages.length + 1, ''), kind: 'event', event: { title: 'Synthetic team event', starts_at: '2027-01-01T12:00:00Z', ends_at: null, place: 'Synthetic room', description: 'Event response test', counts: { going: 0, maybe: 0, not_going: 0 }, my_answer: null }, can: { ...message('x', 1, '').can, respond: true } }
      messages.push(eventMessage); socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: eventMessage }))
      const latest = page.getByRole('button', { name: /^(New messages ? jump to latest|Jump to latest)$/ }); if (await latest.isVisible()) await latest.click()
      await page.getByRole('button', { name: 'Going (0)', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Going (1) selected', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'View event responses', exact: true }).click()
      await expect(page.getByText('Example Colleague', { exact: true }).last()).toBeVisible()
      await page.getByRole('button', { name: 'Close event responses', exact: true }).click()
      // Reference: Lock chat lives in the chat's profile/details settings, not in the header menu.
      await page.getByRole('button', { name: /, (profile|group info)$/ }).first().click()
      await page.getByRole('button', { name: 'Lock chat', exact: true }).click()
      await expect.poll(() => conversation.locked).toBe(true)
      if (page.url().includes('/group-info')) await page.goBack()
      else for (const close of ['Close profile', 'Close conversation details']) { const b = page.getByRole('button', { name: close, exact: true }); if (await b.isVisible().catch(() => false)) { await b.click(); break } }
      await page.getByRole('button', { name: 'Conversation options', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Conversation options', exact: true }).click()
      await page.getByRole('button', { name: 'Hide locked chats', exact: true }).click()
      await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Synthetic team event', { exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Unlock', exact: true }).click()
      await page.getByLabel('Message', { exact: true }).waitFor()
      await page.getByRole('button', { name: /, (profile|group info)$/ }).first().click()
      await page.getByRole('button', { name: 'Unlock chat', exact: true }).click()
      await expect.poll(() => conversation.locked).toBe(false)
      if (page.url().includes('/group-info')) { await page.goBack(); await page.getByRole('button', { name: 'Conversation options', exact: true }).waitFor() }
      // Reference: group info opens from the chat header title.
      await page.getByRole('button', { name: /, group info$/ }).first().click()
      await page.getByRole('tab', { name: 'Docs', exact: true }).click()
      await expect(page.getByText('Synthetic shared document.pdf', { exact: true })).toBeVisible()
      // Group settings live on their own page like WhatsApp: /group-info -> "Edit group" -> /group-edit (decision U-019).
      // Both are routes with a page header whose only way back is the "Back" button.
      const onPage=async(path,heading)=>{await page.waitForURL(u=>new URL(u).pathname===path);await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible()}
      const pageBack=async()=>{await page.getByRole('button',{name:'Back',exact:true}).click()}
      const groupSettings=async()=>{await onPage('/group-info','Group info');await page.getByRole('button',{name:'Edit group',exact:true}).click();await onPage('/group-edit','Edit group');await page.getByLabel('Group title',{exact:true}).waitFor()}
      const backToInfo=async()=>{await pageBack();await onPage('/group-info','Group info')}
      const memberAction=async(person,name)=>{const action=page.getByRole('button',{name,exact:true});if(!(await action.isVisible()))await page.getByRole('button',{name:`Actions for ${person}`,exact:true}).click();await action.click()}
      await groupSettings()
      await captureTests.groupPhoto(page)
      await expect(page.getByLabel('Group title', { exact: true })).toHaveValue('Example conversation')
      await expect(page.getByRole('button', { name: 'Save group information', exact: true })).toBeDisabled()
      await page.getByLabel('Group title', { exact: true }).fill('Updated example group')
      await expect(page.getByRole('button', { name: 'Save group information', exact: true })).toBeEnabled()
      await page.getByRole('button', { name: 'Save group information', exact: true }).click()
      await expect.poll(()=>conversation.title).toBe('Updated example group')
      assert.equal(mutations.filter(m=>m.path==='/api/jm/conversations/chat/'&&m.method==='PATCH'&&m.body.title==='Updated example group').length, 1)
      // A successful save returns to group info (the edit page closes itself).
      await onPage('/group-info','Group info')
      await memberAction('Example Colleague','Make Example Colleague an admin')
      await page.getByRole('button', { name: 'Confirm conversation change', exact: true }).click()
      await expect.poll(()=>mutations.filter(m=>m.path.includes('/members/')&&m.method==='PATCH').length).toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Add group members', exact: true }).click()
      await page.getByRole('button', { name: 'New Example Member', exact: true }).click()
      await page.getByRole('button', { name: 'Add 1 members', exact: true }).click()
      await page.getByRole('button', { name: "View New Example Member's profile", exact: true }).waitFor()
      assert.equal(mutations.find(m => m.path.endsWith('/members/') && m.method === 'POST').body.share_history, 'none')
      await groupSettings()
      // The edit page loads fresh data: the saved title and the member added above.
      await expect(page.getByLabel('Group title', { exact: true })).toHaveValue('Updated example group')
      await expect(page.getByRole('button', { name: 'Save group information', exact: true })).toBeDisabled()
      await expect(page.getByRole('radio',{name:'Everyone can send',exact:true})).toBeChecked()
      await page.getByRole('radio',{name:'Selected members can send',exact:true}).click()
      await page.getByLabel('Allow sender New Example Member',{exact:true}).check()
      await page.getByRole('button',{name:'Save permissions',exact:true}).click()
      await expect.poll(()=>mutations.filter(m=>m.path.endsWith('/send-mode/')).length).toBe(1)
      assert.deepEqual(mutations.find(m=>m.path.endsWith('/send-mode/')).body,{mode:'selected',sender_ids:['new-member']})
      await page.getByText('Messaging permissions saved', { exact: true }).waitFor()
      await expect(page.getByRole('button',{name:'Save permissions',exact:true})).toBeDisabled()
      await backToInfo()
      await pageBack()
      await page.waitForURL(u=>new URL(u).pathname==='/messenger')
      await page.getByRole('button', { name: 'Conversation options', exact: true }).waitFor()
      // Back in the chat, the header shows the saved title (the workspace refreshes on focus).
      await page.getByRole('button', { name: 'Updated example group, group info', exact: true }).first().waitFor()
      // Disappearing messages and mute live in group info "Chat settings" (ChatProfileSettings, WhatsApp-style like
      // U-019); only "Clear chat for me" stays in the chat header menu.
      await page.getByRole('button', { name: 'Updated example group, group info', exact: true }).first().click()
      await onPage('/group-info','Group info')
      await page.getByRole('button', { name: 'Disappearing messages', exact: true }).click()
      await page.getByRole('radio', { name: '24 hours', exact: true }).click()
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      await expect.poll(() => conversation.disappearing_seconds).toBe(86400)
      await page.getByRole('button', { name: 'Disappearing messages', exact: true }).click()
      await expect(page.getByRole('radio', { name: '24 hours', exact: true })).toBeChecked()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Mute notifications', exact: true }).click()
      await page.getByRole('radio', { name: 'For 8 hours', exact: true }).click()
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      await expect.poll(() => Boolean(conversation.muted_until)).toBe(true)
      await page.getByRole('button', { name: 'Mute notifications', exact: true }).click()
      await expect(page.getByRole('radio', { name: 'Keep current mute', exact: true })).toBeChecked()
      await page.getByRole('radio', { name: 'Unmute', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await pageBack()
      await page.waitForURL(u=>new URL(u).pathname==='/messenger')
      await page.getByRole('button', { name: 'Conversation options', exact: true }).click()
      await page.getByRole('button', { name: 'Clear chat for me', exact: true }).click()
      expect(await page.getByLabel(/^Message from /).count()).toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Clear chat', exact: true }).click()
      // Like the reference MessageList, a cleared thread is simply empty (no "No messages yet." placeholder since 2e4a6d4).
      await expect(page.getByLabel(/^Message from /)).toHaveCount(0)
      const restricted = message('restricted', 1, 'Restricted example'); restricted.attachments = [audioAttachment]; messages = [restricted]; socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: restricted }))
      await page.getByRole('button', { name: 'Open media Example audio.wav', exact: true }).click()
      await page.getByRole('button', { name: 'Close media', exact: true }).waitFor()
      denied = true; socketClient.send(JSON.stringify({ type: 'MEMBER_REMOVED', data: { conversation: 'chat', user_id: 'me' } }))
      await page.getByRole('button', { name: 'Open Updated example group', exact: true }).waitFor()
      await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Close media', exact: true })).toHaveCount(0)
      // Profile is a list of collapsed sections (ProfileSection, since 2e4a6d4): open them all before using their fields.
      const expandProfile=async()=>{await page.getByRole('button',{name:'Your details',exact:true}).waitFor();for(const title of ['Your details','Access','Two-step verification','Security notices','Password','Signed-in devices','Chat background','This device']){const section=page.getByRole('button',{name:title,exact:true});if(await section.count()&&await section.first().getAttribute('aria-expanded')!=='true'){await section.first().click();await expect(section.first()).toHaveAttribute('aria-expanded','true')}}}
      await page.getByRole('link', { name: /^Profile: / }).last().click()
      await expandProfile()
      await page.getByLabel('Display name').waitFor()
      await page.getByRole('link',{name:'Home',exact:true}).click()
        await page.getByRole('link',{name:'Profile & security',exact:true}).waitFor()
        await page.screenshot({path:'test-results/home-mocked-'+width+'.png',fullPage:true})
        await page.getByRole('link',{name:'Profile & security',exact:true}).click()
        await expandProfile()
        await page.getByLabel('Display name').fill('Updated Example Tester')
      await page.getByRole('button', { name: 'Save profile', exact: true }).click()
      await page.getByRole('button', { name: 'Verify password', exact: true }).waitFor()
      await page.getByLabel('Current password', { exact: true }).last().fill('mock-only-password')
      await page.getByRole('button', { name: 'Verify password', exact: true }).click()
      await page.getByText('Profile updated.', { exact: true }).waitFor()
      assert.equal(me.display_name, 'Updated Example Tester')
      await page.getByLabel('Chat background color',{exact:true}).fill('#DCEFE3')
      await page.getByRole('button',{name:'Review background color',exact:true}).click()
      await page.getByRole('button',{name:'Confirm image change',exact:true}).click()
      await expect.poll(()=>appearance.color).toBe('#DCEFE3')
      await page.getByRole('button',{name:'Confirm image change',exact:true}).waitFor({state:'hidden'})
      const photoChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose profile photo',exact:true}).click();await (await photoChooser).setFiles({name:'synthetic.png',mimeType:'image/png',buffer:await captureTests.png(page)})
      await captureTests.editor(page,'Edit selected image')
      await page.getByRole('button',{name:'Confirm image change',exact:true}).click()
      await page.getByLabel('Current profile photo',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Remove profile photo',exact:true}).click()
      await page.getByRole('button',{name:'Confirm image change',exact:true}).click()
      await page.getByLabel('Current profile photo',{exact:true}).waitFor({state:'hidden'})
      await captureTests.profileLifecycleAndInstall(page)
      await page.evaluate(()=>window.credentialMock.mode='success');await page.getByRole('button',{name:'Turn on app lock',exact:true}).click();await page.getByRole('button',{name:'Turn off app lock',exact:true}).waitFor();
      await page.reload();await page.getByText('JM is locked',{exact:true}).waitFor();await page.getByLabel('App unlock password',{exact:true}).fill('mock-only-password');await page.getByRole('button',{name:'Unlock JM',exact:true}).click();await page.getByText('JM is locked',{exact:true}).waitFor({state:'hidden'});await page.getByRole('link',{name:/^Profile: /}).last().click();await expandProfile();await page.getByRole('button',{name:'Turn off app lock',exact:true}).waitFor();await page.getByRole('button',{name:'Turn off app lock',exact:true}).click();await page.getByRole('button',{name:'Turn on app lock',exact:true}).waitFor();

      for(const mode of ['success','cancel','pending']){verified=false;stepMethods=['passkey','password'];const calls=await page.evaluate(()=>window.credentialMock.calls);await page.evaluate(mode=>window.credentialMock.mode=mode,mode);await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.credentialMock.calls)).toBe(calls+1);if(mode==='pending'){await page.getByRole('button',{name:'Use your password instead',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.credentialMock.cancelled)).toBeGreaterThan(0)}if(mode!=='success'){await page.getByRole('button',{name:'Verify password',exact:true}).waitFor();await expect(page.getByText('The passkey could not be used.',{exact:true})).toHaveCount(0);await page.locator('input[aria-label="Current password"]:visible').last().fill('mock-only-password');await page.getByRole('button',{name:'Verify password',exact:true}).click()}await expect.poll(()=>verified).toBe(true);await expect(page.getByText('Profile updated.',{exact:true})).toBeVisible()}
      verified=false;stepMethods=['passkey'];await page.evaluate(()=>window.credentialMock.mode='cancel');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('button',{name:'Verify with passkey',exact:true}).waitFor();await expect(page.getByRole('button',{name:'Verify password',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();stepMethods=['password'];verified=true;

      await page.getByRole('button', { name: 'Regenerate recovery codes', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm', exact: true }).click()
      await expect.poll(() => recoveryRequested).toBe(true)
      await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) })
      recoveryReply()
      await page.getByText('Action completed.', { exact: true }).waitFor()
      await expect(page.getByText('MOCK_DELAYED_RECOVERY', { exact: true })).toHaveCount(0)
      await page.getByRole('link', { name: 'Passwords', exact: true }).click()
      await page.getByRole('button',{name:'Verify password',exact:true}).waitFor();assert.equal(unlockCalls,1);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Open vault Example vault',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.locator('input[aria-label="Current password"]:visible').last().fill('mock-only-password');await page.getByRole('button',{name:'Verify password',exact:true}).click();await expect.poll(()=>vaultVerified).toBe(true);

      await page.getByRole('button', { name: 'Open vault Example vault', exact: true }).click()
      // The folder tool is a "New folder" sheet (Name + Create, VaultTools FolderManager since 2e4a6d4); it closes on success.
      await page.getByRole('button', { name: 'New folder', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
      await page.getByLabel('Name', { exact: true }).fill('Example folder')
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await page.getByRole('button', { name: 'Create', exact: true }).waitFor({ state: 'hidden' })
      assert.deepEqual(folders.map(f => f.name), ['Example folder'])
      assert.equal(mutations.filter(m => m.path === '/api/jp/vaults/vault/folders/' && m.method === 'POST').length, 1)
      await page.getByRole('button', { name: 'Open Example entry', exact: true }).click()
      await page.getByRole('button', { name: 'Reveal password', exact: true }).click()
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor()
      await page.getByRole('button',{name:'Copy password',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.clipboardMock.value)).toBe('MOCK_REVEAL_ONLY');await page.evaluate(()=>window.clipboardMock.value='new unrelated synthetic clipboard');

      assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('MOCK_REVEAL_ONLY') || JSON.stringify(sessionStorage).includes('MOCK_REVEAL_ONLY')), false)
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor({ state: 'hidden' });assert.equal(await page.evaluate(()=>window.clipboardMock.value),'new unrelated synthetic clipboard')
      await page.getByRole('button', { name: 'Reveal password from version 0', exact: true }).click()
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor()
      await page.evaluate(() => window.dispatchEvent(new Event('blur')))
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor({ state: 'hidden' })
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await page.getByRole('button', { name: 'Share entry', exact: true }).click()
      await page.getByLabel('Find a person to share with', { exact: true }).fill('Example')
      await page.getByRole('button', { name: 'Example Colleague (colleague@example.invalid)', exact: true }).click()
      entries[0].can.share = false
      await page.getByRole('button', { name: 'Confirm entry share', exact: true }).click()
      await page.getByText('This action is no longer permitted. Close and reopen the entry to refresh access.', { exact: true }).waitFor()
      entries[0].can.share = true
      await page.getByRole('button', { name: 'Confirm entry share', exact: true }).click()
      await page.getByRole('button', { name: 'Revoke access for Example Colleague', exact: true }).click()
      entries[0].can.revoke = false
      await page.getByRole('button', { name: 'Confirm revoke access', exact: true }).click()
      await page.getByText('This action is no longer permitted. Close and reopen the entry to refresh access.', { exact: true }).waitFor()
      entries[0].can.revoke = true
      await page.getByRole('button', { name: 'Confirm revoke access', exact: true }).click()
      await page.getByRole('button', { name: 'Revoke access for Example Colleague', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(shares.length, 0)
      await page.getByRole('button', { name: 'Move entry', exact: true }).click()
      await page.getByRole('button', { name: 'Example vault', exact: true }).click()
      await page.getByRole('button', { name: 'Folder: Example folder', exact: true }).click()
      entries[0].can.move = false
      await page.getByRole('button', { name: 'Confirm entry move', exact: true }).click()
      await page.getByText('This action is no longer permitted. Close and reopen the entry to refresh access.', { exact: true }).waitFor()
      entries[0].can.move = true
      await page.getByRole('button', { name: 'Confirm entry move', exact: true }).click()
      await page.getByRole('button', { name: 'Close entry', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(entries[0].folder, 'folder')
      await page.getByRole('button', { name: 'Create entry', exact: true }).click()
      // The entry form is a "New entry" sheet with plain field labels (Title, Password, Field 1 name; Save/Cancel) since 2e4a6d4.
      const entryForm = page.getByRole('dialog', { name: 'New entry' })
      await entryForm.waitFor()
      await entryForm.getByLabel('Title', { exact: true }).fill('New mocked entry')
      const savesBeforeGeneration = mutations.filter(m => m.path === '/api/jp/entries/' && m.method === 'POST').length
      await entryForm.getByRole('button', { name: 'Password generator', exact: true }).click()
      await page.getByRole('button', { name: 'Generate password', exact: true }).click()
      await expect(entryForm.getByLabel('Password', { exact: true })).toHaveValue(/^.{20}$/)
      await page.getByRole('button', { name: 'Passphrase', exact: true }).click()
      await expect(entryForm.getByLabel('Password', { exact: true })).toHaveValue(/^(?:[a-z]+-){6}[1-9]\d$/)
      assert.equal(mutations.filter(m => m.path === '/api/jp/entries/' && m.method === 'POST').length, savesBeforeGeneration, 'Generation remains on device until Save')
      await entryForm.getByLabel('Password', { exact: true }).fill('MOCK_INPUT_ONLY')
      await entryForm.getByRole('button', { name: 'Add field', exact: true }).click()
      await entryForm.getByLabel('Field 1 name', { exact: true }).fill('unchanged')
      await entryForm.getByRole('button', { name: 'Save', exact: true }).click()
      await page.getByRole('button', { name: 'Open New mocked entry', exact: true }).waitFor()
      assert.equal(mutations.find(m => m.path === '/api/jp/entries/' && m.method === 'POST').body.secret.fields, undefined)
      await entryForm.waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: 'test-results/vault-mocked-' + width + '.png', fullPage: true })
      await page.getByRole('button',{name:'Vault files',exact:true}).click()
      // Vault files (VaultFiles since 2e4a6d4): a row opens the preview ("Open file"); rename/export/delete use one sheet titled
      // "Rename file" / "Export file" / "Delete file?" whose confirm button is Save / Export / Delete next to Cancel.
      const fileAction=page.getByRole('dialog',{name:/^(Rename file|Export file|Delete file\?)$/})
      const confirmFile=fileAction.getByRole('button',{name:/^(Save|Export|Delete)$/})
      await page.emulateMedia({colorScheme:'dark'})
      await page.getByRole('button',{name:'Open file mock.pem',exact:true}).click()
      await page.getByText('MOCK_FILE_PREVIEW',{exact:true}).waitFor()
      await expect(page.getByText('MOCK_FILE_PREVIEW',{exact:true})).toHaveCSS('color','rgb(241, 245, 249)') // Reference dark foreground #F1F5F9 (design.md).
      await page.getByText('MOCK_FILE_PREVIEW',{exact:true}).waitFor({state:'hidden'})
      await page.emulateMedia({colorScheme:'light'})
      delayedPreview=true
      await page.getByRole('button',{name:'Open file mock.pem',exact:true}).click()
      await expect.poll(()=>previewRequested).toBe(true)
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
      previewReply();await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
      await expect(page.getByRole('button',{name:'Open file mock.pem',exact:true})).toBeEnabled()
      await expect(page.getByText('MOCK_LATE_FILE',{exact:true})).toHaveCount(0);delayedPreview=false
      await page.getByRole('button',{name:'Rename file mock.pem',exact:true}).click()
      await fileAction.getByLabel('Name',{exact:true}).fill('renamed.pem');fileRenameAllowed=false
      await confirmFile.click()
      await page.getByText('This file action is no longer allowed.',{exact:true}).last().waitFor()
      assert.equal(fileRows[0].name,'mock.pem');fileRenameAllowed=true
      await confirmFile.click()
      await page.getByRole('button',{name:'Download file renamed.pem',exact:true}).click()
      await page.evaluate(()=>{window.vaultBlobURLs=0;const original=URL.createObjectURL.bind(URL);URL.createObjectURL=value=>{window.vaultBlobURLs++;return original(value)}})
      verified=false
      const attempts=mutations.filter(m=>m.path==='/api/jp/files/file/download/').length
      await confirmFile.click()
      await page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Verify password',exact:true})}).getByRole('button',{name:'Cancel',exact:true}).click()
      await expect(confirmFile).toBeEnabled()
      assert.equal(mutations.filter(m=>m.path==='/api/jp/files/file/download/').length,attempts+1)
      assert.equal(await page.evaluate(()=>window.vaultBlobURLs),0)
      await confirmFile.click()
      await page.getByRole('dialog').getByLabel('Current password',{exact:true}).fill('MOCK_VERIFY')
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'Verify password',exact:true}).click();assert.equal((await download).suggestedFilename(),'renamed.pem')
      assert.equal(mutations.filter(m=>m.path==='/api/jp/files/file/download/').length,attempts+3)
      for(const cancelMethod of ['button','blur']){
        holdDownload=true;downloadRequested=false
        await page.getByRole('button',{name:'Download file renamed.pem',exact:true}).click()
        await confirmFile.click()
        await expect.poll(()=>downloadRequested).toBe(true)
        const before=await page.evaluate(()=>window.vaultBlobURLs)
        if(cancelMethod==='button')await page.getByRole('button',{name:'Cancel current file download',exact:true}).click()
        else await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
        await expect(confirmFile).toBeEnabled()
        downloadReply();await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
        await fileAction.getByRole('button',{name:'Cancel',exact:true}).click()
        assert.equal(await page.evaluate(()=>window.vaultBlobURLs),before)
      }
      holdDownload=false

      const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload vault file',exact:true}).click();await (await chooser).setFiles({name:'upload.pem',mimeType:'application/octet-stream',buffer:Buffer.from('MOCK UPLOAD')})
      await page.getByRole('button',{name:'Delete file upload.pem',exact:true}).click();await confirmFile.click()
      await expect(page.getByRole('button',{name:'Delete file upload.pem',exact:true})).toHaveCount(0)
      await page.screenshot({path:'test-results/vault-files-'+width+'.png',fullPage:true})

      await page.getByRole('button', { name: 'Rename vault', exact: true }).click()
      await page.getByLabel('Vault name', { exact:true }).fill('Renamed example vault')
      await page.getByRole('button', { name:'Save vault name',exact:true }).click()
      // The reference opens a vault as its own page (no vault grid beside it), so check the saved name (a personal vault is titled 'My vault', as in the reference).
      await page.getByRole('button', { name:'Save vault name',exact:true }).waitFor({ state: 'hidden' }); assert.equal(vault.name,'Renamed example vault');
      await page.getByRole('button', { name:'Archive vault',exact:true }).click()
      await page.getByRole('button', { name:'Confirm vault archive change',exact:true }).click()
      await page.getByRole('button', { name:'Unarchive vault',exact:true }).waitFor()
      await page.getByRole('button', { name:'Vault activity',exact:true }).click()
      // Activity is a When / Who / What / Entry table (VaultManagement since 2e4a6d4); a successful row has no outcome badge.
      await page.getByText('Vault created', { exact:true }).waitFor()
      await expect(page.getByText('success', { exact:true })).toHaveCount(0)
      // Team vaults and emergency access are sections of the "Passwords sections" menu (VaultPanel since 2e4a6d4); their
      // forms are sheets: "New team vault" (Create), "Appoint an owner of ..." (Add), "Request emergency access" (Request).
      const passwordsSection=async name=>{await page.getByRole('button',{name:'Passwords sections',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click()}
      await passwordsSection('Team vaults')
      await page.getByRole('button', { name:'New vault',exact:true }).click()
      const newVault=page.getByRole('dialog',{name:'New team vault'})
      await newVault.getByLabel('Team vault name', {exact:true}).fill('Mock team vault')
      await newVault.getByLabel('Find vault member', {exact:true}).fill('Example')
      await newVault.getByRole('button', {name:'Choose Example Colleague',exact:true}).click()
      await newVault.getByText('Selected: Example Colleague',{exact:true}).waitFor()
      await newVault.getByRole('button', {name:'Create',exact:true}).click()
      await newVault.waitFor({state:'hidden'})
      await page.getByRole('button', {name:'Manage owners of Mock team vault',exact:true}).click()
      await page.getByRole('button', {name:'Appoint owner',exact:true}).click()
      const appoint=page.getByRole('dialog',{name:'Appoint an owner of Mock team vault'})
      await appoint.getByLabel('Find vault member', {exact:true}).fill('Example')
      // The picker leaves out people who are already members (Example Colleague is the super owner here).
      await appoint.getByRole('button', {name:'Choose Example Second Owner',exact:true}).waitFor()
      await expect(appoint.getByRole('button', {name:'Choose Example Colleague',exact:true})).toHaveCount(0)
      await appoint.getByRole('button', {name:'Choose Example Second Owner',exact:true}).click()
      await appoint.getByRole('button', {name:'Add',exact:true}).click()
      await appoint.waitFor({state:'hidden'})
      await page.getByText('Sent to an existing owner for approval.',{exact:true}).waitFor()
      await page.getByRole('button', {name:'Close vault owners',exact:true}).click()
      await passwordsSection('Emergency access')
      await page.getByRole('button', {name:'Request access',exact:true}).click()
      const emergencyForm=page.getByRole('dialog',{name:'Request emergency access'})
      await emergencyForm.getByRole('button',{name:'Vault for emergency access',exact:true}).click()
      await page.getByRole('menuitem', {name:'Emergency example',exact:true}).click()
      await emergencyForm.getByLabel('Reason',{exact:true}).fill('Mock owners are unavailable')
      await emergencyForm.getByRole('button', {name:'Request',exact:true}).click()
      await emergencyForm.waitFor({state:'hidden'})
      await page.getByText('Requested. Another approver must decide.',{exact:true}).waitFor()
      assert.equal(emergency.length,1)
      await openNotifications(page, width)
      await page.getByRole('button', { name: 'Open Example activity', exact: true }).click()
      denied=false
      await page.getByRole('button', {name:'Go to linked item',exact:true}).click()
      await page.getByText('Restricted example',{exact:true}).waitFor()
      assert.match(page.url(), /conversation=chat/)
      if (width < 768) await page.getByRole('button', {name:'Back to conversations',exact:true}).click()
      await openNotifications(page, width)
      await page.getByRole('button', { name: 'Remove notification', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm removal', exact: true }).click()
      await page.getByText('No notifications.', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Notification preferences', exact: true }).click()
      await page.getByLabel('Quiet hours start', { exact: true }).fill('22:00')
      await page.getByLabel('Quiet hours end', { exact: true }).fill('07:00')
      await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
      await expect.poll(() => preferences.dnd_start).toBe('22:00')
      await page.getByRole('button', { name: 'Alerts', exact: true }).click()
      await page.getByRole('button', { name: 'Compose alert', exact: true }).click()
      await page.getByLabel('Alert title', { exact: true }).fill('Example alert')
      await page.getByLabel('Alert message', { exact: true }).fill('Mocked alert content')
      await page.getByRole('button', { name: 'Example Colleague (colleague@example.invalid)', exact: true }).click()
      await page.getByRole('button', { name: 'Review alert', exact: true }).click()
      assert.equal(sentAlerts.length, 0, 'Review must not send an alert')
      await page.getByRole('button', { name: 'Send reviewed alert', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel sent alert Example alert', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm alert change', exact: true }).click()
      await page.getByRole('button', { name: 'Remove sent alert Example alert', exact: true }).waitFor()
      assert.equal(sentAlerts[0].status, 'cancelled')
      await nav(page, width, 'People', null, 'Administration')
      await page.getByRole('button', { name: 'Edit person Example Tester', exact: true }).click()
      await page.getByLabel('Full name', { exact: true }).fill('Edited Example Tester')
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel changes', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(adminPerson.full_name, 'Edited Example Tester')
      await page.getByRole('button',{name:'Create person',exact:true}).click()
      await page.getByLabel("New person's full name",{exact:true}).fill('New Mock Person')
      await page.getByLabel("New person's email",{exact:true}).fill('new@example.invalid')
      await page.getByRole('button',{name:'Create invited person',exact:true}).click()
      await page.getByRole('button',{name:'Close access link',exact:true}).click()
      await page.getByRole('button',{name:'Close create person',exact:true}).click()
      // An existing membership makes the Companies section appear (the reference hides it for people without one).
      managedUsers[1].companies.push({id:'seed-membership',company:'SD',company_name:'Seed Company',company_color:'#0EA5E9',title:'',department:'',is_active:true,is_default:true})
      await page.getByRole('button',{name:'Manage person New Mock Person',exact:true}).click()
      // Person page (reference UserDetailPage): set password, deactivate and reactivate sit in the More actions menu.
      await page.getByRole('button',{name:'More actions',exact:true}).click()
      await page.getByRole('menuitem',{name:'Set password',exact:true}).click()
      await page.getByLabel('Person new password',{exact:true}).fill('SYNTHETIC_ONLY_PASSWORD')
      await page.getByLabel('Confirm person password',{exact:true}).fill('SYNTHETIC_ONLY_PASSWORD')
      await page.getByRole('button',{name:'Review person password',exact:true}).click()
      await page.getByRole('button',{name:'Confirm person password change',exact:true}).click()
      await page.getByText('Password set. Other devices are signed out.',{exact:true}).waitFor()
      await expect(page.getByLabel('Person new password',{exact:true})).toHaveValue('')
      passwordPending=true
      await page.getByLabel('Person new password',{exact:true}).fill('SYNTHETIC_PENDING_PASSWORD')
      await page.getByLabel('Confirm person password',{exact:true}).fill('SYNTHETIC_PENDING_PASSWORD')
      await page.getByRole('button',{name:'Review person password',exact:true}).click()
      await page.getByRole('button',{name:'Confirm person password change',exact:true}).click()
      await page.getByText('Sent for approval: a second administrator must approve it.',{exact:true}).first().waitFor()
      await expect(page.getByLabel('Person new password',{exact:true})).toHaveValue('')
      await page.getByLabel('Person new password',{exact:true}).fill('SYNTHETIC_CLEAR_ON_BLUR')
      await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))})
      await expect(page.getByLabel('Person new password',{exact:true})).toHaveValue('')
      await page.getByRole('button',{name:'Close set password',exact:true}).click()
      await page.getByRole('button',{name:'More actions',exact:true}).click()
      await page.getByRole('menuitem',{name:'Deactivate person',exact:true}).click()
      await page.getByRole('button',{name:'Confirm person action',exact:true}).click()
      await page.getByRole('button',{name:'More actions',exact:true}).click()
      await page.getByRole('menuitem',{name:'Reactivate person',exact:true}).click()
      await page.getByRole('button',{name:'Confirm person action',exact:true}).click()
      await page.getByText('Sent for approval: a second administrator must approve it.',{exact:true}).first().waitFor()
      assert.equal(managedUsers[1].is_active,false)
      await page.getByRole('checkbox',{name:'Team access',exact:true}).click()
      await page.getByRole('button',{name:'Save access',exact:true}).click()
      await expect.poll(()=>managedUsers[1].groups).toEqual(['Team access'])
      await page.getByRole('button',{name:'Revoke device Mock tablet',exact:true}).click()
      await page.getByRole('button',{name:'Confirm session revocation',exact:true}).click()
      await expect(page.getByRole('button',{name:'Revoke device Mock tablet',exact:true})).toHaveCount(0)

      await page.getByRole('button',{name:'Example Company',exact:true}).click()
      await page.getByLabel('Membership title',{exact:true}).fill('Mock role')
      await page.getByLabel('Membership department',{exact:true}).fill('Mock department')
      await page.getByRole('button',{name:'Add company membership',exact:true}).click()
      await page.getByRole('button',{name:'Make Example Company default',exact:true}).click()
      await expect.poll(()=>managedUsers[1].companies.find(m=>m.id==='membership')?.is_default).toBe(true)
      await page.getByRole('button',{name:'Remove membership Example Company',exact:true}).click()
      await page.getByRole('button',{name:'Confirm membership removal',exact:true}).click()
      await expect.poll(()=>managedUsers[1].companies.some(m=>m.id==='membership')).toBe(false)
      await page.getByRole('button',{name:'Restrict to selected people',exact:true}).click()
      await page.getByRole('button',{name:'Example Tester',exact:true}).click()
      await page.getByRole('button',{name:'Add selected chat people',exact:true}).click()
      await page.getByRole('button',{name:'Remove chat access to Example Tester',exact:true}).click()
      await expect.poll(()=>chatPolicy.allowed_count).toBe(0)
      await page.getByRole('switch',{name:'Can create chat groups',exact:true}).click()
      await expect.poll(()=>chatPolicy.can_create_groups).toBe(false)
      await page.getByRole('button',{name:'Allow all people',exact:true}).click()
      await expect.poll(()=>chatPolicy.mode).toBe('all')

      await page.getByRole('link',{name:'Close person details',exact:true}).click()
      await adminSection(page,width,'Permission groups')
      await page.getByRole('button',{name:'New permission group',exact:true}).click()
      await page.getByLabel('Permission group name',{exact:true}).fill('Mock permission group')
      await page.getByRole('switch',{name:'Capability Messenger access',exact:true}).click()
      await expect(page.getByRole('switch',{name:'Capability Manage vaults',exact:true})).toBeDisabled()
      await page.getByRole('button',{name:'Save permission group',exact:true}).click()
      await page.getByRole('button',{name:'Close permission group',exact:true}).waitFor({state:'hidden'})
      assert.deepEqual(permissionGroups[0].capabilities,['JM_ACCESS'])
      await adminSection(page,width,'Security')
      await page.getByRole('button',{name:'Review requiring two-step',exact:true}).click()
      await page.getByRole('button',{name:'Confirm security policy change',exact:true}).click()
      await page.getByRole('button',{name:'Review disabling required two-step',exact:true}).click()
      await page.getByRole('button',{name:'Confirm security policy change',exact:true}).click()
      await page.getByText('Sent for approval: a second administrator must approve it.',{exact:true}).first().waitFor()
      assert.equal(policy.two_step_enforced,true)
      approvalRows=['approve','deny','cancel'].map(kind=>({...pendingApproval,id:kind,kind:'reset_password',target:{id:'target-'+kind,name:'Same name',email:'target-'+kind+'@example.invalid'},label:'Mock '+kind,can:{decide:kind!=='cancel',cancel:kind==='cancel'}}))
      await page.goto(base + '/admin?tab=approvals')
      for(const kind of ['approve','deny','cancel']){await page.getByRole('button',{name:kind[0].toUpperCase()+kind.slice(1)+' Mock '+kind,exact:true}).click();await expect(page.getByRole('dialog').getByText('Target: Same name (target-'+kind+'@example.invalid)',{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByText('Requested by: Example Tester (tester@example.invalid)',{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByText(/^Expires:/)).toBeVisible();if(kind==='approve')await expect(page.getByRole('dialog').getByText(/24 hours/)).toBeVisible();await page.getByRole('button',{name:'Confirm decision',exact:true}).click();await page.getByRole('button',{name:'Go back',exact:true}).waitFor({state:'hidden'});if(kind==='approve'){await page.getByText('https://example.invalid/reset/MOCK_APPROVED',{exact:true}).waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.getByRole('button',{name:'Close access link',exact:true}).waitFor({state:'hidden'});await page.evaluate(()=>window.dispatchEvent(new Event('focus')))}}
      assert.deepEqual(approvalRows.map(a=>a.status),['approve','deny','cancel'])
      // Unified approvals inbox (FE-023): badge on the navigation entry, confirmation, then the item leaves the list.
      await page.goto(base + '/home')
      // The reference shows this badge on the rail only (the phone bar has no Approvals tab).
      if (width >= 768) await expect(page.getByLabel('1 waiting for your approval', { exact: true })).toBeVisible()
      await nav(page, width, 'Approvals', null, 'Approvals')
      await page.getByText('Reset two-step verification', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Approve Reset two-step verification', exact: true }).click()
      await page.getByText('Approve: Reset two-step verification?', { exact: true }).waitFor()
      assert.equal(approvalDecided, false, 'Approve must ask for confirmation first')
      await page.getByRole('button', { name: 'Approve', exact: true }).click()
      await expect.poll(() => approvalDecided).toBe(true)
      await page.getByText('Nothing waiting on you.', { exact: true }).waitFor()
      if (width === 360) await require('./scripts/share-ui.cjs')(page, { base, me, conversation })

      await signOut(page)
      for (const path of ['/invite/mock-token', '/reset-password/mock-token']) {
        await page.goto(base + path)
        await page.getByLabel('New password', { exact: true }).fill('MOCK_NEW_PASSWORD')
        await page.getByLabel('Repeat password', { exact: true }).fill('MOCK_NEW_PASSWORD')
        await page.getByRole('button', { name: /^(Set password and sign in|Save and sign in)$/ }).click()
        await signOut(page)
      }
      assert.deepEqual(unexpected, [], 'No unmocked or external request is permitted')
      assert.deepEqual(runtimeErrors, [], 'No browser runtime exceptions')
      console.log(`PASS ${width}px: home, mentions/typing, selected senders, outbox retry, receipts/reactions, profile photo, appearance, direct/pending admin passwords; mocked cookie login, conversation/audio playback/deletion/access loss, recovery race, reader follow/indicator, permission changes, vault blur/blank fields, text send/edit, poll/search, group edit/role/add/mute/clear, step-up profile save, vault reveal expiry/version/create/share/revoke/move/folders, notifications/preferences/alert review/send/cancel, admin lifecycle/groups/security/device/membership/chat/approval decisions, vault file upload/download/rename/delete/preview races, vault management/owner approval/emergency/activity, notification navigation, invite/reset, logout; no external requests`)
      } catch (error) { await page.screenshot({path:'test-results/failure-'+width+'.png',fullPage:true}).catch(()=>{}); console.error('Failed URL:',page.url()); throw error }
      await context.close()
    }
  } finally { await browser.close() }
}
run().catch(e => { console.error(e); process.exitCode = 1 })



