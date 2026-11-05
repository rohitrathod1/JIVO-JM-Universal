// Usage: node check-tag.cjs <tag-substring>  - lists carol<->dave messages containing the tag (as dave).
const L = require('./lib.cjs')
;(async () => { const d = new L.ApiUser('dave'); await d.login(); const conv = (await d.req('POST', '/conversations/direct/', { user_id: L.acc.accounts.carol.public_id })).data.id
 const m = await d.messagesAfter(conv, 0); for (const x of m.filter(x => (x.body || '').includes(process.argv[2]))) console.log(x.seq, x.body, (x.attachments || []).length, x.created_at) })().catch(e => { console.error(e); process.exit(1) })
