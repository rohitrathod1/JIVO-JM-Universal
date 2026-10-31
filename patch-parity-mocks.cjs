const fs=require('fs');const p='mocked-ui.cjs';let s=fs.readFileSync(p,'utf8');function rep(a,b){if(!s.includes(a))throw Error(a);s=s.replace(a,b)}
rep("'JP_ACCESS', 'ADMIN_USERS'", "'JP_ACCESS', 'JP_MANAGE_VAULT', 'JP_REQUEST_EMERGENCY', 'ADMIN_USERS'");
rep("link: '/messenger'", "link: '/messenger/chat?seq=1'");
rep('      const members =',`      const managedUsers = [adminPerson]; let policy = { two_step_enforced: false, updated_at: null, updated_by: null }; const permissionGroups = []; const teamVaults = []; const ownerRequests = []; const teamMembers = [{ user: person, role: 'owner', super_owner: true, via_break_glass: false, added_by: person, added_at: '2026-01-01', expires_at: null }]; let emergency = []
      const pendingApproval = { id: 'approval', kind: 'reactivate', label: 'Reactivate person', target: null, requested_by: me, reason: '', status: 'pending', created_at: '2026-10-20', expires_at: '2026-10-21', decided_by: null, decided_at: null, can: { decide: false, cancel: true } }
      const members =`);
rep("        if (path === '/api/jm/admin/users/') return send({ count: 1, next: null, previous: null, results: [adminPerson] })",`        if (path === '/api/jm/admin/users/') { if (method === 'POST') { const created = { ...adminPerson, id:'new-user', name:body.full_name, full_name:body.full_name, email:body.email, has_password:false, is_deleted:false, groups:[] }; managedUsers.push(created); return send({ ...created, invite_link:'https://example.invalid/invite/MOCK_ONLY', password_set:false }) } return send({count:managedUsers.length,next:null,previous:null,results:managedUsers}) }
        if (path === '/api/jm/admin/users/group-options/') return send([{name:'Team access',grantable:true},{name:'Protected access',grantable:false}])
        if (path === '/api/jm/admin/users/new-user/') return send(managedUsers[1])
        if (path === '/api/jm/admin/users/new-user/deactivate/') { managedUsers[1].is_active=false; managedUsers[1].status='inactive'; return send(managedUsers[1]) }
        if (path === '/api/jm/admin/users/new-user/activate/') return send({ approval:pendingApproval },202)
        if (path === '/api/jm/admin/users/new-user/groups/') { managedUsers[1].groups=body.groups; return send(managedUsers[1]) }
        if (path === '/api/jm/admin/capabilities/') return send([{key:'JM_ACCESS',label:'Messenger access',held:true},{key:'JP_MANAGE_VAULT',label:'Manage vaults',held:false}])
        if (path === '/api/jm/admin/groups/') { if(method==='POST') { const group={id:'new-group',...body,built_in:false,can_edit:true,can_manage_members:true,member_count:0,created_at:'2026-10-20'}; permissionGroups.push(group); return send(group) } return send(permissionGroups) }
        if (path === '/api/jm/admin/security-policy/') { if(method==='PUT') { if(!body.two_step_enforced) return send({approval:{...pendingApproval,kind:'two_step_off'}},202); policy.two_step_enforced=true } return send(policy) }
        if (path === '/api/jm/companies/') return send([{id:'company',code:'EX',name:'Example Company'}])
        if (path === '/api/jp/admin/vaults/') return send([...teamVaults,{id:'emergency-vault',name:'Emergency example',owner_type:'shared',company:null,entry_count:0,owners:[],owner_user:null,archived_at:null,frozen:false,my_role:null}])
        if (path === '/api/jp/owner-requests/pending/' || path === '/api/jp/vaults/team/owner-requests/') return send(ownerRequests)
        if (path === '/api/jp/vaults/team/members/') { if(method==='POST') { const request={id:'owner-request',vault:{id:'team',name:'Mock team vault'},user:{...person,id:body.user_id},action:'appoint',requested_by:me,reason:'',status:'pending',requested_at:'2026-10-20',decided_by:null,decided_at:null,can:{decide:false,cancel:true}}; ownerRequests.push(request); return send({status:'pending',request},202) } return send(teamMembers) }
        if (path === '/api/jp/audit/') return send({results:[{id:7,at:'2026-10-20',action:'vault_created',actor:person,outcome:'success',ip:null,details:{}}],next_cursor:null})
        if (path === '/api/jp/vaults/vault/') { if(method==='PATCH') vault.name=body.name; return send(vault) }
        if (path === '/api/jp/vaults/vault/archive/') { vault.archived_at=body.archived?'2026-10-20':null; return send(vault) }
        if (path === '/api/jp/break-glass/') { if(method==='POST') { const request={id:'emergency-request',vault:{id:body.vault_id,name:'Emergency example',owner_type:'shared'},requested_by:me,reason:body.reason,requested_at:'2026-10-20',approved_by:null,approved_at:null,denied_at:null,expires_at:null,status:'pending',can:{decide:false,revoke:false}}; emergency.push(request); return send(request) } return send(emergency) }`);
