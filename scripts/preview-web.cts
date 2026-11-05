import http = require('node:http')
import fs = require('node:fs')
import path = require('node:path')
import httpProxy = require('http-proxy')
import { loopbackOrigin, socketOrigin } from './web-proxy-policy.cts'

const root = path.resolve(__dirname, '..')
const requested = path.resolve(root, process.env.JM_WEB_DIST || 'dist')
if (!requested.startsWith(root + path.sep)) throw Error('Preview directory must stay inside Universal')
// A missing or half-written dist/ must not crash the preview: keep serving a clear 503 until a build lands.
const directory = fs.existsSync(requested) ? fs.realpathSync(requested) : requested
if (!directory.startsWith(root + path.sep)) throw Error('Preview directory must stay inside Universal')
const missingBuild = `${path.relative(root, path.join(directory, 'index.html'))} is missing. Run "npm run build:web" first.`
if (!fs.existsSync(path.join(directory, 'index.html'))) console.error(`Warning: ${missingBuild}`)
// Every Expo Router page in src/app (pwa/sw.ts and deploy/nginx-universal.conf.example keep the same list;
// scripts/pwa-policy.test.cts fails if a route is missing from any of them).
const shellRoute = /^\/(?:$|(?:login|home|share|messenger|profile|passwords|notifications|admin|preview|tools|approvals|alerts|atlas|group-info|group-edit)\/?$|(?:invite|reset-password)\/[^/]+\/?$)/
const port = Number(process.env.JM_PREVIEW_PORT || 4175)
if (!Number.isInteger(port) || port <= 1024 || port > 65535) throw Error('Invalid preview port')
const publicOrigin = `http://127.0.0.1:${port}`
const backend = loopbackOrigin(process.env.JM_BACKEND_URL || 'http://127.0.0.1:8000')
const upstreamOrigin = loopbackOrigin(process.env.JM_WS_ORIGIN || backend)
const proxy = httpProxy.createProxyServer({ ws: true })
const backendPath = (url = '/') => /^\/(?:api(?:\/|$)|ws(?:\/|$)|healthz(?:\?|$)|readyz(?:\?|$))/.test(url)
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav' }
const localHost = (req: http.IncomingMessage) => [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? '')
proxy.on('error', (_error, _req, response) => {
  if (response instanceof http.ServerResponse) { if (!response.headersSent) response.writeHead(502); response.end('Local backend is unavailable.') } else response.destroy()
})
const server = http.createServer((req, res) => {
  if (!localHost(req)) { res.writeHead(403); res.end(); return }
  if (backendPath(req.url)) { proxy.web(req, res, { target: backend }); return }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
  let pathname: string
  try { pathname = decodeURIComponent(new URL(req.url || '/', publicOrigin).pathname) } catch { res.writeHead(400); res.end(); return }
  if (pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); res.end(); return }
  let file = path.resolve(directory, '.' + pathname)
  if (file !== directory && !file.startsWith(directory + path.sep)) { res.writeHead(403); res.end(); return }
  let missing = true
  try { missing = !fs.existsSync(file) || fs.statSync(file).isDirectory() } catch { missing = true }
  if (missing) {
    if (path.extname(pathname) || !shellRoute.test(pathname)) { res.writeHead(404); res.end(); return }
    file = path.join(directory, 'index.html')
  }
  // dist/ may be mid-rebuild (npm run build:web): answer 503 instead of crashing the preview.
  let resolved: string
  try { resolved = fs.realpathSync(file) } catch {
    res.writeHead(503, { 'Retry-After': '2', 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(path.basename(file) === 'index.html' ? missingBuild : 'Build in progress.'); return
  }
  if (!resolved.startsWith(directory + path.sep)) { res.writeHead(403); res.end(); return }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
  if (req.method === 'HEAD') { res.end(); return }
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res)
})
server.on('upgrade', (req, socket, head) => {
  if (!localHost(req) || !backendPath(req.url)) { socket.destroy(); return }
  const origin = socketOrigin(req.headers.origin, publicOrigin, upstreamOrigin)
  if (!origin) { socket.destroy(); return }
  req.headers.origin = origin
  proxy.ws(req, socket, head, { target: backend })
})
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`Production preview ${publicOrigin}; backend ${backend}`))
function stop() { proxy.close(); server.close(); setTimeout(() => process.exit(0), 1000).unref() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
