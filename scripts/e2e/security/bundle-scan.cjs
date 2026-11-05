// Usage: node scripts/e2e/security/bundle-scan.cjs
// Scans the exported web bundle (dist/) for secrets. .env values are compared in memory only;
// the report prints variable NAMES and file names, never values.
const fs = require('fs'), path = require('path')
const root = path.resolve(__dirname, '../../..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'test-results/e2e/security/bundle-scan.json')
const envFiles = [path.join(root, '.env'), path.resolve(root, '../JIVO-JM-Backend/.env'), path.resolve(root, '../JIVO-JM-Frontend/.env'),
  path.resolve(process.env.E2E_DIR || '', 'e2e-secrets.ps1')]
function parseEnv(file) {
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.match(/^\s*(?:\$env:)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?(.*?)['"]?\s*$/)).filter(Boolean)
    .map(m => ({ name: m[1], value: m[2] }))
}
// Values that are public by design or too generic to mean anything.
const benign = v => v.length < 8 || /^(true|false|none|null|localhost|127\.0\.0\.1|0\.0\.0\.0|https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?|\d+)$/i.test(v)
function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) }
const files = walk(dist).filter(f => /\.(js|html|json|map|css|txt|webmanifest)$/.test(f))
const blobs = files.map(f => ({ f: path.relative(dist, f), s: fs.readFileSync(f, 'utf8') }))
const report = { files: files.length, envMatches: [], patternMatches: [], publicEnvNames: [] }
for (const file of envFiles) {
  for (const { name, value } of parseEnv(file)) {
    if (name.startsWith('EXPO_PUBLIC_')) report.publicEnvNames.push(name)
    if (benign(value)) continue
    const hits = blobs.filter(b => b.s.includes(value)).map(b => b.f)
    if (hits.length) report.envMatches.push({ envFile: path.basename(path.dirname(file)) + '/' + path.basename(file), name, public: name.startsWith('EXPO_PUBLIC_'), files: hits.slice(0, 5) })
  }
}
const patterns = {
  privateKey: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, awsKey: /AKIA[0-9A-Z]{16}/, googleKey: /AIza[0-9A-Za-z_-]{35}/,
  slackToken: /xox[baprs]-[0-9A-Za-z-]{10,}/, openaiKey: /\bsk-[A-Za-z0-9]{20,}/, githubToken: /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  jwt: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, prodHost: /(messenger|auth)\.jivo\.in/,
  privateIp: /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, devPort8000: /(localhost|127\.0\.0\.1):8000/,
  sourceMap: /sourceMappingURL=(?!data:)/, openbao: /openbao|vault_token|VAULT_ADDR/i, dbUrl: /postgres(ql)?:\/\/[^\s"']+/,
}
for (const [name, re] of Object.entries(patterns)) {
  const hits = blobs.filter(b => re.test(b.s)).map(b => ({ file: b.f, sample: name === 'prodHost' || name === 'privateIp' || name === 'devPort8000' ? (b.s.match(re) || [''])[0] : '[redacted]' }))
  if (hits.length) report.patternMatches.push({ name, hits: hits.slice(0, 5), count: hits.length })
}
report.mapFiles = files.filter(f => f.endsWith('.map')).length
fs.writeFileSync(out, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