rep("if (path === '/api/jp/vaults/') return send([vault])", "if (path === '/api/jp/vaults/') { if(method==='POST') { const created={id:'team',...body,company:null,entry_count:0,owners:[person],owner_user:person,archived_at:null,frozen:false,my_role:null}; teamVaults.push(created); return send(created) } return send([vault]) }");
rep("      await page.getByRole('link', { name: 'Activity', exact: true }).click()",`      await page.getByRole('button', { name: 'Rename vault', exact: true }).click()
      await page.getByLabel('Vault name', { exact:true }).fill('Renamed example vault')
      await page.getByRole('button', { name:'Save vault name',exact:true }).click()
      await page.getByRole('button', { name:'Open vault Renamed example vault',exact:true }).waitFor()
      await page.getByRole('button', { name:'Archive vault',exact:true }).click()
      await page.getByRole('button', { name:'Confirm vault archive change',exact:true }).click()
      await page.getByRole('button', { name:'Unarchive vault',exact:true }).waitFor()
      await page.getByRole('button', { name:'Vault activity',exact:true }).click()
      await page.getByText('vault created · success', { exact:true }).waitFor()
      await page.getByRole('button', { name:'Team vaults',exact:true }).click()
      await page.getByRole('button', { name:'New team vault',exact:true }).click()
      await page.getByLabel('Team vault name', {exact:true}).fill('Mock team vault')
      await page.getByLabel('Find vault member', {exact:true}).fill('Example')
      await page.getByRole('button', {name:'Choose Example Colleague',exact:true}).click()
      await page.getByRole('button', {name:'Create team vault',exact:true}).click()
      await page.getByRole('button', {name:'Manage owners of Mock team vault',exact:true}).click()
      await page.getByRole('button', {name:'Appoint vault owner',exact:true}).click()
      await page.getByLabel('Find vault member', {exact:true}).fill('Example')
      await page.getByRole('button', {name:'Choose Example Colleague',exact:true}).click()
      await page.getByRole('button', {name:'Confirm vault member',exact:true}).click()
      await page.getByText('Sent to an existing owner for approval.',{exact:true}).waitFor()
      await page.getByRole('button', {name:'Close vault owners',exact:true}).click()
      await page.getByRole('button', {name:'Emergency access',exact:true}).click()
      await page.getByRole('button', {name:'Request emergency access',exact:true}).click()
      await page.getByRole('button', {name:'Emergency example',exact:true}).click()
      await page.getByLabel('Emergency access reason',{exact:true}).fill('Mock owners are unavailable')
      await page.getByRole('button', {name:'Submit emergency request',exact:true}).click()
      await page.getByText('Requested. Another approver must decide.',{exact:true}).waitFor()
      assert.equal(emergency.length,1)
      await page.getByRole('link', { name: 'Activity', exact: true }).click()`);
rep("      await page.getByRole('button', { name: 'Close notification', exact: true }).click()",`      denied=false
      await page.getByRole('button', {name:'Go to linked item',exact:true}).click()
      await page.getByText('Restricted example',{exact:true}).waitFor()
      assert.match(page.url(), /conversation=chat/)
      await page.getByRole('link', {name:'Activity',exact:true}).click()`);
rep("      assert.equal(adminPerson.full_name, 'Edited Example Tester')",`      assert.equal(adminPerson.full_name, 'Edited Example Tester')
      await page.getByRole('button',{name:'Create person',exact:true}).click()
      await page.getByLabel("New person's full name",{exact:true}).fill('New Mock Person')
      await page.getByLabel("New person's email",{exact:true}).fill('new@example.invalid')
      await page.getByRole('button',{name:'Create invited person',exact:true}).click()
      await page.getByRole('button',{name:'Close access link',exact:true}).click()
      await page.getByRole('button',{name:'Close create person',exact:true}).click()
      await page.getByRole('button',{name:'Manage person New Mock Person',exact:true}).click()
      await page.getByRole('button',{name:'Deactivate person',exact:true}).click()
      await page.getByRole('button',{name:'Confirm person action',exact:true}).click()
      await page.getByRole('button',{name:'Reactivate person',exact:true}).click()
      await page.getByRole('button',{name:'Confirm person action',exact:true}).click()
      await page.getByText('Sent for approval: a second administrator must approve it.',{exact:true}).waitFor()
      assert.equal(managedUsers[1].is_active,false)
      await page.getByRole('button',{name:'access',exact:true}).click()
      await page.getByRole('switch',{name:'Group Team access',exact:true}).click()
      await page.getByRole('button',{name:'Review group access',exact:true}).click()
      await page.getByRole('button',{name:'Confirm group access',exact:true}).click()
      await expect.poll(()=>managedUsers[1].groups).toEqual(['Team access'])
      await page.getByRole('button',{name:'Close person details',exact:true}).click()
      await page.getByRole('button',{name:'groups',exact:true}).click()
      await page.getByRole('button',{name:'New permission group',exact:true}).click()
      await page.getByLabel('Permission group name',{exact:true}).fill('Mock permission group')
      await page.getByRole('switch',{name:'Capability Messenger access',exact:true}).click()
      await expect(page.getByRole('switch',{name:'Capability Manage vaults',exact:true})).toBeDisabled()
      await page.getByRole('button',{name:'Save permission group',exact:true}).click()
      await page.getByRole('button',{name:'Close permission group',exact:true}).waitFor({state:'hidden'})
      assert.deepEqual(permissionGroups[0].capabilities,['JM_ACCESS'])
      await page.getByRole('button',{name:'security',exact:true}).click()
      await page.getByRole('button',{name:'Review requiring two-step',exact:true}).click()
      await page.getByRole('button',{name:'Confirm security policy change',exact:true}).click()
      await page.getByRole('button',{name:'Review disabling required two-step',exact:true}).click()
      await page.getByRole('button',{name:'Confirm security policy change',exact:true}).click()
      await page.getByText('Sent for approval: a second administrator must approve it.',{exact:true}).waitFor()
      assert.equal(policy.two_step_enforced,true)`);
s=s.replace('admin edit, invite/reset, logout;', 'admin lifecycle/groups/security approvals, vault management/owner approval/emergency/activity, notification navigation, invite/reset, logout;');fs.writeFileSync(p,s);
