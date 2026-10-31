const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')))}
edit('src/components/ConversationWorkspace.tsx',s=>{const start=s.indexOf('  useEffect(() => { if (media && !mediaAttachment)');const end=s.indexOf('  const loadConversations',start);if(start<0||end<0)throw Error('markers');return s.slice(0,start)+`  useEffect(() => history.subscribe(() => {
    const state = history.snapshot()
    const retain = (source: typeof media) => source && source.conversation === state.id && !state.accessLost && state.window.messages.some(m => m.id === source.message && !m.deleted && m.attachments?.some(a => a.id === source.attachment && a.status === 'ready')) ? source : null
    setMedia(retain); setImage(retain)
    if (state.accessLost) { upload.current?.abort(); setAttachments([]); setTool(null); setActions(null); setForwarding(null); setReply(null); setEditing(null); setBody('') }
  }), [history])
`+s.slice(end)});
edit('src/components/ProfilePanel.tsx',s=>s.replace('useEffect(() => { const off = subscribeSensitiveView(active => { recoveryGuard.current.setActive(active); if (!active) setRecoveryCodes([]) }); return () => { off(); recoveryGuard.current.setActive(false) } }, [])','useEffect(() => { const guard = recoveryGuard.current; const off = subscribeSensitiveView(active => { guard.setActive(active); if (!active) setRecoveryCodes([]) }); return () => { off(); guard.setActive(false) } }, [])'));
