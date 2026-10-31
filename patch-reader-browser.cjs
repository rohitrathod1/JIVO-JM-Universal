const fs=require('fs');const p='mocked-ui.cjs';let s=fs.readFileSync(p,'utf8');const marker="      await page.getByLabel('Message', { exact: true }).fill('Mocked text message')";if(!s.includes(marker))throw Error('marker');s=s.replace(marker,`      for (let seq = 2; seq <= 25; seq++) { const incoming = message('reader-' + seq, seq, 'Reader sample ' + seq); messages.push(incoming); socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: incoming })) }
      await expect(page.getByText('Reader sample 25', { exact: true })).toBeInViewport()
      await page.getByText('Reader sample 25', { exact: true }).evaluate(node => { let scroll = node.parentElement; while (scroll && !(scroll.scrollHeight > scroll.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement; if (!scroll) throw Error('Message scroll container missing'); scroll.scrollTop = 0; scroll.dispatchEvent(new Event('scroll')) })
      await expect(page.getByText('Reader sample 2', { exact: true })).toBeInViewport()
      const incoming = message('reader-26', 26, 'Arrival while reading history'); messages.push(incoming); socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: incoming }))
      await page.getByRole('button', { name: 'New messages — jump to latest', exact: true }).waitFor()
      await expect(page.getByText('Reader sample 2', { exact: true })).toBeInViewport()
      await page.getByRole('button', { name: 'New messages — jump to latest', exact: true }).click()
      await expect(page.getByText('Arrival while reading history', { exact: true })).toBeInViewport()
`+marker);fs.writeFileSync(p,s);
