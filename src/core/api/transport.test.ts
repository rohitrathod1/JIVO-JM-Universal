import { describe, expect, it, vi } from 'vitest'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createTransport, normalizeOrigin } from './transport'
function setup(csrf: string | undefined = 'csrf-test') {
  const read = vi.fn(async (): Promise<string | undefined> => csrf); const lost = vi.fn()
  return { ...createTransport({ origin: 'https://test.example.invalid', native: true, csrf: read, lost }), read, lost }
}
const success = async (config: InternalAxiosRequestConfig) => ({ data: [], status: 200, statusText: 'OK', headers: {}, config })
function failure(config: InternalAxiosRequestConfig, status: number, data: object) {
  return Promise.reject(new AxiosError('Rejected', undefined, config, undefined, { data, status, statusText: '', headers: {}, config }))
}
describe('transport security contracts', () => {
  it('rejects unconfigured endpoints before reaching the adapter', async () => {
    const { api } = createTransport({ origin: '', native: false, csrf: async () => undefined, lost: () => {} })
    const adapter = vi.fn(success)
    await expect(api.get('/me/', { adapter })).rejects.toThrow('Configure EXPO_PUBLIC_API_ORIGIN')
    expect(adapter).not.toHaveBeenCalled()
  })
  it.each(['http://example.org', 'https://user:secret@example.org', 'https://example.org/api', 'https://example.org/?token=x'])('rejects unsafe origin %s', value => {
    expect(() => normalizeOrigin(value)).toThrow()
  })
  it('allows HTTPS and local loopback only', () => {
    expect(normalizeOrigin('https://test.example.invalid/')).toBe('https://test.example.invalid')
    expect(normalizeOrigin('http://127.0.0.1:8081')).toBe('http://127.0.0.1:8081')
  })
  it('uses the current CSRF cookie for every unsafe request without writing Origin or Cookie', async () => {
    const { api, read } = setup()
    read.mockResolvedValueOnce('before-login').mockResolvedValueOnce('after-login')
    const adapter = vi.fn(success)
    await api.post('/auth/login/', {}, { adapter }); await api.post('/conversations/', {}, { adapter })
    expect(adapter.mock.calls.map(([c]) => c.headers.get('X-CSRFToken'))).toEqual(['before-login', 'after-login'])
    for (const [config] of adapter.mock.calls) {
      expect(config.headers.has('Cookie')).toBe(false); expect(config.headers.has('Origin')).toBe(false); expect(config.headers.has('Referer')).toBe(false)
      expect(config.withCredentials).toBe(true)
    }
  })
  it('fails closed if the CSRF cookie is unavailable', async () => {
    const { api, read } = setup(); read.mockResolvedValue(undefined)
    const adapter = vi.fn(success)
    await expect(api.post('/auth/login/', {}, { adapter })).rejects.toThrow('no CSRF cookie')
    expect(adapter).not.toHaveBeenCalled()
  })
  it('resolves JP requests to the same approved origin', async () => {
    const { api } = setup(); const adapter = vi.fn(success)
    await api.get('/vaults/', { baseURL: '/api/jp', adapter })
    expect(adapter.mock.calls[0][0].baseURL).toBe('https://test.example.invalid/api/jp')
  })
  it.each(['https://attacker.invalid', '//attacker.invalid', '/../elsewhere', '/%2e%2e/elsewhere', '/a\\b'])('rejects non-API or traversal URL %s', async url => {
    const { api } = setup(); const adapter = vi.fn(success)
    await expect(api.get(url, { adapter })).rejects.toThrow('Invalid API path')
    expect(adapter).not.toHaveBeenCalled()
  })
  it('notifies session loss on expiry but not incorrect login', async () => {
    const { api, lost } = setup()
    await expect(api.get('/me/', { adapter: c => failure(c, 401, {}) })).rejects.toThrow()
    expect(lost).toHaveBeenCalledOnce()
    await expect(api.post('/auth/login/', {}, { adapter: c => failure(c, 401, {}) })).rejects.toThrow()
    expect(lost).toHaveBeenCalledOnce()
  })
  it('retries step-up only once and only after explicit successful verification', async () => {
    const { api, onStepUpRequired } = setup()
    const handler = vi.fn(async () => true); onStepUpRequired(handler)
    const adapter = vi.fn(c => failure(c, 403, { code: 'step_up_required', scope: 'jp', methods: ['password'] }))
    await expect(api.post('/unlock/', {}, { adapter })).rejects.toThrow()
    expect(handler).toHaveBeenCalledExactlyOnceWith('jp', ['password'], undefined); expect(adapter).toHaveBeenCalledTimes(2)
  })
  it('does not retry cancelled verification', async () => {
    const { api, onStepUpRequired } = setup(); onStepUpRequired(async () => false)
    const adapter = vi.fn(c => failure(c, 403, { code: 'step_up_required' }))
    await expect(api.post('/unlock/', {}, { adapter })).rejects.toThrow()
    expect(adapter).toHaveBeenCalledOnce()
  })
})

