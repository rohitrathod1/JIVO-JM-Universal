import { create, isAxiosError, type InternalAxiosRequestConfig } from 'axios'
export interface TransportOptions {
  origin: string; native: boolean
  csrf: (url: string) => Promise<string | undefined>
  lost: () => void
}
export function normalizeOrigin(value: string): string {
  if (!value) return ''
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('API origin must be a plain origin without credentials, path or query.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Use HTTPS for the API origin (HTTP is allowed only on loopback).')
  return url.origin
}
export type StepUpHandler = (scope: string, methods: string[], signal?: AbortSignal) => Promise<boolean>
type RetryConfig = InternalAxiosRequestConfig & { _stepUpRetried?: boolean; _sessionEpoch?: number }
export function createTransport(options: TransportOptions) {
  const origin = normalizeOrigin(options.origin)
  const api = create({ baseURL: `${origin}/api/jm`, timeout: 20000, withCredentials: true,
    xsrfCookieName: 'jm_csrftoken', xsrfHeaderName: 'X-CSRFToken', withXSRFToken: false })
  let handler: StepUpHandler | null = null
  let sessionEpoch = 0
  api.interceptors.request.use(async config => {
    (config as RetryConfig)._sessionEpoch ??= sessionEpoch
    if (!origin) throw new Error('Configure EXPO_PUBLIC_API_ORIGIN with an approved test server before signing in.')
    if (config.baseURL === '/api/jp') config.baseURL = `${origin}/api/jp`
    if (config.baseURL !== `${origin}/api/jm` && config.baseURL !== `${origin}/api/jp`) throw new Error('API request outside the configured JM/JP origin was blocked.')
    if (!config.url?.startsWith('/') || config.url.startsWith('//') || config.url.includes('\\') || config.url.split('/').some(s => s === '..' || /%2e|%2f|%5c/i.test(s))) throw new Error('Invalid API path.')
    if (!['GET', 'HEAD', 'OPTIONS'].includes((config.method ?? 'get').toUpperCase())) {
      const csrf = await options.csrf(`${origin}/api/jm/`)
      if ((config as RetryConfig)._sessionEpoch !== sessionEpoch) throw new Error('This request belongs to a previous session.')
      if (!csrf) throw new Error(options.native
        ? 'The native cookie store has no CSRF cookie. Verify the existing server cookie/CSRF contract; no security checks were bypassed.'
        : 'The CSRF cookie is unavailable. Use the approved same-host test setup and retry sign-in.')
      config.headers.set('X-CSRFToken', csrf)
    }
    return config
  })
  api.interceptors.response.use(r => r, async error => {
    const config = error.config as RetryConfig | undefined
    const raw: unknown = error.response?.data
    // Blob downloads still return JSON error bodies. Decode only bounded JSON errors, never file content.
    if (typeof Blob !== 'undefined' && raw instanceof Blob && /json/i.test(raw.type) && raw.size <= 1024 * 1024 && error.response) {
      try {
        const text = typeof raw.text === 'function' ? await raw.text() : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onerror = () => reject(Error('Cannot read API error')); reader.onload = () => resolve(String(reader.result)); reader.readAsText(raw)
        })
        error.response.data = JSON.parse(text)
      } catch { /* Preserve the original response if it is not valid JSON. */ }
    }
    const body = error.response?.data
    const url = config?.url ?? ''
    if (error.response?.status === 401 && config?._sessionEpoch === sessionEpoch && !url.startsWith('/auth/login')) options.lost()
    if (error.response?.status === 403 && body?.code === 'step_up_required' && handler && config && config._sessionEpoch === sessionEpoch &&
      !config.signal?.aborted && !config._stepUpRetried && !url.startsWith('/auth/step-up')) {
      if (await handler(body.scope ?? 'security_settings', body.methods ?? [], config.signal as AbortSignal | undefined) && !config.signal?.aborted && config._sessionEpoch === sessionEpoch) {
        return api.request({ ...config, _stepUpRetried: true } as RetryConfig)
      }
    }
    return Promise.reject(error)
  })
  return { api, advanceSession: () => { sessionEpoch++ }, onStepUpRequired: (next: StepUpHandler | null) => { handler = next } }
}
export function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data
    if (data?.code === 'csrf_failed') return 'The server rejected the CSRF check. Verify the approved origin and cookie contract; security checks have not been bypassed.'
    if (data?.code === 'step_up_required') return 'Identity verification is required for this action.'
    if (data?.errors && typeof data.errors === 'object') {
      const [key, value] = Object.entries(data.errors)[0] ?? []
      if (key) return `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : String(value)}`
    }
    return typeof data?.detail === 'string' ? data.detail : error.response ? `Request failed (${error.response.status}). Please retry.` : 'Cannot reach JM. Check your connection.'
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.'
}


