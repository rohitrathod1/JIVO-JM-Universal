const fs=require('fs');function edit(p,a,b){let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p);fs.writeFileSync(p,s.replace(a,b))}
edit('src/components/Workspace.tsx','<Link href={preview ?','<Link replace href={preview ?')
edit('src/components/ConversationWorkspace.tsx',"onOutboxSent(message=>{history.accept(message);void history.reconcile();void refreshConversations()})","onOutboxSent(message=>{history.event({type:'MESSAGE_CREATED',data:message});void refreshConversations()})")
