// Long-lived driver: logs in alice, bob, carol (separate contexts) once, then executes step files dropped in ./cmd/
// (each exports async function(ctx)). Output written to <OUT>/cmd-results/<name>.txt. Used to iterate on the slow shared dev server.
const fs = require('fs'), path = require('path'); const lib = require('./lib.cjs'); const { chromium, login, OUT } = lib
const CMD = path.join(__dirname, 'cmd'), RES = path.join(OUT, 'cmd-results'); fs.mkdirSync(CMD, { recursive: true }); fs.mkdirSync(RES, { recursive: true })
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const users = (process.env.USERS || 'alice,bob,carol').split(',')
  const P = {}; const t0 = Date.now()
  for (const u of users) { await (async () => { let r; for (let i = 0; i < 3; i++) { try { r = await login(b, u); break } catch (e) { console.log('login retry', u, e.message) } } if (!r) throw Error('login failed ' + u); P[u] = r.page; P[u + 'Ctx'] = r.ctx; console.log('logged in', u, Date.now() - t0, 'ms') })() }
  fs.writeFileSync(RES + '/_ready.txt', 'ready ' + (Date.now() - t0) + 'ms')
  const done = new Set(fs.readdirSync(CMD))
  for (;;) {
    for (const f of fs.readdirSync(CMD)) {
      if (done.has(f) || !f.endsWith('.cjs')) continue; done.add(f)
      const log = []; const out = (...a) => { log.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }
      const st = Date.now()
      try { delete require.cache[path.join(CMD, f)]; await require(path.join(CMD, f))({ P, b, lib, out, OUT, fs }); out('STEP OK', Date.now() - st, 'ms') }
      catch (e) { out('STEP FAIL', String(e && e.stack || e).slice(0, 3000)) }
      fs.writeFileSync(path.join(RES, f.replace('.cjs', '.txt')), log.join('\n'))
      if (f === 'zz-quit.cjs') { await b.close(); process.exit(0) }
    }
    await new Promise(r => setTimeout(r, 500))
  }
})().catch(e => { console.error('DRIVER FAIL', e); process.exit(1) })
