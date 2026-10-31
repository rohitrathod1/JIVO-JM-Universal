const fs=require('node:fs');let s=fs.readFileSync('src/components/VaultFiles.tsx','utf8');s=s.replace('useEffect(() => { const current=guard.current;', 'useEffect(() => { active.current=true; const current=guard.current;');s=s.replace("if(!action)return;await fresh(action.kind,action.file.id);", "if(!action)return;const generation=guard.current.begin();await fresh(action.kind,action.file.id);if(action.kind==='download' && !guard.current.accepts(generation))return;");s=s.replace('else{const generation=guard.current.begin();const blob=', 'else{const blob=');fs.writeFileSync('src/components/VaultFiles.tsx',s);
s=fs.readFileSync('src/components/AdminManagement.tsx','utf8');s=s.replace("filter(c => c.is_active && !c.is_deleted)","filter(c => c.is_active && !c.is_deleted && !user.companies.some(m => m.company === c.code && m.is_active))");fs.writeFileSync('src/components/AdminManagement.tsx',s);
s=fs.readFileSync('mocked-ui.cjs','utf8');const insert=(marker,text)=>{if(!s.includes(marker))throw Error(marker);s=s.replace(marker,text+'\n'+marker)};
insert('      let deviceRows=',`      let chatPolicy={mode:'all',can_create_groups:true,allowed_count:0};let allowedPeople=[]
`);
insert("        if(path==='/api/jm/admin/users/new-user/sessions/')",`        if(path==='/api/jm/admin/companies/')return send([{id:'company',code:'EX',name:'Example Company',is_active:true,is_deleted:false}])
        if(path==='/api/jm/admin/memberships/'){assert.equal(body.company,'EX');managedUsers[1].companies.push({id:'membership',company:'EX',company_name:'Example Company',company_color:'#15803D',title:body.title,department:body.department,is_active:true,is_default:false});return send(managedUsers[1].companies.at(-1))}
        if(path==='/api/jm/admin/memberships/membership/'){if(method==='DELETE')managedUsers[1].companies=[];else Object.assign(managedUsers[1].companies[0],body);return send({})}
        if(path==='/api/jm/admin/users/new-user/chat-access/'){if(method==='PUT')Object.assign(chatPolicy,body);return send(chatPolicy)}
        if(path==='/api/jm/admin/users/new-user/chat-access/allowed/'){if(method==='POST'){if(body.add)allowedPeople=body.add.map(id=>managedUsers.find(p=>p.id===id));if(body.remove)allowedPeople=allowedPeople.filter(p=>!body.remove.includes(p.id));chatPolicy.allowed_count=allowedPeople.length;return send(chatPolicy)}return send({results:allowedPeople,next_cursor:null})}
`);
insert("      await page.getByRole('button',{name:'Close person details',exact:true}).click()",`      await page.getByRole('button',{name:'companies',exact:true}).click()
      await page.getByRole('button',{name:'Example Company',exact:true}).click()
      await page.getByLabel('Membership title',{exact:true}).fill('Mock role')
      await page.getByLabel('Membership department',{exact:true}).fill('Mock department')
      await page.getByRole('button',{name:'Add company membership',exact:true}).click()
      await page.getByRole('button',{name:'Make Example Company default',exact:true}).click()
      await expect.poll(()=>managedUsers[1].companies[0]?.is_default).toBe(true)
      await page.getByRole('button',{name:'Remove membership Example Company',exact:true}).click()
      await page.getByRole('button',{name:'Confirm membership removal',exact:true}).click()
      await expect.poll(()=>managedUsers[1].companies.length).toBe(0)
      await page.getByRole('button',{name:'chat',exact:true}).click()
      await page.getByRole('button',{name:'Restrict to selected people',exact:true}).click()
      await page.getByRole('button',{name:'Example Tester',exact:true}).click()
      await page.getByRole('button',{name:'Add selected chat people',exact:true}).click()
      await page.getByRole('button',{name:'Remove chat access to Example Tester',exact:true}).click()
      await expect.poll(()=>chatPolicy.allowed_count).toBe(0)
      await page.getByRole('switch',{name:'Can create chat groups',exact:true}).click()
      await expect.poll(()=>chatPolicy.can_create_groups).toBe(false)
      await page.getByRole('button',{name:'Allow all people',exact:true}).click()
      await expect.poll(()=>chatPolicy.mode).toBe('all')
`);
s=s.replace('admin lifecycle/groups/security approvals,','admin lifecycle/groups/security/device/membership/chat/approval decisions, vault file upload/download/rename/delete/preview races,');fs.writeFileSync('mocked-ui.cjs',s);
