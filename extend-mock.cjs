const fs=require('fs');let s=fs.readFileSync('mocked-ui.cjs','utf8');
s=s.replace("let messages = [message('first', 1, 'Hello from the mocked API')]",`let messages = [message('first', 1, 'Hello from the mocked API')]
      let notes = [{ id: 'n1', kind: 'message', title: 'Example activity', body: 'A mocked notification', link: '/messenger', data: {}, read_at: null, created_at: '2026-10-20T06:00:00Z' }]
      const vault = { id: 'vault', name: 'Example vault', description: 'Mocked personal vault', owner_type: 'personal', company: null, my_role: 'owner', break_glass_until: null, entry_count: 1, archived_at: null, legal_hold: false, frozen: false, created_at: '2026-01-01', mine: true, can: { create_entry: true, edit_folders: true, rename: true, manage_members: true, remove_members: true, trash: true, archive: true, view_activity: true, appoint_owner: true } }
      let entries = [{ id: 'entry', vault: { id: 'vault', name: vault.name }, kind: 'login', title: 'Example entry', username: 'example', url: 'https://example.invalid', tags: [], folder: null, expires_on: null, updated_at: '2026-10-20', password_changed_at: null, version: 1, trashed_at: null, via: 'role', can: { reveal: true, edit: true, share: true, revoke: true, delete: true, move: true, history: true } }]
      let preferences = { push_enabled: false, push_preview: 'none', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: true, sound_enabled: true, vibrate_enabled: true }
      const adminPerson = { ...me, status: 'active', companies: [], groups: [], mfa_enabled: false, employee_code: null, is_active: true, is_deleted: false }
`);
s=s.replace("if (path === '/api/jm/notifications/') return send({ results: [], next_cursor: null })\n        if (path === '/api/jp/vaults/') return send([])",`if (path === '/api/jm/notifications/') return send({ results: notes.filter(n => url.searchParams.get('state') !== 'unread' || !n.read_at), next_cursor: null })
        if (path === '/api/jm/notifications/read/') { notes.forEach(n => { n.read_at = '2026-10-20' }); return send({}) }
        if (path === '/api/jm/notifications/delete/') { notes = notes.filter(n => !body.ids.includes(n.id)); return send({ removed: 1 }) }
        if (path === '/api/jm/me/notification-preferences/') { if (method === 'PATCH') Object.assign(preferences, body); return send(preferences) }
        if (path === '/api/jp/vaults/') return send([vault])
        if (path === '/api/jp/vaults/vault/folders/') return send([])
        if (path === '/api/jp/entries/' && method === 'GET') return send({ results: entries.filter(e => url.searchParams.get('trashed') === '1' ? e.trashed_at : !e.trashed_at), next_cursor: null })
        if (path === '/api/jp/entries/' && method === 'POST') { const entry = { ...entries[0], ...body, id: 'entry-new', vault: entries[0].vault }; delete entry.secret; entries.push(entry); return send(entry) }
        if (/^\\/api\\/jp\\/entries\\/[^/]+\\/$/.test(path)) { const entry = entries.find(e => e.id === path.split('/')[4]); if (method === 'PATCH') { const { secret, ...metadata } = body; Object.assign(entry, metadata) } return send({ ...entry, versions: [], shares: [], secret_fields: ['password'] }) }
        if (path === '/api/jp/entries/entry/reveal/') return send({ field: 'password', value: 'MOCK_REVEAL_ONLY', version: 1, expires_in: 1 })
        if (path === '/api/jp/entries/entry/trash/') { entries[0].trashed_at = '2026-10-20'; return send(entries[0]) }
        if (path === '/api/jp/entries/entry/restore/') { entries[0].trashed_at = null; return send(entries[0]) }
        if (path === '/api/jm/admin/users/') return send({ count: 1, next: null, previous: null, results: [adminPerson] })
        if (path === '/api/jm/admin/users/me/' && method === 'PATCH') { Object.assign(adminPerson, body); return send(adminPerson) }
        if (path === '/api/jm/auth/invitations/accept/' || path === '/api/jm/auth/password/reset/') { if (method === 'GET') return send({ valid: url.searchParams.get('token') === 'mock-token', email: 'tester@example.invalid', full_name: 'Example Tester' }); signedIn = true; return send({ status: 'ok' }) }`);
s=s.replace("await page.getByRole('button', { name: 'Sign out', exact: true }).click()",`await page.getByRole('link', { name: 'Passwords', exact: true }).click()
      await page.getByRole('button', { name: 'Open vault Example vault', exact: true }).click()
      await page.getByRole('button', { name: 'Open Example entry', exact: true }).click()
      await page.getByRole('button', { name: 'Reveal password', exact: true }).click()
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('MOCK_REVEAL_ONLY') || JSON.stringify(sessionStorage).includes('MOCK_REVEAL_ONLY')), false)
      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: 'Close entry', exact: true }).click()
      await page.getByRole('button', { name: 'Create entry', exact: true }).click()
      await page.getByLabel('Entry title', { exact: true }).fill('New mocked entry')
      await page.getByLabel('Secret password', { exact: true }).fill('MOCK_INPUT_ONLY')
      await page.getByRole('button', { name: 'Save entry', exact: true }).click()
      await page.getByRole('button', { name: 'Open New mocked entry', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Cancel entry', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: 'test-results/vault-mocked-' + width + '.png', fullPage: true })
      await page.getByRole('link', { name: 'Activity', exact: true }).click()
      await page.getByRole('button', { name: 'Open Example activity', exact: true }).click()
      await page.getByRole('button', { name: 'Close notification', exact: true }).click()
      await page.getByRole('button', { name: 'Remove notification', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm removal', exact: true }).click()
      await page.getByText('No notifications match these filters.', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Notification preferences', exact: true }).click()
      await page.getByLabel('Quiet hours start (HH:MM)', { exact: true }).fill('22:00')
      await page.getByLabel('Quiet hours end (HH:MM)', { exact: true }).fill('07:00')
      await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
      await page.getByRole('button', { name: 'Close preferences', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(preferences.dnd_start, '22:00')
      await page.getByRole('link', { name: 'Admin', exact: true }).click()
      await page.getByRole('button', { name: 'Edit person Example Tester', exact: true }).click()
      await page.getByLabel('Full name', { exact: true }).fill('Edited Example Tester')
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel changes', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(adminPerson.full_name, 'Edited Example Tester')
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()`);
s=s.replace("assert.deepEqual(unexpected, [],",`for (const path of ['/invite/mock-token', '/reset-password/mock-token']) {
        await page.goto(base + path)
        await page.getByLabel('New password', { exact: true }).fill('MOCK_NEW_PASSWORD')
        await page.getByLabel('Repeat password', { exact: true }).fill('MOCK_NEW_PASSWORD')
        await page.getByRole('button', { name: /^(Set password and sign in|Save and sign in)$/ }).click()
        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
        await page.getByRole('button', { name: 'Continue', exact: true }).waitFor()
      }
      assert.deepEqual(unexpected, [],`);
s=s.replace('step-up profile save, logout; no external requests','step-up profile save, vault reveal expiry/create, notifications/preferences, admin edit, invite/reset, logout; no external requests');
fs.writeFileSync('mocked-ui.cjs',s);
