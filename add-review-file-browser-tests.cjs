const fs=require('node:fs');let s=fs.readFileSync('mocked-ui.cjs','utf8');const insert=(marker,text)=>{if(!s.includes(marker))throw Error(marker);s=s.replace(marker,text+'\n'+marker)};
insert('      let chatPolicy=', '      let holdDownload=false;let downloadRequested=false;let downloadReply\n');
s=s.replace("if(path==='/api/jp/files/file/download/')return route.fulfill({status:200,contentType:'application/octet-stream',body:'MOCK DOWNLOAD'})", "if(path==='/api/jp/files/file/download/'){if(!verified)return send({code:'step_up_required',scope:'vault_download',methods:['password']},403);if(holdDownload){downloadRequested=true;await new Promise(resolve=>downloadReply=resolve)}return route.fulfill({status:200,contentType:'application/octet-stream',body:'MOCK DOWNLOAD'})}");
const old="      const download=page.waitForEvent('download');await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click();assert.equal((await download).suggestedFilename(),'renamed.pem')";
if(!s.includes(old))throw Error('Missing downloadtest');s=s.replace(old,`      await page.evaluate(()=>{window.vaultBlobURLs=0;const original=URL.createObjectURL.bind(URL);URL.createObjectURL=value=>{window.vaultBlobURLs++;return original(value)}})
      verified=false
      const attempts=mutations.filter(m=>m.path==='/api/jp/files/file/download/').length
      await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click()
      await page.getByRole('button',{name:'Cancel',exact:true}).click()
      await expect(page.getByRole('button',{name:'Confirm vault file action',exact:true})).toBeEnabled()
      assert.equal(mutations.filter(m=>m.path==='/api/jp/files/file/download/').length,attempts+1)
      assert.equal(await page.evaluate(()=>window.vaultBlobURLs),0)
      await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click()
      await page.getByLabel('Current password',{exact:true}).fill('MOCK_VERIFY')
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'Verify password',exact:true}).click();assert.equal((await download).suggestedFilename(),'renamed.pem')
      assert.equal(mutations.filter(m=>m.path==='/api/jp/files/file/download/').length,attempts+3)
      for(const cancelMethod of ['button','blur']){
        holdDownload=true;downloadRequested=false
        await page.getByRole('button',{name:'Download file renamed.pem',exact:true}).click()
        await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click()
        await expect.poll(()=>downloadRequested).toBe(true)
        const before=await page.evaluate(()=>window.vaultBlobURLs)
        if(cancelMethod==='button')await page.getByRole('button',{name:'Cancel current file download',exact:true}).click()
        else await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
        await expect(page.getByRole('button',{name:'Confirm vault file action',exact:true})).toBeEnabled()
        downloadReply();await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
        await page.getByRole('button',{name:'Cancel vault file action',exact:true}).click()
        assert.equal(await page.evaluate(()=>window.vaultBlobURLs),before)
      }
      holdDownload=false
`);
s=s.replace("id:kind,label:'Mock '+kind,can:", "id:kind,kind:'reset_password',target:{id:'target-'+kind,name:'Same name',email:'target-'+kind+'@example.invalid'},label:'Mock '+kind,can:");
s=s.replace("await page.getByRole('button',{name:'Confirm decision',exact:true}).click();await page.getByRole('button',{name:'Go back',exact:true})", "await expect(page.getByRole('dialog').getByText('Target: Same name (target-'+kind+'@example.invalid)',{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByText('Requested by: Example Tester (tester@example.invalid)',{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByText(/^Expires:/)).toBeVisible();if(kind==='approve')await expect(page.getByRole('dialog').getByText(/24 hours/)).toBeVisible();await page.getByRole('button',{name:'Confirm decision',exact:true}).click();await page.getByRole('button',{name:'Go back',exact:true})");
fs.writeFileSync('mocked-ui.cjs',s);
