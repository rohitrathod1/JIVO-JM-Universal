import assert = require('node:assert/strict')
import fs = require('node:fs')
import path = require('node:path')
import vm = require('node:vm')
import { test } from 'node:test'
import ts = require('typescript')

function worker(failInstall = false) {
  const listeners = new Map<string, (event: unknown) => void>()
  const source = fs.readFileSync(path.join(__dirname, '..', 'pwa', 'sw.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export\s*\{\s*\};?\s*$/, '')
  const cached = new Map([['/index.html', 'public shell'], ['/_expo/static/app.js', 'public code']])
  let writes = 0
  let skips = 0
  const deleted: string[] = []
  vm.runInNewContext(compiled, {
    __JM_PRECACHE__: [...cached.keys()], __JM_BUILD__: 'fixture', URL, importScripts: () => {},
    Request: class { constructor(public url: string, public options: RequestInit) {} },
    self: { location: { origin: 'https://jm.example.test' }, addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler), skipWaiting: () => { skips++; return Promise.resolve() } },
    caches: { keys: async () => ['jm-universal-shell-fixture'], delete: async (name: string) => { deleted.push(name); return true }, open: async () => ({ match: async (url: string) => cached.get(url), put: async () => { writes++ }, addAll: async () => { if (failInstall) throw Error('Network disconnected during precache') } }) },
    fetch: async () => 'network',
  })
  function request(url: string, method = 'GET', mode = 'cors', headers: Record<string, string> = {}) {
    let response: Promise<string> | undefined
    listeners.get('fetch')?.({ request: { url: new URL(url, 'https://jm.example.test').href, method, mode, headers: new Headers(headers) }, respondWith: (value: Promise<string>) => { response = value } })
    return response
  }
  function install() {
    let result: Promise<void> | undefined
    listeners.get('install')?.({ waitUntil: (value: Promise<void>) => { result = value } })
    if (!result) throw Error('Missing install handler')
    return result
  }
  return { request, install, deleted, writes: () => writes, skips: () => skips, message: (data: unknown) => listeners.get('message')?.({ data }) }
}

test('private API, files, sockets, admin endpoints and unknown navigation never use the shell cache', () => {
  const sw = worker()
  for (const url of ['/api/jm/messages/', '/api/jm/files/a/download/', '/ws/', '/files/private.pdf', '/media/avatar', '/django-admin/', '/healthz', '/readyz', '/unknown']) {
    assert.equal(sw.request(url, 'GET', 'navigate'), undefined, url)
    assert.equal(sw.request(url), undefined, url)
  }
})

test('cross-origin, mutations, range and query-string asset requests bypass the cache', () => {
  const sw = worker()
  assert.equal(sw.request('https://outside.example/index.html', 'GET', 'navigate'), undefined)
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) assert.equal(sw.request('/messenger', method, 'navigate'), undefined)
  assert.equal(sw.request('/_expo/static/app.js?private=1'), undefined)
  assert.equal(sw.request('/_expo/static/app.js', 'GET', 'cors', { Range: 'bytes=0-100' }), undefined)
})

test('known app routes and build assets load offline; uncached responses are never written into cache', async () => {
  const sw = worker()
  for (const route of ['/', '/login', '/messenger?c=123', '/profile', '/invite/token', '/reset-password/token']) assert.equal(await sw.request(route, 'GET', 'navigate'), 'public shell')
  assert.equal(await sw.request('/_expo/static/app.js'), 'public code')
  assert.equal(await sw.request('/assets/unknown.png'), 'network')
  assert.equal(sw.writes(), 0)
})

test('updates activate only in response to the explicit update message', () => {
  const sw = worker()
  sw.message(null); sw.message({ type: 'OTHER' })
  assert.equal(sw.skips(), 0)
  sw.message({ type: 'SKIP_WAITING' })
  assert.equal(sw.skips(), 1)
})

test('interrupted precache rejects installation and removes only its own failed candidate', async () => {
  const sw = worker(true)
  await assert.rejects(sw.install(), /Network disconnected/)
  assert.deepEqual(sw.deleted, ['jm-universal-shell-fixture'])
  assert.equal(sw.skips(), 0)
  const successful = worker()
  await successful.install()
  assert.deepEqual(successful.deleted, [])
})

test('every Expo Router page is served the SPA shell by the service worker, preview server and nginx template', async () => {
  const appDir = path.join(__dirname, '..', 'src', 'app')
  const pages: string[] = []
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) { walk(path.join(dir, entry.name), `${prefix}/${entry.name}`); continue }
      const name = entry.name.replace(/\.(?:web\.|native\.)?tsx?$/, '')
      if (name === entry.name || name.startsWith('_') || name.startsWith('+')) continue
      pages.push(`${prefix}/${name === 'index' ? '' : name}`.replace(/\[[^\]]+\]/g, 'sample-token').replace(/\/$/, '') || '/')
    }
  }
  walk(appDir, '')
  assert.ok(pages.includes('/tools') && pages.includes('/group-edit') && pages.includes('/invite/sample-token'), pages.join(','))
  const preview = fs.readFileSync(path.join(__dirname, 'preview-web.cts'), 'utf8').match(/const shellRoute = (\/.+\/)\s*$/m)?.[1]
  assert.ok(preview, 'preview-web.cts shellRoute')
  const previewRoute = vm.runInNewContext(preview) as RegExp
  const nginx = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'nginx-universal.conf.example'), 'utf8').match(/location ~ (\^\/\(\|.+\$) \{\s*try_files \$uri \/index\.html;/)?.[1]
  assert.ok(nginx, 'nginx SPA shell location')
  const nginxRoute = new RegExp(nginx)
  const sw = worker()
  for (const page of pages) {
    for (const url of [page, page === '/' ? '/' : `${page}/`]) {
      assert.equal(await sw.request(url, 'GET', 'navigate'), 'public shell', `service worker ${url}`)
      assert.ok(previewRoute.test(url), `preview ${url}`)
      assert.ok(nginxRoute.test(url), `nginx ${url}`)
    }
  }
  for (const url of ['/api/jm/', '/django-admin/', '/unknown', '/media/x']) assert.ok(!previewRoute.test(url) && !nginxRoute.test(url), url)
})
