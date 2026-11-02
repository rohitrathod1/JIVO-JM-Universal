import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs = require('node:fs')
import path = require('node:path')
import ts = require('typescript')

const root = path.resolve(__dirname, '..')
process.chdir(root)
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--max-workers', '1'], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env, NODE_ENV: 'production' },
})
if (result.status !== 0) process.exit(result.status ?? 1)
const dist = path.join(root, 'dist')
const index = path.join(dist, 'index.html')
if (!fs.existsSync(index)) throw Error('PWA build requires Expo single-page web output')
let html = fs.readFileSync(index, 'utf8')
html = html.replace(/<title>[^<]*<\/title>/, '<title>JIVO JM</title>')
html = html.replace(/<link[^>]*rel="(?:shortcut )?icon"[^>]*>/g, '')
html = html.replace('</head>', `
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" type="image/png" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#0D3A64" />
<meta name="apple-mobile-web-app-title" content="JM" />
<meta name="apple-mobile-web-app-capable" content="yes" />
</head>`)
fs.writeFileSync(index, html)
const shareWorker = fs.readFileSync(path.join(root, 'pwa', 'incoming-share.ts'), 'utf8')
const shareCompiled = ts.transpileModule(shareWorker, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export\s*\{\s*\};?\s*$/, '')
fs.writeFileSync(path.join(dist, 'share-worker.js'), shareCompiled)

function filesIn(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}
// Build-time allowlist only. Never enumerate remote URLs, API responses or user uploads.
const files = filesIn(dist).filter(file => /\.(?:html|js|css|png|svg|jpg|jpeg|webp|gif|ico|ttf|otf|woff2?|wav|webmanifest)$/.test(file) && path.basename(file) !== 'sw.js').sort()
const urls = files.map(file => '/' + path.relative(dist, file).replace(/\\/g, '/'))
const digest = createHash('sha256')
for (const file of files) digest.update(path.relative(dist, file)).update(fs.readFileSync(file))
const worker = fs.readFileSync(path.join(root, 'pwa', 'sw.ts'), 'utf8')
digest.update(worker)
const workerHelpers = ['src/shared/notificationTarget.ts', 'src/shared/pushPolicy.ts'].map(file => {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  digest.update(file).update(source)
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  code = code.replace(/^import\s+[^\n]+from\s+['"]\.\/notificationTarget['"];?\s*$/gm, '')
  code = code.replace(/export\s*\{\s*\};?\s*$/, '').replace(/^export\s+(?=(?:function|const|let|class)\s)/gm, '')
  if (/^(?:import|export)\s/m.test(code)) throw Error(`Unsupported worker helper dependency: ${file}`)
  return code
}).join('\n')
const version = digest.digest('hex').slice(0, 20)
const compiled = ts.transpileModule(worker, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export\s*\{\s*\};?\s*$/, '')
fs.writeFileSync(path.join(dist, 'sw.js'), `const __JM_PRECACHE__ = ${JSON.stringify(urls)};\nconst __JM_BUILD__ = ${JSON.stringify(version)};\n${workerHelpers}\n${compiled}`)
const report = { builtAt: new Date().toISOString(), build: version, files: urls.length, bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0), privateRuntimeCaching: false }
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
fs.writeFileSync(path.join(root, 'test-results', 'web-build.json'), JSON.stringify(report, null, 2))
console.log(`PWA shell ${version}: ${report.files} files, ${(report.bytes / 1024 / 1024).toFixed(2)} MiB. Output: dist/`)
