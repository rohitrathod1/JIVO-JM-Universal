const fs=require('fs');let s=fs.readFileSync('mocked-ui.cjs','utf8');
s=s.replace('for (const width of [360, 768, 1440]) {','for (const [width, height] of [[360, 1000], [768, 1000], [1440, 1000], [844, 390]]) {').replace('viewport: { width, height: 1000 }','viewport: { width, height }');
s=s.replace("if (path === '/api/jm/conversations/')",`if (path === '/api/jm/search/messages/') return send({ results: messages.filter(m => m.body.includes(url.searchParams.get('q'))).map(m => ({ message: m, conversation: { id: 'chat', title: 'Example conversation', kind: 'direct' } })), next_cursor: null })
        if (path === '/api/jm/conversations/chat/polls/') { const msg = { ...message('poll-' + messages.length, messages.length + 1, '', true), kind: 'poll', poll: { question: body.question, options: body.options.map((text, index) => ({ id: 'o' + index, text, votes: 0, me: false })), allow_multiple: body.allow_multiple, total_voters: 0 } }; messages.push(msg); return send(msg) }
        if (/^\\/api\\/jm\\/messages\\/[^/]+\\/forward\\/$/.test(path)) return send({})
        if (path === '/api/jm/conversations/')`);
s=s.replace("assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Messenger overflow at ${width}`)",`const sendBounds = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox()
      assert.ok(sendBounds && sendBounds.y + sendBounds.height <= height, 'Composer is reachable inside the viewport')
      if (height < 600) await page.getByRole('button', { name: 'Conversation options', exact: true }).click()
      await page.getByRole('button', { name: 'Create poll', exact: true }).click()
      await page.getByLabel('Poll question', { exact: true }).fill('Mock poll question')
      await page.getByLabel('Poll choices (one per line)', { exact: true }).fill('First choice\\nSecond choice')
      await page.getByRole('button', { name: 'Send poll', exact: true }).click()
      await page.getByText('Mock poll question', { exact: true }).waitFor()
      if (height < 600) await page.getByRole('button', { name: 'Conversation options', exact: true }).click()
      await page.getByRole('button', { name: 'Search messages', exact: true }).click()
      await page.getByLabel('Search messages', { exact: true }).fill('Edited mocked')
      await page.getByRole('button', { name: 'Find messages', exact: true }).click()
      await page.getByRole('button', { name: 'Jump to message', exact: true }).click()
      await page.getByRole('button', { name: 'Close search', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Messenger overflow at ' + width)`);
fs.writeFileSync('mocked-ui.cjs',s);
