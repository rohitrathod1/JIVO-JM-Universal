const fs=require('fs');
const edit=(p,fn)=>fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));
edit('src/components/ConversationWorkspace.tsx',s=>{
s=s.replace('useRef, useState','useRef, useState, useSyncExternalStore').replace('KeyboardAvoidingView, Modal,','KeyboardAvoidingView,');
s=s.replace("import { mergeBySeq } from '../modules/messenger/lib/window'", "import { HistoryController } from '../modules/messenger/history'\nimport { useCursor } from '../shared/useCursor'\nimport { Sheet } from './Sheet'");
s=s.replace("const [items, setItems] = useState<chat.ConversationItem[]>([]); const [selected, setSelected]", "const [selection, setSelected]");
s=s.replace("  const [messages, setMessages] = useState<chat.Message[]>([]); const [moreBefore, setMoreBefore] = useState(false)\n",'');
s=s.replace("; const [cursor, setCursor] = useState<string | null>(null)",'');
s=s.replace("; const [loading, setLoading] = useState(false)",'');
s=s.replace("  const selectedId = selected?.id;",`  const [history] = useState(() => new HistoryController({ detail: chat.getConversation, read: chat.getWindow, message: errorMessage }))
  const historyState = useSyncExternalStore(history.subscribe, history.snapshot, history.snapshot)
  const selected = historyState.detail?.id === selection?.id ? historyState.detail : selection
  const messages = historyState.window.messages
  const loadConversations = useCallback((cursor?: string | null) => preview ? Promise.resolve({ results: [], next_cursor: null }) : chat.listConversations(filter, query, cursor), [preview, filter, query])
  const conversations = useCursor(loadConversations)
  const { items, cursor, loading } = conversations
  const selectedId = selection?.id;`);
let start=s.indexOf('  useEffect(() => {\n    if (preview) return\n    let active = true');
let end=s.indexOf('  useEffect(() => {\n    if (!selectedId || readPosition',start);
s=s.slice(0,start)+`  useEffect(() => { if (revision) void conversations.refresh() }, [revision, conversations.refresh])
  useEffect(() => {
    if (preview) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = realtime.on('*', frame => {
      history.event(frame)
      if (!/^(MESSAGE_|CONVERSATION_|MEMBER_|RESYNC)/.test(frame.type)) return
      clearTimeout(timer); timer = setTimeout(refresh, 150)
    })
    return () => { off(); clearTimeout(timer) }
  }, [preview, refresh, history])
  useEffect(() => {
    if (preview) return
    void history.select(selectedId ?? null)
    realtime.setFocusedConversation(selectedId ?? null)
    return () => { history.invalidate(); realtime.setFocusedConversation(null) }
  }, [selectedId, preview, history])
  const [pendingJump, setPendingJump] = useState(0)
  useEffect(() => { setPendingJump(historyState.latestJump) }, [historyState.latestJump])
`+s.slice(end);
s=s.replace("setSelected(item); setMessages([]); setMoreBefore(false);", "setSelected(item);");
s=s.replace("if (editing) await chat.editMessage(editing.id, body.trim())\n      else await chat.sendMessage", "if (editing) history.accept(await chat.editMessage(editing.id, body.trim()))\n      else history.accept(await chat.sendMessage");
s=s.replace("reply_to: reply?.id })", "reply_to: reply?.id }))");
s=s.replace("draftId.current = randomUUID(); refresh()", "draftId.current = randomUUID(); await history.latest(); refresh()");
s=s.replace("setConfirmDelete(null); refresh()", "setConfirmDelete(null); void history.reconcile(); void history.refreshDetail(); refresh()");
start=s.indexOf('  async function older()'); end=s.indexOf('  const split',start); s=s.slice(0,start)+s.slice(end);
s=s.replace("{!!error &&", "{!!(error || historyState.error || conversations.error) &&").replace('{error}</Text><Button title="Retry"','{error || historyState.error || conversations.error}</Text><Button title="Retry"');
s=s.replace("setError(''); refresh()", "setError(''); void history.reconcile(); refresh()");
start=s.indexOf('          {cursor && <Button title="Load more conversations"');end=s.indexOf('\n',start);
s=s.slice(0,start)+'          {cursor && <Button title="Load more conversations" disabled={loading} onPress={() => void conversations.more()} />}'+s.slice(end);
s=s.replace('{moreBefore && <Button title="Load earlier messages" disabled={loading} onPress={() => void older()} />}', '{historyState.window.hasMoreBefore && <Button title="Load earlier messages" disabled={historyState.loading} onPress={() => void history.page(\'before\')} />}');
s=s.replace('viewabilityConfig={viewability}',`viewabilityConfig={viewability} maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onContentSizeChange={() => { if (pendingJump) { listRef.current?.scrollToEnd({ animated: false }); setPendingJump(0) } }}`);
s=s.replace('          {reply &&',`          {historyState.window.hasMoreAfter && <Button title="Load newer messages" disabled={historyState.loading} onPress={() => void history.page('after')} />}
          <Button title="Jump to latest" disabled={historyState.loading} onPress={() => void history.latest()} />
          {reply &&`);
s=s.replace('<Modal transparent visible={Boolean(actions)} onRequestClose={() => setActions(null)}><View style={{ flex: 1, justifyContent: \'center\', padding: 24, backgroundColor: \'#0008\' }}><View style={{ width: \'100%\', maxWidth: 440, alignSelf: \'center\' }}><Card>', '<Sheet visible={Boolean(actions)} onClose={() => { if (!sending) setActions(null) }}>');
s=s.replace('</Card></View></View></Modal>', '</Sheet>');
s=s.replace("['??', '??', '??']", "['\\u{1F44D}', '\\u{2764}\\u{FE0F}', '\\u{1F602}']");
return s;
});
edit('src/components/ConversationPicker.tsx',s=>{
s=s.replace('useEffect, useState','useCallback, useState').replace('ActivityIndicator, Modal, ScrollView,','ActivityIndicator,');
s=s.replace("import { errorMessage }", "import { Sheet } from './Sheet'\nimport { useCursor } from '../shared/useCursor'\nimport { errorMessage }");
s=s.replace("; const [people, setPeople] = useState<PersonCard[]>([])",'');s=s.replace("; const [cursor, setCursor] = useState<string | null>(null)",'');
const start=s.indexOf('  useEffect('),end=s.indexOf('  async function choose',start);
s=s.slice(0,start)+`  const load = useCallback((cursor?: string | null) => searchPeople(query, cursor), [query])
  const page = useCursor(load)
  const { items: people, cursor } = page
`+s.slice(end);
s=s.replace("return <Modal transparent onRequestClose={onClose}><View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#0008' }}>\n    <View style={{ alignSelf: 'center', width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: c.bg, borderRadius: 16, padding: 18, gap: 12 }}>", 'return <Sheet visible onClose={() => { if (!busy) onClose() }}>');
s=s.replace('{!!error &&','{!!(error || page.error) &&').replace('{error}</Text>','{error || page.error}</Text>');
s=s.replace('<ScrollView contentContainerStyle={{ gap: 10 }}>','<View style={{ gap: 10 }}>').replace('</ScrollView>','</View>');
const more=s.indexOf('        {cursor &&');const moreEnd=s.indexOf('\n',more);s=s.slice(0,more)+'        {cursor && <Button title="More people" disabled={page.loading} onPress={() => void page.more()} />}'+s.slice(moreEnd);
s=s.replace('    </View>\n  </View></Modal>','  </Sheet>'); return s;
});
edit('src/components/ProfilePanel.tsx',s=>s.replace('ActivityIndicator, Modal,','ActivityIndicator,').replace("import { useSession }", "import { Sheet } from './Sheet'\nimport { useSession }")
.replace(/<Modal transparent visible=\{Boolean\(confirmation\)\} onRequestClose=\{\(\) => \{ if \(!busy\) setConfirmation\(null\) \}\}><View[^>]*><Card>/,'<Sheet visible={Boolean(confirmation)} onClose={() => { if (!busy) setConfirmation(null) }}>')
.replace(/<Modal transparent visible=\{recoveryCodes.length > 0\} onRequestClose=\{\(\) => setRecoveryCodes\(\[\]\)\}><View[^>]*><Card>/,'<Sheet visible={recoveryCodes.length > 0} onClose={() => setRecoveryCodes([])}>')
.replaceAll('</Card></View></Modal>','</Sheet>'));
edit('src/components/StepUp.tsx',s=>s.replace("import { Modal, ScrollView, Text, View }", "import { Text }").replace("import { useSession }", "import { Sheet } from './Sheet'\nimport { useSession }")
.replace('Button, Card, Field','Button, Field')
.replace(/return <Modal transparent visible=\{Boolean\(active\)\} onRequestClose=\{\(\) => \{ if \(!busy\) settle\(false\) \}\}>[\s\S]*?<Card>/,'return <Sheet visible={Boolean(active)} onClose={() => { if (!busy) settle(false) }}>')
.replace('</Card></ScrollView></View>\n  </Modal>','</Sheet>'));
