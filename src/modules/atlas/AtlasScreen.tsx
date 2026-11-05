import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { useSession } from '../../core/auth/Session'
import { AtlasIcon } from '../../components/AtlasIcon'
import { Icon } from '../../components/Icon'
import { useChatImmersive } from '../../components/WorkspaceChrome'
import { Button, EmptyState, Spinner, radius, useColors, type Colors } from '../../ui'
import { formatDateTime } from '../../shared/utils/format'
import { ATLAS_MAX_CHARS, answerView, canSend, counter, quote, type Ask } from './model'
import { useAtlasStatusEntry, useAtlasThread, useOffline } from './useAtlas'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as ViewStyle
const chatTint = (c: Colors) => web ? (c.dark ? 'rgba(2,6,23,0.4)' : 'rgba(239,234,226,0.6)') : c.chat
const time = (value: string | null) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/**
 * Ask Atlas: a private one-to-one thread with JIVO's business AI, laid out like a chat. Questions are on the
 * right, Atlas answers on the left. Text only (no attachments). Answers are shown only to the person who asked.
 */
export function AtlasScreen() {
  const { me } = useSession()
  if (!me) return <Spinner label="Loading Atlas" />
  return <AtlasThreadView key={me.id} user={me.id} />
}

function AtlasThreadView({ user }: { user: string }) {
  const c = useColors()
  useChatImmersive(true)
  const status = useAtlasStatusEntry()
  const offline = useOffline()
  const allowed = !!status.value?.enabled && !!status.value.allowed
  const thread = useAtlasThread(user, allowed)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<Ask | null>(null)
  const byId = useMemo(() => new Map(thread.asks.map(ask => [ask.id, ask])), [thread.asks])
  const count = counter(draft)
  // 429 retry_after: count down on the Retry button until the server accepts asks again.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!thread.retryAt) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [thread.retryAt])
  const wait = thread.retryAt ? Math.max(0, Math.ceil((thread.retryAt - now) / 1000)) : 0
  const blockedLine = offline ? 'You are offline. Connect to ask Atlas; earlier questions stay visible.' : null
  const sendDisabled = !allowed || offline || thread.sending || wait > 0 || !canSend(draft)

  const send = async () => {
    if (sendDisabled) return
    const text = draft
    if (await thread.thread.send(text, replyTo?.id ?? null)) { setDraft(current => current === text ? '' : current); setReplyTo(null) }
  }

  const header = <View style={{ minHeight: 60, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.shell }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => router.canGoBack() ? router.back() : router.replace('/messenger')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, ...pointer }}><Icon name="back" size={22} color={c.text} /></Pressable>
    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? '#18232e' : '#ffffff' }}><AtlasIcon size={36} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 22, color: c.text }}>Atlas</Text>
      <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>JIVO business AI. Only you see your questions and answers.</Text>
    </View>
  </View>

  // Status gates: unknown (first load), disabled, not allowed. Cached asks still show while the status is unknown offline.
  if (!status.value && !(status.failed || offline) ) return <View style={{ flex: 1 }}>{header}<View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Checking Atlas" /></View></View>
  if (!status.value && thread.asks.length === 0) return <View style={{ flex: 1 }}>{header}<EmptyState title={offline ? 'You are offline' : 'Atlas is not reachable'} description={offline ? 'Connect to the internet to ask Atlas.' : 'JM could not check Atlas right now.'} action={offline ? undefined : <Button variant="secondary" size="sm" title="Try again" onPress={status.retry} />} /></View>
  if (status.value && !status.value.enabled) return <View style={{ flex: 1 }}>{header}<EmptyState title="Atlas is not available" description="Atlas has not been switched on for JM yet." /></View>
  if (status.value && !status.value.allowed) return <View style={{ flex: 1 }}>{header}<EmptyState title="You cannot ask Atlas" description={status.value.message ?? 'Your account is not set up for Atlas. Ask an administrator for access.'} /></View>

  const older = thread.hasMore ? <View style={{ alignItems: 'center', paddingVertical: 12 }}><Button variant="secondary" size="sm" title="Load older" loading={thread.loadingOlder} disabled={offline} onPress={() => void thread.thread.loadOlder()} /></View> : <View style={{ height: 12 }} />

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {header}
    <View style={{ flex: 1, backgroundColor: chatTint(c) }}>
      {!!thread.error && <Text accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16, paddingVertical: 8, color: c.muted, fontSize: 12, lineHeight: 17, backgroundColor: c.panel, borderBottomWidth: 1, borderBottomColor: c.border }}>{thread.error}</Text>}
      {thread.asks.length === 0
        ? (thread.loading && !thread.loaded ? <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading your questions" /></View>
          : <View style={{ flex: 1, justifyContent: 'center' }}><EmptyState title="Ask Atlas anything about JIVO business" description="Sales, stock, orders or reports. Atlas answers here, usually within a minute or two; some answers take longer when Atlas checks with a colleague." action={<AtlasIcon size={64} />} /></View>)
        : <FlatList inverted data={thread.asks} keyExtractor={ask => String(ask.id)} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          ListFooterComponent={older}
          onEndReachedThreshold={0.2} onEndReached={() => { if (thread.hasMore && !thread.loadingOlder && !offline) void thread.thread.loadOlder() }}
          renderItem={({ item }) => <AskRow ask={item} parent={item.reply_to ? byId.get(item.reply_to) ?? null : null} c={c} canAct={allowed && !offline && !thread.sending}
            onReply={() => setReplyTo(item)} onRetry={() => void thread.thread.retry(item)} />} />}
    </View>
    <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 6, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.shell }}>
      {!!blockedLine && <Line icon="wifiOff" text={blockedLine} c={c} />}
      {!!thread.sendError && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><Line icon="alert" text={thread.sendError.message} c={c} danger /></View>
        {thread.sendError.retryable && <Button size="sm" variant="secondary" title={wait > 0 ? `Retry in ${wait} s` : 'Retry'} disabled={sendDisabled || wait > 0} onPress={() => void send()} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={() => thread.thread.clearSendError()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="x" size={16} color={c.muted} /></Pressable>
      </View>}
      {replyTo && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: c.brand, borderRadius: 6, backgroundColor: c.panel }}>
        <View style={{ flex: 1, paddingVertical: 6 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, color: c.brand }}>Follow up on</Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: c.muted }}>{quote(replyTo.text)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel follow-up" onPress={() => setReplyTo(null)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="x" size={16} color={c.muted} /></Pressable>
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1, borderRadius: 22, borderWidth: 1, borderColor: count.over ? c.danger : c.border, backgroundColor: web ? c.input : c.panel, paddingHorizontal: 14, paddingVertical: 6 }}>
          <TextInput value={draft} onChangeText={value => { setDraft(value); if (thread.sendError && !thread.sendError.retryable) thread.thread.clearSendError() }} multiline editable={allowed}
            placeholder={offline ? 'Offline' : 'Ask Atlas'} placeholderTextColor={c.muted} accessibilityLabel="Question for Atlas" selectionColor={c.brand} cursorColor={c.brand}
            onKeyPress={event => { const e = event.nativeEvent as { key?: string; shiftKey?: boolean }; if (web && e.key === 'Enter' && !e.shiftKey) { (event as unknown as { preventDefault?: () => void }).preventDefault?.(); void send() } }}
            style={{ minHeight: 32, maxHeight: 140, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: c.text, paddingVertical: 4, ...(web ? ({ outlineStyle: 'none' } as object) : {}) }} />
          <Text accessibilityLabel={`${count.count} of ${ATLAS_MAX_CHARS} characters`} style={{ alignSelf: 'flex-end', fontSize: 11, lineHeight: 14, color: count.over ? c.danger : count.near ? c.warning : c.muted }}>{count.label}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Send to Atlas" accessibilityState={{ disabled: sendDisabled, busy: thread.sending }} disabled={sendDisabled} onPress={() => void send()}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, opacity: sendDisabled ? 0.5 : pressed ? 0.85 : 1, ...pointer })}>
          {thread.sending ? <ActivityIndicator color="#ffffff" /> : <Icon name="sendHorizontal" size={22} color="#ffffff" />}
        </Pressable>
      </View>
    </View>
  </KeyboardAvoidingView>
}

