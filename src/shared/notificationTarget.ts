export type Target = { pathname: '/messenger' | '/passwords' | '/admin' | '/profile' | '/notifications'; params?: Record<string, string> }
export function notificationTarget(link: string | null | undefined): Target | null {
 if (!link || !link.startsWith('/') || link.startsWith('//') || /[\\\x00-\x20]/.test(link)) return null
 const [path, query = ''] = link.split('?'); const params = new URLSearchParams(query); const parts = path.split('/').filter(Boolean)
 if (parts.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return null
 if (parts[0] === 'messenger' && parts.length <= 2) { const seq = params.get('seq'); return { pathname: '/messenger', params: { ...(parts[1] ? { conversation: parts[1] } : {}), ...(seq && /^[1-9]\d*$/.test(seq) && Number.isSafeInteger(Number(seq)) ? { seq } : {}) } } }
 if (parts[0] === 'passwords') {
  if (parts.length === 1) return { pathname: '/passwords' }
  if (parts.length === 2 && ['shared', 'admin', 'break-glass'].includes(parts[1])) return { pathname: '/passwords', params: { view: parts[1] } }
  if (parts[1] === 'entries' && parts.length === 3) return { pathname: '/passwords', params: { entry: parts[2] } }
  if (parts[1] === 'vaults' && (parts.length === 3 || parts.length === 4 && parts[3] === 'activity')) return { pathname: '/passwords', params: { vault: parts[2], ...(parts[3] || params.get('tab') === 'activity' ? { view: 'activity' } : {}) } }
 }
 if (parts[0] === 'admin') { if (parts.length === 2 && parts[1] === 'alerts') return { pathname: '/notifications', params: { view: 'alerts' } }; if (parts.length === 1) return { pathname: '/admin' }; if (parts[1] === 'users' && parts.length === 3) return { pathname: '/admin', params: { tab: 'people', user: parts[2] } }; if (parts.length === 2 && ['users','companies','groups','approvals','security'].includes(parts[1])) return { pathname: '/admin', params: { tab: parts[1] === 'users' ? 'people' : parts[1] } } }
 if (parts.length === 1 && (parts[0] === 'profile' || parts[0] === 'notifications')) return { pathname: '/' + parts[0] as '/profile' | '/notifications' }
 return null
}
