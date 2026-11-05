import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Link, type Href } from 'expo-router'
import { isAxiosError } from 'axios'
import { errorMessage } from '../../core/api/client'
import { useResource } from '../../shared/useResource'
import { SensitiveRequestGuard } from '../../shared/sensitive'
import { subscribeSensitiveView } from '../../shared/sensitiveLifecycle'
import { formatDateTime } from '../../shared/utils/format'
import { Button, Card, EmptyState, Label, Surface, styles, useColors } from '../../ui'
import { Icon, type IconName } from '../../components/Icon'
import { Badge, IconTextButton, PageHeader, PillTabs } from '../../components/AdminUi'
import { Sheet } from '../../components/Sheet'
import { approvalsChanged, decide, listApprovals } from './api'
import { FILTERS, KIND_LABEL, appHref, badgeText, confirmCopy, doneMessage, emptyTitle, metaLine, resultLink, rowsFor, statusFor, statusTone, type ApprovalDecision, type ApprovalFilter, type ApprovalItem } from './model'

const KIND_ICON: Record<string, { icon: IconName; color: string }> = { admin: { icon: 'shieldCheck', color: '#d97706' }, vault_owner: { icon: 'key', color: '#7c3aed' }, emergency_access: { icon: 'lifeBuoy', color: '#e11d48' } }
const isStepUpCancel = (e: unknown) => isAxiosError(e) && (e.response?.data as { code?: string } | undefined)?.code === 'step_up_required'

/**
 * Approvals (Frontend FE-023): everything waiting on you and what you asked for, in one place. Approve / Deny /
 * Withdraw post to each request's own endpoint; "Confirm it's you" is the shared StepUp sheet via the transport.
 */
export function ApprovalsScreen() {
  const c = useColors()
  const [filter, setFilter] = useState<ApprovalFilter>('waiting')
  const status = statusFor(filter)
  const load = useCallback(() => listApprovals(status), [status])
  const list = useResource(load)
  const [confirming, setConfirming] = useState<{ item: ApprovalItem; d: 'approve' | 'deny' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [link, setLink] = useState('')
  const guard = useRef(new SensitiveRequestGuard())
  useEffect(() => { const current = guard.current; const off = subscribeSensitiveView(active => { current.setActive(active); if (!active) setLink('') }); return () => { off(); current.setActive(false) } }, [])
  const clearLink = () => { guard.current.clear(); setLink('') }

  async function act(item: ApprovalItem, d: ApprovalDecision) {
    if (busy) return
    setBusy(`${item.kind}-${item.id}`); setError(''); setNotice('')
    const generation = guard.current.begin()
    try {
      const result = await decide(item, d)
      setConfirming(null)
      const once = resultLink(result)
      if (once && guard.current.accepts(generation)) setLink(once)
      setNotice(doneMessage(d))
      list.refresh(); approvalsChanged()
    } catch (e) {
      setConfirming(null)
      if (!isStepUpCancel(e)) setError(errorMessage(e))
    } finally { setBusy(null) }
  }

  const all = list.value?.results ?? []
  const rows = rowsFor(all, filter)
  const waiting = badgeText(list.value?.waiting_on_me)
  const copy = confirming ? confirmCopy(confirming.item, confirming.d) : null

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { gap: 0 }]}>
    <PageHeader title="Approvals" />
    <View style={{ marginBottom: 16 }}><PillTabs label="Show" value={filter} options={FILTERS} onChange={value => { setFilter(value); setError(''); setNotice('') }} badge={{ waiting: waiting || undefined }} /></View>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: 'Inter_400Regular' }}>{error}</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: c.primary, fontFamily: 'Inter_500Medium' }}>{notice}</Text>}
    {list.loading && <ActivityIndicator accessibilityLabel="Loading approvals" />}
    {!!list.error && <Card><Label>{errorMessage(list.error)}</Label><Button title="Retry" variant="secondary" onPress={list.refresh} /></Card>}
    {!list.loading && !list.error && rows.length === 0 && <EmptyState title={emptyTitle(filter)} />}
    <View accessibilityLabel="Approvals" style={{ gap: 12, marginTop: error || notice ? 12 : 0 }}>
      {rows.map(item => { const key = `${item.kind}-${item.id}`; const kind = KIND_ICON[item.kind] ?? KIND_ICON.admin; const badgeTone = ({ warning: 'warning', success: 'success', danger: 'danger', neutral: 'neutral' } as const)[statusTone(item.status)] ?? 'neutral'; return <Surface key={key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, padding: 16 }}>
        <View style={{ marginTop: 2 }}><Icon name={kind.icon} size={20} color={kind.color} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} ellipsizeMode="clip" style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: c.muted }}>{KIND_LABEL[item.kind]?.toUpperCase() ?? item.kind}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 16, lineHeight: 24, color: c.text }}>{item.title}</Text>
            {!!item.subject && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, color: c.muted }}>· {item.subject}</Text>}
            <Badge tone={badgeTone}>{item.status}</Badge>
          </View>
          <Text style={{ marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{metaLine(item, formatDateTime)}</Text>
          {!!item.reason && <Text style={{ marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.text }}>“{item.reason}”</Text>}
          <Link replace href={appHref(item) as Href} accessibilityLabel={`Open ${item.title}`} style={{ marginTop: 4, alignSelf: 'flex-start', fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16, color: c.brand, textDecorationLine: 'none' }}>Open</Link>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {item.can.decide && <><IconTextButton size="sm" icon="check" title="Approve" accessibilityLabel={`Approve ${item.title}`} disabled={!!busy} onPress={() => setConfirming({ item, d: 'approve' })} /><IconTextButton size="sm" icon="x" title="Deny" variant="secondary" accessibilityLabel={`Deny ${item.title}`} disabled={!!busy} onPress={() => setConfirming({ item, d: 'deny' })} /></>}
          {item.can.cancel && <IconTextButton size="sm" title={busy === key ? 'Withdrawing…' : 'Withdraw'} accessibilityLabel="Withdraw" variant="ghost" disabled={!!busy} onPress={() => void act(item, 'cancel')} />}
        </View>
      </Surface> })}
    </View>
    <Sheet visible={!!confirming} onClose={() => { if (!busy) setConfirming(null) }}>
      {confirming && copy && <><Label large>{copy.title}</Label><Label>{copy.body}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
          <Button title="Cancel" variant="secondary" disabled={!!busy} onPress={() => setConfirming(null)} />
          <Button title={busy ? 'Working…' : copy.label} disabled={!!busy} style={confirming.d === 'approve' ? { backgroundColor: c.danger } : undefined} onPress={() => void act(confirming.item, confirming.d)} />
        </View></>}
    </Sheet>
    <Sheet visible={!!link} onClose={clearLink}>
      <Label large>Password reset link</Label>
      <Label>Single use. Hand it to the person yourself (you are the second administrator). It is shown only now and clears when this view loses focus.</Label>
      <Text selectable style={{ color: c.text, fontFamily: 'Inter_400Regular' }}>{link}</Text>
      <Button title="Close reset link" onPress={clearLink} />
    </Sheet>
  </ScrollView>
}