function Line({ icon, text, c, danger = false }: { icon: 'wifiOff' | 'alert'; text: string; c: Colors; danger?: boolean }) {
  return <View accessibilityRole={web ? 'alert' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Icon name={icon} size={14} color={danger ? c.danger : c.muted} />
    <Text accessibilityLiveRegion="polite" style={{ flex: 1, fontSize: 12, lineHeight: 17, color: danger ? c.danger : c.muted }}>{text}</Text>
  </View>
}

/** One ask (right) and Atlas's reply or progress line (left). Rendered inside an inverted list, newest at the bottom. */
export function AskRow({ ask, parent, c, canAct, onReply, onRetry }: { ask: Ask; parent: Ask | null; c: Colors; canAct: boolean; onReply: () => void; onRetry: () => void }) {
  const view = answerView(ask)
  const bubble: ViewStyle = { maxWidth: '82%', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, borderRadius: radius.card, boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)' }
  const tone = view.tone === 'failed' || view.tone === 'refused' ? c.danger : view.tone === 'held' ? c.warning : c.brand
  return <View style={{ gap: 4, paddingVertical: 4 }}>
    <View style={[bubble, { alignSelf: 'flex-end', backgroundColor: c.outgoing, borderTopRightRadius: 4 }]}>
      {parent && <View style={{ marginBottom: 4, paddingHorizontal: 8, paddingVertical: 4, borderLeftWidth: 3, borderLeftColor: c.brand, borderRadius: 6, backgroundColor: c.dark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)' }}>
        <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: c.muted }}>{quote(parent.text)}</Text>
      </View>}
      {ask.reply_to && !parent && <Text style={{ fontSize: 12, lineHeight: 16, color: c.muted, fontStyle: 'italic' }}>Follow-up to an earlier question</Text>}
      <Text selectable style={{ fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: c.text }}>{ask.text}</Text>
      <Text accessibilityLabel={`Asked ${formatDateTime(ask.created_at)}`} style={{ alignSelf: 'flex-end', fontSize: 11, lineHeight: 14, color: c.muted }}>{time(ask.created_at)}</Text>
    </View>
    <View style={[bubble, { alignSelf: 'flex-start', backgroundColor: c.incoming, borderTopLeftRadius: 4 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16, color: c.brand }}>Atlas</Text>
        {view.note && <Text style={{ fontSize: 11, lineHeight: 16, color: tone }}>{view.note}</Text>}
      </View>
      {view.tone === 'pending'
        ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}><ActivityIndicator size="small" color={c.brand} /><Text style={{ flexShrink: 1, fontSize: 14, lineHeight: 20, color: c.muted, fontStyle: 'italic' }}>{view.text}</Text></View>
        : <Text selectable style={{ fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: view.tone === 'answer' ? c.text : view.tone === 'failed' ? c.danger : c.muted }}>{view.text}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
        {view.retry && <Pressable accessibilityRole="button" accessibilityLabel="Ask again" disabled={!canAct} onPress={onRetry} style={{ minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: canAct ? 1 : 0.5, ...pointer }}><Icon name="rotateCw" size={14} color={c.brand} /><Text style={{ fontSize: 13, color: c.brand }}>Retry</Text></Pressable>}
        {view.tone !== 'pending' && <Pressable accessibilityRole="button" accessibilityLabel="Follow up on this answer" disabled={!canAct} onPress={onReply} style={{ minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: canAct ? 1 : 0.5, ...pointer }}><Icon name="reply" size={14} color={c.brand} /><Text style={{ fontSize: 13, color: c.brand }}>Follow up</Text></Pressable>}
        <Text style={{ fontSize: 11, lineHeight: 14, color: c.muted }}>{time(ask.answered_at)}</Text>
      </View>
    </View>
  </View>
}
