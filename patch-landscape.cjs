const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/ui.tsx',s=>s.replace('TextInputProps & { label: string }','TextInputProps & { label: string; compact?: boolean }').replace('<Label>{props.label}</Label><TextInput','{!props.compact && <Label>{props.label}</Label>}<TextInput'));
edit('src/components/MessageTools.tsx',s=>s.replace('Switch, Text, View','Switch, Text'));
edit('src/components/ConversationWorkspace.tsx',s=>{
s=s.replace('const { width } = useWindowDimensions()', 'const { width, height } = useWindowDimensions(); const compact = height < 600');
s=s.replace("const [tool, setTool]", "const [menu, setMenu] = useState(false)\n  const [tool, setTool]");
s=s.replace('padding: width < 500 ? 12 : 20, gap: 12','padding: compact ? 8 : width < 500 ? 12 : 20, gap: compact ? 6 : 12');
s=s.replace('{!split && <Button title="Back', '{!split && !compact && <Button title="Back');
s=s.replace('<Button title={selected.pinned_at', '{!compact && <Button title={selected.pinned_at').replace('!selected.pinned_at }))} />','!selected.pinned_at }))} />}');
s=s.replace('<Button title={selected.archived_at','{!compact && <Button title={selected.archived_at').replace('!selected.archived_at }))} />','!selected.archived_at }))} />}');
s=s.replace('          </View>\n          <ScrollView horizontal', '            {compact && <Button title="Conversation options" onPress={() => setMenu(true)} />}\n          </View>\n          {!compact && <ScrollView horizontal');
s=s.replace("setTool('contact')} /></>}</ScrollView>", "setTool('contact')} /></>}</ScrollView>}");
s=s.replace('{historyState.window.hasMoreBefore &&','{!compact && historyState.window.hasMoreBefore &&').replace('{historyState.window.hasMoreAfter &&','{!compact && historyState.window.hasMoreAfter &&');
s=s.replace('<Button title="Jump to latest" disabled={historyState.loading} onPress={() => void history.latest()} />', '{!compact && <Button title="Jump to latest" disabled={historyState.loading} onPress={() => void history.latest()} />}');
s=s.replace('{selected.can.send ? <><Field label="Message"','{selected.can.send ? <View style={{ flexDirection: compact ? \'row\' : \'column\', alignItems: compact ? \'center\' : undefined, gap: 8 }}><View style={{ flex: compact ? 1 : undefined }}><Field compact={compact} label="Message"');
s=s.replace('style={{ maxHeight: 120 }} />','style={{ maxHeight: compact ? 64 : 120 }} /></View>');
s=s.replace('{selected.can.send_file && !editing && <Button title="Attach file"','{!compact && selected.can.send_file && !editing && <Button title="Attach file"');
s=s.replace("<View style={{ flex: 1 }}><Button title={sending", "<View style={{ flex: compact ? undefined : 1 }}><Button title={sending");
s=s.replace("          </> : <Label>Sending is unavailable", "          </View> : <Label>Sending is unavailable");
s=s.replace('    {selectedId && tool',`    {compact && selected && <Sheet visible={menu} onClose={() => setMenu(false)}><Label large>Conversation options</Label>
      <Button title="Back to conversations" disabled={blocked} onPress={() => { setMenu(false); setSelected(null); selectionGeneration.current++ }} />
      <Button title="Search messages" onPress={() => { setMenu(false); setTool('search') }} />
      {selected.can.send && <><Button title="Create poll" onPress={() => { setMenu(false); setTool('poll') }} /><Button title="Share contact" onPress={() => { setMenu(false); setTool('contact') }} /></>}
      {selected.can.send_file && <Button title="Attach file" disabled={blocked} onPress={() => { setMenu(false); void attach() }} />}
      {historyState.window.hasMoreBefore && <Button title="Load earlier messages" disabled={historyState.loading} onPress={() => { setMenu(false); void history.page('before') }} />}
      {historyState.window.hasMoreAfter && <Button title="Load newer messages" disabled={historyState.loading} onPress={() => { setMenu(false); void history.page('after') }} />}
      <Button title="Jump to latest" disabled={historyState.loading} onPress={() => { setMenu(false); void history.latest() }} />
      <Button title={selected.pinned_at ? 'Unpin' : 'Pin'} disabled={blocked} onPress={() => { setMenu(false); void perform(() => chat.updateSettings(selected.id, { pinned: !selected.pinned_at })) }} />
      <Button title={selected.archived_at ? 'Unarchive' : 'Archive'} disabled={blocked} onPress={() => { setMenu(false); void perform(() => chat.updateSettings(selected.id, { archived: !selected.archived_at })) }} />
      <Button title="Close options" onPress={() => setMenu(false)} />
    </Sheet>}
    {selectedId && tool`); // only first occurrence is replaced by String.replace
return s;
});
edit('src/modules/passwords/api.ts',s=>s.replace('createEntry = async (data: EntryInput) =>','createEntry = async (data: EntryInput, idempotencyKey = randomUUID()) =>').replace("api.post<Entry>('/entries/', data, { ...jp, headers: { 'Idempotency-Key': randomUUID() } })", "api.post<Entry>('/entries/', data, { ...jp, headers: { 'Idempotency-Key': idempotencyKey } })"));
edit('src/components/VaultPanel.tsx',s=>s.replace("import { ActivityIndicator", "import { randomUUID } from 'expo-crypto'\nimport { ActivityIndicator").replace("  useEffect(() => subscribeLifecycle(active => { if (!active) { setPassword", "  const requestId = useRef(randomUUID())\n  useEffect(() => { requestId.current = randomUUID() }, [title, username, url, kind, tags, password, notes, custom])\n  useEffect(() => subscribeLifecycle(active => { if (!active) { setPassword").replace('await vault.createEntry(data)', 'await vault.createEntry(data, requestId.current)'));
