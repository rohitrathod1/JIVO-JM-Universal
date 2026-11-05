// Emulator-only driver for the Android E2E pass. Never targets the USB phone.
// Usage: node drive.cjs <cmd> [args]
//   dump                 print visible nodes (text / content-desc / bounds)
//   tap <label>          tap node whose content-desc or text equals label (or startsWith with ~label)
//   tapxy <x> <y>
//   type <text>          type text (spaces encoded) in focused field
//   key <code>
//   shot <name>          save screenshot to test-results/e2e/android/<name>.png
//   wait <text> [secs]   wait until text/content-desc contains text
const { execFileSync } = require('node:child_process')
const fs = require('node:fs'), path = require('node:path')
const SERIAL = process.env.JM_TEST_DEVICE || 'emulator-5554'
if (!/^emulator-\d+$/.test(SERIAL)) throw Error('Refusing non-emulator serial ' + SERIAL)
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe')
const out = path.resolve(__dirname, '../../../test-results/e2e/android')
fs.mkdirSync(out, { recursive: true })
const adb = (...a) => execFileSync(adbPath, ['-s', SERIAL, ...a], { maxBuffer: 64 << 20, timeout: 180000 })
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
function nodes() {
  for (let i = 0; i < 3; i++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/jm-e2e.xml')
      const xml = adb('exec-out', 'cat', '/sdcard/jm-e2e.xml').toString()
      fs.writeFileSync(path.join(out, 'last-ui.xml'), xml)
      return [...xml.matchAll(/<node\s+([^>]+?)\/?>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])))
    } catch (e) { sleep(1500) }
  }
  throw Error('uiautomator dump failed')
}
const center = n => { const b = n.bounds.match(/\d+/g).map(Number); return [Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2)] }
function find(label, all = nodes()) {
  if (label.startsWith('~')) { const l = label.slice(1); return all.find(n => (n['content-desc'] || '').includes(l) || (n.text || '').includes(l)) }
  return all.find(n => n['content-desc'] === label) || all.find(n => n.text === label)
}
const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'dump') {
  for (const n of nodes()) if (n.text || n['content-desc'] || n.focused === 'true') console.log(JSON.stringify({ t: n.text, d: n['content-desc'], c: n.class.split('.').pop(), b: n.bounds, en: n.enabled, f: n.focused === 'true' || undefined }))
} else if (cmd === 'tap') {
  const n = find(args[0]); if (!n) { console.error('NOT FOUND ' + args[0]); process.exit(2) }
  const [x, y] = center(n); adb('shell', 'input', 'tap', String(x), String(y)); console.log('tapped', args[0], x, y, 'enabled=' + n.enabled)
} else if (cmd === 'tapxy') { adb('shell', 'input', 'tap', args[0], args[1]) }
else if (cmd === 'type') { for (const part of args.join(' ').match(/.{1,6}/g) || []) { adb('shell', 'input', 'text', part.replace(/ /g, '%s').replace(/([@&;<>()$|'"!])/g, '\\$1')); sleep(200) } }
else if (cmd === 'key') { adb('shell', 'input', 'keyevent', ...args) }
else if (cmd === 'shot') { fs.writeFileSync(path.join(out, args[0] + '.png'), adb('exec-out', 'screencap', '-p')); console.log('saved', path.join(out, args[0] + '.png')) }
else if (cmd === 'wait') {
  const until = Date.now() + Number(args[1] || 60) * 1000
  while (Date.now() < until) { if (find('~' + args[0])) { console.log('found', args[0]); process.exit(0) } sleep(1500) }
  console.error('TIMEOUT waiting for ' + args[0]); process.exit(3)
} else { console.error('unknown cmd'); process.exit(1) }