it('ignores a delayed 401 from a previous session generation', async () => {
  const { api, lost, advanceSession } = setup()
  let reject!: (error: AxiosError) => void
  let config!: InternalAxiosRequestConfig
  const request = api.get('/me/', { adapter: c => { config = c; return new Promise((_, r) => { reject = r }) } })
  const assertion = expect(request).rejects.toThrow('Old request')
  await vi.waitFor(() => expect(config).toBeDefined())
  advanceSession()
  reject(new AxiosError('Old request', undefined, config, undefined, { status: 401, statusText: '', data: {}, headers: {}, config }))
  await assertion; expect(lost).not.toHaveBeenCalled()
})

describe('JSON Blob step-up responses',()=>{
 const challenge=()=>new Blob([JSON.stringify({code:'step_up_required',scope:'vault_download',methods:['password']})],{type:'application/json'})
 it('decodes the Blob and retries the original download once after verification',async()=>{const t=setup();const handler=vi.fn(async()=>true);t.onStepUpRequired(handler);const controller=new AbortController();const adapter=vi.fn(async c=>adapter.mock.calls.length===1?failure(c,403,challenge()):({...await success(c),data:new Blob(['MOCK'])}));const result=await t.api.post('/files/x/download/',{}, {adapter,responseType:'blob',signal:controller.signal});expect(handler).toHaveBeenCalledWith('vault_download',['password'],controller.signal);expect(adapter).toHaveBeenCalledTimes(2);expect(result.data).toBeInstanceOf(Blob)})
 it('does not retry when verification is cancelled',async()=>{const t=setup();t.onStepUpRequired(async()=>false);const adapter=vi.fn(c=>failure(c,403,challenge()));await expect(t.api.post('/files/x/download/',{}, {adapter,responseType:'blob'})).rejects.toThrow();expect(adapter).toHaveBeenCalledOnce()})
 it('does not retry after abort during verification',async()=>{const t=setup();const controller=new AbortController();t.onStepUpRequired(async()=>{controller.abort();return true});const adapter=vi.fn(c=>failure(c,403,challenge()));await expect(t.api.post('/files/x/download/',{}, {adapter,responseType:'blob',signal:controller.signal})).rejects.toThrow();expect(adapter).toHaveBeenCalledOnce()})
 it('does not retry after account replacement during verification',async()=>{const t=setup();t.onStepUpRequired(async()=>{t.advanceSession();return true});const adapter=vi.fn(c=>failure(c,403,challenge()));await expect(t.api.post('/files/x/download/',{}, {adapter,responseType:'blob'})).rejects.toThrow();expect(adapter).toHaveBeenCalledOnce()})
 it('does not parse arbitrary binary responses as verification challenges',async()=>{const t=setup();const handler=vi.fn(async()=>true);t.onStepUpRequired(handler);await expect(t.api.post('/files/x/download/',{}, {adapter:c=>failure(c,403,new Blob(['MOCK'],{type:'application/octet-stream'})),responseType:'blob'})).rejects.toThrow();expect(handler).not.toHaveBeenCalled()})
})
