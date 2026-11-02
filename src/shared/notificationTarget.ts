export type Target = { pathname: '/messenger' | '/passwords' | '/admin' | '/profile' | '/notifications'; params?: Record<string, string> }
export function notificationTarget(link: string | null | undefined): Target | null {
 if (!link || !link.startsWith('/') || link.startsWith('//') || /[\\\x00-\x20]/.test(link)) return null
 const [path, query = ''] = link.split('?'); const params = new URLSearchParams(query); const parts = path.split('/').filter(Boolean)
 if (parts.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return null
 if (parts[0] === 'messenger' && parts.length <= 2) { const seq = params.get('seq'); const conversation = parts[1] || params.get('conversation'); return { pathname: '/messenger', params: { ...(conversation && /^[a-zA-Z0-9_-]+$/.test(conversation) ? { conversation } : {}), ...(seq && /^[1-9]\d*$/.test(seq) && Number.isSafeInteger(Number(seq)) ? { seq } : {}) } } }
 if (parts[0] === 'passwords') {
  if (parts.length === 1) { const selected: Record<string, string> = {}; for (const key of ['entry','vault']) { const value = params.get(key); if (value && /^[a-zA-Z0-9_-]+$/.test(value)) selected[key] = value }; const view = params.get('view'); if (view && ['shared','admin','break-glass','activity'].includes(view)) selected.view = view; return { pathname: '/passwords', ...(Object.keys(selected).length ? { params: selected } : {}) } }
  if (parts.length === 2 && ['shared', 'admin', 'break-glass'].includes(parts[1])) return { pathname: '/passwords', params: { view: parts[1] } }
  if (parts[1] === 'entries' && parts.length === 3) return { pathname: '/passwords', params: { entry: parts[2] } }
  if (parts[1] === 'vaults' && (parts.length === 3 || parts.length === 4 && parts[3] === 'activity')) return { pathname: '/passwords', params: { vault: parts[2], ...(parts[3] || params.get('tab') === 'activity' ? { view: 'activity' } : {}) } }
 }
 if (parts[0] === 'admin') { if (parts.length === 2 && parts[1] === 'alerts') return { pathname: '/notifications', params: { view: 'alerts' } }; if (parts.length === 1) { const selected: Record<string, string> = {}; const tab = params.get('tab'); const user = params.get('user'); if (tab && ['people','companies','groups','security'].includes(tab)) selected.tab = tab; if (user && /^[a-zA-Z0-9_-]+$/.test(user)) selected.user = user; return { pathname: '/admin', ...(Object.keys(selected).length ? { params: selected } : {}) } }; if (parts[1] === 'users' && parts.length === 3) return { pathname: '/admin', params: { tab: 'people', user: parts[2] } }; if (parts.length === 2 && ['users','companies','groups','security'].includes(parts[1])) return { pathname: '/admin', params: { tab: parts[1] === 'users' ? 'people' : parts[1] } } }
 if (parts.length === 1 && (parts[0] === 'profile' || parts[0] === 'notifications')) return { pathname: '/' + parts[0] as '/profile' | '/notifications', ...(parts[0] === 'notifications' && params.get('view') === 'alerts' ? { params: { view: 'alerts' } } : {}) }
 return null
}
