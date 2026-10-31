const fs=require('fs');const p='src/components/ConversationWorkspace.tsx';let s=fs.readFileSync(p,'utf8');
const old=s.match(/onContentSizeChange=\{\(\) => \{ if \(completedJump.current[^\n]+/)[0];
s=s.replace(old,'onContentSizeChange={scrollRequested}');
const at="  useEffect(() => () => { if (jumpTimer.current) clearTimeout(jumpTimer.current) }, [])";
s=s.replace(at,at+`
  const scrollRequested = useCallback(() => {
    if (completedJump.current === historyState.latestJump || !listRef.current) return
    const index = historyState.targetSeq === null ? -1 : messages.findIndex(m => m.seq === historyState.targetSeq)
    jumpAttempts.current = 0
    if (index >= 0) listRef.current.scrollToIndex({ index, animated: false, viewPosition: 0, viewOffset: 8 })
    else listRef.current.scrollToEnd({ animated: false })
    completedJump.current = historyState.latestJump
  }, [historyState.latestJump, historyState.targetSeq, messages])
  useEffect(() => { const timer = setTimeout(scrollRequested, 0); return () => clearTimeout(timer) }, [scrollRequested])`);
s=s.replace('viewPosition: 0.5','viewPosition: 0, viewOffset: 8');fs.writeFileSync(p,s);
