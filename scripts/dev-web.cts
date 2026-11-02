import http = require('node:http')
import path = require('node:path')
import { spawn, type ChildProcess } from 'node:child_process'
import httpProxy = require('http-proxy')
import { loopbackOrigin, socketOrigin } from './web-proxy-policy.cts'

process.chdir(path.resolve(__dirname, '..'))
const port = Number(process.env.JM_WEB_PORT || 5175)
const metroPort = Number(process.env.JM_METRO_PORT || 8081)
if (![port, metroPort].every(value => Number.isInteger(value) && value > 1024 && value <= 65535)) throw Error('Invalid local development port')
const publicOrigin = `http://127.0.0.1:${port}`
const metroOrigin = `http://localhost:${metroPort}`
const backendOrigin = loopbackOrigin(process.env.JM_BACKEND_URL || 'http://127.0.0.1:8000')
const upstreamSocketOrigin = loopbackOrigin(process.env.JM_WS_ORIGIN || backendOrigin)
const proxy = httpProxy.createProxyServer({ ws: true })
const backendPath = (url = '/') => /^\/(?:api(?:\/|$)|ws(?:\/|$)|healthz(?:\?|$)|readyz(?:\?|$))/.test(url)
const target = (req: http.IncomingMessage) => backendPath(req.url) ? backendOrigin : metroOrigin
const localHost = (req: http.IncomingMessage) => [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? '')
proxy.on('error', (_error, _req, response) => {
  if (response instanceof http.ServerResponse) {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' })
    response.end('Local server is not ready. Check the Metro and Django terminals, then refresh.')
  } else response.destroy()
})
const server = http.createServer((req, res) => {
  if (!localHost(req)) { res.writeHead(403); res.end(); return }
  proxy.web(req, res, { target: target(req) })
})
server.on('upgrade', (req, socket, head) => {
  if (!localHost(req)) { socket.destroy(); return }
  if (backendPath(req.url)) {
    const origin = socketOrigin(req.headers.origin, publicOrigin, upstreamSocketOrigin)
    if (!origin) { socket.destroy(); return }
    req.headers.origin = origin
  }
  proxy.ws(req, socket, head, { target: target(req) })
})
let metro: ChildProcess | undefined
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true; metro?.kill(); proxy.close(); server.close(); process.exitCode = code
  setTimeout(() => process.exit(code), 1000).unref()
}
server.on('error', error => { console.error(error.message); stop(1) })
server.listen(port, '127.0.0.1', () => {
  console.log(`\nOpen ${publicOrigin} after Metro starts. Django target: ${backendOrigin}.\n`)
  metro = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--localhost', '--port', String(metroPort), '--max-workers', '2'], {
    stdio: 'inherit', windowsHide: true,
    env: { ...process.env, EXPO_PUBLIC_API_ORIGIN: publicOrigin, BROWSER: 'none' },
  })
  metro.on('error', error => { console.error(error.message); stop(1) })
  metro.on('exit', code => stop(code ?? 0))
})
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
