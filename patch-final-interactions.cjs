const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/components/Sheet.tsx',s=>s.replace('animationType="fade"','animationType="none"'));
edit('src/components/ConversationWorkspace.tsx',s=>{
s=s.replace('const completedJump = useRef(0)', `const completedJump = useRef(0)
  const jumpAttempts = useRef(0); const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (jumpTimer.current) clearTimeout(jumpTimer.current) }, [])`);
s=s.replace('if (index >= 0) listRef.current?.scrollToIndex', 'jumpAttempts.current = 0; if (index >= 0) listRef.current?.scrollToIndex');
s=s.replace('onScrollToIndexFailed={info => listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })}', `onScrollToIndexFailed={info => { if (jumpAttempts.current++ >= 3) return; listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false }); if (jumpTimer.current) clearTimeout(jumpTimer.current); jumpTimer.current = setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 }), 100) }}`);
s=s.replace('onChanged={() => { void history.refreshDetail();', 'onClear={() => void history.latest()} onChanged={() => { void history.refreshDetail();');
s=s.replace('chat.deleteMessage(actions.id, confirmDelete)', `chat.deleteMessage(actions.id, confirmDelete).then(() => { history.event({ type: confirmDelete === 'me' ? 'MESSAGE_HIDDEN' : 'MESSAGE_DELETED', data: { conversation: actions.conversation, id: actions.id, seq: actions.seq, by_moderator: false, updated_at: new Date().toISOString() } }) })`);
return s;});
edit('src/components/ConversationDetails.tsx',s=>s.replace('onChanged, onLeave }:','onChanged, onLeave, onClear }:').replace('onLeave: () => void })','onLeave: () => void; onClear: () => void })').replace('action: () => chat.clearChat(conversation)', 'action: async () => { await chat.clearChat(conversation); onClear() }'));
edit('mocked-ui.cjs',s=>s.replace("const { chromium }", "const { chromium, expect }").replace("await page.getByRole('button', { name: 'Close search', exact: true }).waitFor({ state: 'hidden' })", "await page.getByRole('button', { name: 'Close search', exact: true }).waitFor({ state: 'hidden' })\n      await expect(page.getByText('Edited mocked message', { exact: true })).toBeInViewport()"));
