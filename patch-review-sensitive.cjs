const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')))}function rep(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b)}
fs.writeFileSync('src/shared/sensitive.ts',`export class SensitiveRequestGuard {
  private generation = 0
  private active = true
  begin() { return ++this.generation }
  clear() { this.generation++ }
  setActive(active: boolean) { this.active = active; if (!active) this.clear() }
  accepts(generation: number) { return this.active && generation === this.generation }
}
`);
fs.writeFileSync('src/shared/sensitiveLifecycle.ts',`export { subscribeLifecycle as subscribeSensitiveView } from '../core/realtime/lifecycle'\n`);
fs.writeFileSync('src/shared/sensitiveLifecycle.web.ts',`export function subscribeSensitiveView(handler: (active: boolean) => void) {
  if (typeof document === 'undefined') return () => {}
  const update = () => handler(document.visibilityState === 'visible' && document.hasFocus())
  const blur = () => handler(false)
  document.addEventListener('visibilitychange', update)
  window.addEventListener('focus', update); window.addEventListener('blur', blur)
  update()
  return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); window.removeEventListener('blur', blur) }
}
`);
edit('src/components/ProfilePanel.tsx',s=>{s=rep(s,'useEffect, useState','useEffect, useRef, useState');s=rep(s,"import { subscribeLifecycle } from '../core/realtime/lifecycle'","import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'\nimport { SensitiveRequestGuard } from '../shared/sensitive'");s=rep(s,'useEffect(() => subscribeLifecycle(active => { if (!active) setRecoveryCodes([]) }), [])',`const recoveryGuard = useRef(new SensitiveRequestGuard())
  const clearRecovery = () => { recoveryGuard.current.clear(); setRecoveryCodes([]) }
  useEffect(() => { const off = subscribeSensitiveView(active => { recoveryGuard.current.setActive(active); if (!active) setRecoveryCodes([]) }); return () => { off(); recoveryGuard.current.setActive(false) } }, [])`);s=rep(s,'const result = await addPasskey(passkeyName.trim()); setRecoveryCodes(result.recovery_codes ?? [])','const generation = recoveryGuard.current.begin(); const result = await addPasskey(passkeyName.trim()); if (recoveryGuard.current.accepts(generation)) setRecoveryCodes(result.recovery_codes ?? [])');s=rep(s,"const { data } = await api.post<{ recovery_codes: string[] }>('/auth/recovery-codes/regenerate/'); setRecoveryCodes(data.recovery_codes)","const generation = recoveryGuard.current.begin(); const { data } = await api.post<{ recovery_codes: string[] }>('/auth/recovery-codes/regenerate/'); if (recoveryGuard.current.accepts(generation)) setRecoveryCodes(data.recovery_codes)");return s.replaceAll('onClose={() => setRecoveryCodes([])}','onClose={clearRecovery}').replaceAll('onPress={() => setRecoveryCodes([])}','onPress={clearRecovery}');});
fs.writeFileSync('src/modules/passwords/secretInput.ts',`export function customSecretFields(custom: { name: string; value: string }[], removed: string[] = []) {
  const fields: Record<string, string | null> = Object.create(null)
  custom.filter(field => field.name.trim() && field.value).forEach(field => { fields[field.name.trim()] = field.value })
  removed.forEach(name => { fields[name] = null })
  return Object.keys(fields).length ? fields : undefined
}
`);
edit('src/components/VaultPanel.tsx',s=>{s=rep(s,"import { subscribeLifecycle } from '../core/realtime/lifecycle'","import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'\nimport { customSecretFields } from '../modules/passwords/secretInput'");s=s.replaceAll('subscribeLifecycle(', 'subscribeSensitiveView(');s=rep(s,"const requestId = useRef(randomUUID())",`const [removeFields, setRemoveFields] = useState<string[]>([])
  const [existingFields, setExistingFields] = useState<string[]>([])
  useEffect(() => { let active = true; if (entry) vault.getEntry(entry.id).then(value => { if (active) setExistingFields(value.secret_fields?.filter(f => !['password', 'notes', 'totp', 'totp_seed'].includes(f)) ?? []) }).catch(() => {}); return () => { active = false } }, [entry])
  const requestId = useRef(randomUUID())`);s=s.replace('[title, username, url, kind, tags, password, notes, custom]','[title, username, url, kind, tags, password, notes, custom, removeFields]');s=rep(s,'custom.length ? Object.fromEntries(custom.map(field => [field.name.trim(), field.value])) : undefined','customSecretFields(custom, removeFields)');s=rep(s,'{custom.map((field, index)',`{existingFields.map(name => <Button key={name} title={(removeFields.includes(name) ? 'Undo removal: ' : 'Remove stored field: ') + name} onPress={() => setRemoveFields(fields => fields.includes(name) ? fields.filter(f => f !== name) : [...fields, name])} />)}
    {custom.map((field, index)`);return s;});
