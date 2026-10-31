const fs=require('fs');let s=fs.readFileSync('mocked-ui.cjs','utf8');
s=s.replace("const conversation = { id: 'chat', kind: 'direct'", "const members = [{ user: { ...person, id: 'me', name: 'Example Tester' }, role: 'owner', can_send: true, joined_at: '2026-01-01', is_me: true }, { user: person, role: 'member', can_send: true, joined_at: '2026-01-01', is_me: false }]\n      const conversation = { id: 'chat', kind: 'group'");
s=s.replace('edit_info: false, manage_members: false, leave: false','edit_info: true, manage_members: true, leave: true');
s=s.replace("if (path === '/api/jm/conversations/chat/') return send({ ...conversation, my_role: 'member', description: '', created_at: '2026-01-01', visible_from_seq: 1, is_owner: false })",`if (path === '/api/jm/conversations/chat/') { if (method === 'PATCH') Object.assign(conversation, body); return send({ ...conversation, my_role: 'owner', description: '', created_at: '2026-01-01', visible_from_seq: 1, is_owner: true }) }
        if (path === '/api/jm/conversations/chat/members/') { if (method === 'POST') body.user_ids.forEach(id => members.push({ user: { ...person, id, name: 'New Example Member' }, role: 'member', can_send: true, joined_at: '2026-01-01', is_me: false })); return send({ results: members }) }
        if (path === '/api/jm/conversations/chat/members/peer/') { if (method === 'PATCH') members[1].role = body.role; return send({ results: members }) }
        if (path === '/api/jm/users/') return send({ results: [{ ...person, id: 'new-member', name: 'New Example Member' }], next_cursor: null })
        if (path === '/api/jm/conversations/chat/send-mode/') { conversation.send_mode = body.mode; return send({ send_mode: body.mode, results: members }) }
        if (path === '/api/jm/conversations/chat/settings/') { Object.assign(conversation, body); return send(conversation) }
        if (path === '/api/jm/conversations/chat/clear/') { messages = []; return send(conversation) }`);
s=s.replace("await page.getByRole('link', { name: 'Profile', exact: true }).click()",`if (height < 600) await page.getByRole('button', { name: 'Conversation options', exact: true }).click()
      await page.getByRole('button', { name: 'Conversation details', exact: true }).click()
      await page.getByLabel('Group title', { exact: true }).fill('Updated example group')
      await page.getByRole('button', { name: 'Save group information', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Save group information', exact: true })).toBeEnabled()
      await page.getByRole('button', { name: 'Make Example Colleague an admin', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm conversation change', exact: true }).click()
      await page.getByRole('button', { name: 'Make Example Colleague a member', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Add group members', exact: true }).click()
      await page.getByRole('button', { name: 'New Example Member', exact: true }).click()
      await page.getByRole('button', { name: 'Add 1 members', exact: true }).click()
      await page.getByRole('button', { name: 'Remove New Example Member', exact: true }).waitFor()
      assert.equal(mutations.find(m => m.path.endsWith('/members/') && m.method === 'POST').body.share_history, 'none')
      await page.getByRole('button', { name: 'Mute for 8 hours', exact: true }).click()
      await page.getByRole('button', { name: 'Unmute conversation', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Clear conversation for me', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm conversation change', exact: true }).click()
      await page.getByRole('button', { name: 'Close conversation details', exact: true }).click()
      await page.getByText('No messages yet.', { exact: true }).waitFor()
      await page.getByRole('link', { name: 'Profile', exact: true }).click()`);
s=s.replace('text send/edit, step-up', 'text send/edit, poll/search, group edit/role/add/mute/clear, step-up');fs.writeFileSync('mocked-ui.cjs',s);
