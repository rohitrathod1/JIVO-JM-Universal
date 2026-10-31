const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')))}function rep(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b)}
edit('src/modules/passwords/secretInput.test.ts',s=>s.replace('as EntryDetail','as unknown as EntryDetail'));
edit('mocked-ui.cjs',s=>{s=rep(s,'mfa_enrolled: false','mfa_enrolled: true');s=rep(s,'let signedIn = false, verified = false', 'let signedIn = false, verified = false, denied = false, socketClient; let recoveryReply; let recoveryRequested = false');s=rep(s,"socket.send(JSON.stringify({ type: 'HELLO'", "socketClient = socket; socket.send(JSON.stringify({ type: 'HELLO'");s=rep(s,"let body = {}", `if (path === '/api/jm/auth/recovery-codes/regenerate/') { recoveryRequested = true; await new Promise(resolve => { recoveryReply = resolve }); return send({ recovery_codes: ['MOCK_DELAYED_RECOVERY'] }) }
        if (path === '/api/jm/conversations/chat/' && method === 'GET' && denied) return send({ code: 'forbidden' }, 403)
        let body = {}`);s=rep(s,"await page.getByRole('button', { name: 'Close media', exact: true }).click()",`messages[0] = { ...messages[0], deleted: true, attachments: [] }
      socketClient.send(JSON.stringify({ type: 'MESSAGE_DELETED', data: { conversation: 'chat', id: 'first', seq: 1, updated_at: '2026-10-20T07:00:00Z' } }))
      await page.getByRole('button', { name: 'Close media', exact: true }).waitFor({ state: 'hidden' })`);
s=rep(s,"assert.equal(me.display_name, 'Updated Example Tester')",`assert.equal(me.display_name, 'Updated Example Tester')
      await page.getByRole('button', { name: 'Regenerate recovery codes', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm', exact: true }).click()
      await expect.poll(() => recoveryRequested).toBe(true)
      await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) })
      recoveryReply()
      await page.getByText('Action completed.', { exact: true }).waitFor()
      await expect(page.getByText('MOCK_DELAYED_RECOVERY', { exact: true })).toHaveCount(0)`);
s=rep(s,"await page.getByRole('button', { name: 'Hide secret', exact: true }).click()",`await page.evaluate(() => window.dispatchEvent(new Event('blur')))
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor({ state: 'hidden' })
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))`);
s=rep(s,"await page.getByRole('button', { name: 'Save entry', exact: true }).click()",`await page.getByRole('button', { name: 'Add custom secret field', exact: true }).click()
      await page.getByLabel('Custom field 1 name', { exact: true }).fill('unchanged')
      await page.getByRole('button', { name: 'Save entry', exact: true }).click()`);s=rep(s,"await page.getByRole('button', { name: 'Open New mocked entry', exact: true }).waitFor()",`await page.getByRole('button', { name: 'Open New mocked entry', exact: true }).waitFor()
      assert.equal(mutations.find(m => m.path === '/api/jp/entries/' && m.method === 'POST').body.secret.fields, undefined)`);
s=rep(s,"await page.getByText('No messages yet.', { exact: true }).waitFor()",`await page.getByText('No messages yet.', { exact: true }).waitFor()
      denied = true; socketClient.send(JSON.stringify({ type: 'MEMBER_REMOVED', data: { conversation: 'chat', user_id: 'me' } }))
      await page.getByText('Select a conversation to get started.', { exact: true }).waitFor()
      await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)`);s=s.replace('conversation/audio playback,','conversation/audio playback/deletion/access loss, recovery race, vault blur/blank fields,');return s;});
