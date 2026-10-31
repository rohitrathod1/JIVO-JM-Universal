const fs=require('fs');let s=fs.readFileSync('mocked-ui.cjs','utf8');
s=s.replace('let preferences =',"let folders = []; let shares = []\n      let preferences =");
s=s.replace("if (path === '/api/jp/vaults/vault/folders/') return send([])",`if (path === '/api/jp/vaults/vault/folders/') { if (method === 'POST') folders.push({ id: 'folder', name: body.name, parent: body.parent }); return send(method === 'POST' ? folders.at(-1) : folders) }
        if (path === '/api/jp/vaults/vault/folders/folder/') { if (method === 'PATCH') folders[0].name = body.name; else if (method === 'DELETE') folders = []; return send(folders[0] || {}) }
        if (path === '/api/jp/people/') return send([{ id: 'peer', name: 'Example Colleague', email: 'colleague@example.invalid', is_active: true }])
        if (path === '/api/jp/entries/entry/shares/') { const share = { id: 'share', grantee: { id: 'peer', name: 'Example Colleague' }, granted_by: { id: 'me', name: 'Example Tester' }, granted_at: '2026-10-20', expires_at: body.expires_at || null }; shares.push(share); return send(share) }
        if (path === '/api/jp/entries/entry/shares/share/') { shares = []; return send({}) }
        if (path === '/api/jp/entries/entry/move/') { entries[0].folder = body.folder; return send(entries[0]) }`);
s=s.replace('versions: [], shares: [], secret_fields:', 'versions: [{ version: 1, current: true, shredded: false, created_at: \'2026-10-20\' }, { version: 0, current: false, shredded: false, created_at: \'2026-10-19\' }], shares, secret_fields:');
s=s.replace("await page.getByRole('button', { name: 'Open Example entry', exact: true }).click()",`await page.getByRole('button', { name: 'Manage folders', exact: true }).click()
      await page.getByLabel('New folder name', { exact: true }).fill('Example folder')
      await page.getByRole('button', { name: 'Create folder', exact: true }).click()
      await page.getByRole('button', { name: 'Rename folder Example folder', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Close folder manager', exact: true }).click()
      await page.getByRole('button', { name: 'Open Example entry', exact: true }).click()`);
s=s.replace("await page.getByRole('button', { name: 'Close entry', exact: true }).click()",`await page.getByRole('button', { name: 'Reveal password from version 0', exact: true }).click()
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Hide secret', exact: true }).click()
      await page.getByRole('button', { name: 'Share entry', exact: true }).click()
      await page.getByLabel('Find a person to share with', { exact: true }).fill('Example')
      await page.getByRole('button', { name: 'Example Colleague (colleague@example.invalid)', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm entry share', exact: true }).click()
      await page.getByRole('button', { name: 'Revoke access for Example Colleague', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm revoke access', exact: true }).click()
      await page.getByRole('button', { name: 'Revoke access for Example Colleague', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(shares.length, 0)
      await page.getByRole('button', { name: 'Move entry', exact: true }).click()
      await page.getByRole('button', { name: 'Example vault', exact: true }).click()
      await page.getByRole('button', { name: 'Example folder', exact: true }).last().click()
      await page.getByRole('button', { name: 'Confirm entry move', exact: true }).click()
      await page.getByRole('button', { name: 'Close entry', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(entries[0].folder, 'folder')`);
s=s.replace('vault reveal expiry/create', 'vault reveal expiry/version/create/share/revoke/move/folders');fs.writeFileSync('mocked-ui.cjs',s);
