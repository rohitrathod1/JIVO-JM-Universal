import { useCallback, useEffect, useState } from 'react'
import { realtime } from '../core/realtime/socket'
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native'
import * as alerts from '../modules/notifications/api'
import { useCursor } from '../shared/useCursor'
import { useSession } from '../core/auth/Session'
import { errorMessage } from '../core/api/client'
import { Button, Card, Field, Label, styles, useColors } from '../ui'
import { Sheet } from './Sheet'
function AlertComposer({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const c = useColors(); const [title, setTitle] = useState(''); const [message, setMessage] = useState(''); const [severity, setSeverity] = useState<alerts.AlertSeverity>('info')
  const [audience, setAudience] = useState<'all' | 'selected'>('selected'); const [recipients, setRecipients] = useState<string[]>([]); const [query, setQuery] = useState(''); const [expires, setExpires] = useState(''); const [dismissible, setDismissible] = useState(true)
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback((cursor?: string | null) => audience === 'selected' ? alerts.alertPeople(query, cursor) : Promise.resolve({ results: [], next_cursor: null }), [audience, query]); const people = useCursor(load)
  const validExpiry = !expires || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expires) && Number.isFinite(Date.parse(expires))
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>Compose alert</Label>
    {!confirm ? <><Field label="Alert title" value={title} onChangeText={setTitle} /><Field label="Alert message" value={message} onChangeText={setMessage} multiline />
      <Label>Severity</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['info', 'warning', 'critical'] as const).map(value => <Button key={value} title={`${value}${severity === value ? ' selected' : ''}`} onPress={() => setSeverity(value)} />)}</View>
      <Label>Audience</Label><Button title={audience === 'selected' ? 'Selected people selected' : 'Use selected people'} onPress={() => setAudience('selected')} /><Button title={audience === 'all' ? 'Everyone selected' : 'Use everyone'} onPress={() => setAudience('all')} />
      {audience === 'selected' && <><Field label="Find alert recipients" value={query} onChangeText={setQuery} />{people.items.map(person => <Button key={person.id} title={`${recipients.includes(person.id) ? 'Selected: ' : ''}${person.name} (${person.email})`} onPress={() => setRecipients(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id])} />)}{people.cursor && <Button title="More alert recipients" disabled={people.loading} onPress={() => void people.more()} />}</>}
      <Field label="Alert expiry UTC (optional, YYYY-MM-DDTHH:MM:SSZ)" value={expires} onChangeText={setExpires} autoCapitalize="none" /><Label>Allow recipients to dismiss</Label><Switch accessibilityLabel="Allow alert dismissal" value={dismissible} onValueChange={setDismissible} />
      <Button title="Review alert" disabled={!title.trim() || !message.trim() || !validExpiry || audience === 'selected' && !recipients.length} onPress={() => setConfirm(true)} />
    </> : <Card><Label large>{title}</Label><Label>{message}</Label><Label>{severity} · {audience === 'all' ? 'Everyone' : `${recipients.length} selected people`}</Label><Button title="Send reviewed alert" disabled={busy} onPress={() => { if (expires && Date.parse(expires) <= Date.now()) { setError('Choose a future alert expiry.'); return } setBusy(true); void alerts.createAlert({ title: title.trim(), message: message.trim(), severity, audience, ...(audience === 'selected' ? { user_ids: recipients } : {}), expires_at: expires || null, dismissible }).then(onSent).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /><Button title="Edit alert draft" disabled={busy} onPress={() => setConfirm(false)} /></Card>}
    {!!(error || people.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || people.error}</Text>}<Button title="Close alert draft" disabled={busy} onPress={onClose} />
  </Sheet>
}
export function AlertsPanel() {
  const c = useColors(); const { me } = useSession(); const canSend = me?.capabilities.includes('JM_SEND_ALERT') ?? false
  const [scope, setScope] = useState<'active' | 'history' | 'sent'>('active'); const [composer, setComposer] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<{ title: string; action: () => Promise<unknown> } | null>(null)
  const load = useCallback(async (cursor?: string | null) => scope === 'sent' && canSend ? alerts.adminAlerts(cursor) : scope === 'history' ? alerts.alertHistory(cursor) : { results: await alerts.activeAlerts(), next_cursor: null }, [scope, canSend]); const page = useCursor(load)
  const refresh = page.refresh
  useEffect(() => realtime.on('*', frame => { if (frame.type === 'RESYNC' || frame.type.startsWith('ALERT_')) void refresh() }), [refresh])
  async function run(action: () => Promise<unknown>) { if (busy) return; setBusy(true); setError(''); try { await action(); setConfirm(null); await page.refresh() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  return <ScrollView contentContainerStyle={styles.page}><Label large>Alerts</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title={scope === 'active' ? 'Active alerts selected' : 'Active alerts'} onPress={() => setScope('active')} /><Button title={scope === 'history' ? 'Alert history selected' : 'Alert history'} onPress={() => setScope('history')} />{canSend && <Button title={scope === 'sent' ? 'Sent alerts selected' : 'Sent alerts'} onPress={() => setScope('sent')} />}</View>
    {canSend && <Button title="Compose alert" disabled={busy} onPress={() => setComposer(true)} />}{!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || page.error}</Text>}
    {page.items.map(alert => <Card key={alert.id}><Label large>{alert.title}</Label><Label>{alert.message}</Label><Label>{alert.severity} · {alert.status} · {new Date(alert.created_at).toLocaleString()}</Label>
      {scope !== 'sent' && alert.dismissible && !alert.dismissed_at && alert.status === 'active' && <Button title={`Dismiss ${alert.title}`} disabled={busy} onPress={() => void run(() => alerts.dismissAlert(alert.id))} />}
      {scope === 'sent' && canSend && <Button title={`${alert.status === 'active' ? 'Cancel' : 'Remove'} sent alert ${alert.title}`} disabled={busy} onPress={() => setConfirm({ title: `${alert.status === 'active' ? 'Cancel this active alert for recipients' : 'Remove this alert from the sent list'}?`, action: () => alert.status === 'active' ? alerts.cancelAlert(alert.id) : alerts.deleteAlert(alert.id) })} />}
    </Card>)}{page.loading && <ActivityIndicator />}{!page.loading && !page.items.length && <Label>No alerts in this view.</Label>}{page.cursor && <Button title="More alerts" disabled={page.loading} onPress={() => void page.more()} />}
    {composer && <AlertComposer onClose={() => setComposer(false)} onSent={() => { setComposer(false); setScope('sent'); void page.refresh() }} />}
    <Sheet visible={Boolean(confirm)} onClose={() => { if (!busy) setConfirm(null) }}><Label>{confirm?.title}</Label><Button title="Confirm alert change" disabled={busy} onPress={() => { if (confirm) void run(confirm.action) }} /><Button title="Cancel alert change" disabled={busy} onPress={() => setConfirm(null)} /></Sheet>
  </ScrollView>
}
