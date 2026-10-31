const fs=require('node:fs');let s=fs.readFileSync('mocked-ui.cjs','utf8');const insert=(marker,text)=>{if(!s.includes(marker))throw Error(marker);s=s.replace(marker,text+'\n'+marker)};
insert('      const pendingApproval =',`      let fileRows = [{id:'file',name:'mock.pem',size:12,created_at:'2026-10-20',updated_at:'2026-10-20',created_by:me,previewable:true}]; let fileRenameAllowed=true; let delayedPreview=false; let previewReply; let previewRequested=false
      let deviceRows=[{id:'mock-device',device_label:'Mock tablet',auth_method:'password',created_at:'2026-01-01',last_seen_at:'2026-10-20'}]; let approvalRows=[]
`);
insert("        if (path === '/api/jp/vaults/vault/folders/')",`        if(path==='/api/jp/vaults/vault/files/') {if(method==='PUT'){assert.equal(req.headers()['content-type'],'application/octet-stream');assert.equal(req.postDataBuffer().toString(),'MOCK UPLOAD');fileRows.push({id:'uploaded',name:decodeURIComponent(req.headers()['x-file-name']),size:11,created_by:me,previewable:true});return send(fileRows.at(-1))}return send({results:fileRows,can:{list:true,download:true,upload:true,rename:fileRenameAllowed,delete:true},max_bytes:1024})}
        if(path==='/api/jp/files/file/preview/'){if(delayedPreview){previewRequested=true;await new Promise(resolve=>previewReply=resolve)}return send({name:'mock.pem',text:delayedPreview?'MOCK_LATE_FILE':'MOCK_FILE_PREVIEW',expires_in:1})}
        if(path==='/api/jp/files/file/download/')return route.fulfill({status:200,contentType:'application/octet-stream',body:'MOCK DOWNLOAD'})
        if(/^\\/api\\/jp\\/files\\/[^/]+\\/$/.test(path)){const id=path.split('/')[4];if(method==='PATCH')fileRows.find(f=>f.id===id).name=body.name;if(method==='DELETE')fileRows=fileRows.filter(f=>f.id!==id);return send(fileRows.find(f=>f.id===id)||{})}
        if(path==='/api/jm/admin/users/new-user/sessions/')return send(deviceRows)
        if(path==='/api/jm/admin/users/new-user/sessions/mock-device/revoke/'){deviceRows=[];return send({})}
        if(path==='/api/jm/admin/approvals/')return send({results:approvalRows.filter(a=>url.searchParams.get('status')==='all'||a.status==='pending')})
        if(/^\\/api\\/jm\\/admin\\/approvals\\/[^/]+\\/(approve|deny|cancel)\\/$/.test(path)){const row=approvalRows.find(a=>a.id===path.split('/')[5]);row.status=path.split('/')[6];row.can={decide:false,cancel:false};return send({...row,...(row.status==='approve'?{result:{link:'https://example.invalid/reset/MOCK_APPROVED'}}:{})})}
`);
insert("      await page.getByRole('button', { name: 'Rename vault', exact: true }).click()",`      await page.getByRole('button',{name:'Vault files',exact:true}).click()
      await page.getByRole('button',{name:'Preview file mock.pem',exact:true}).click()
      await page.getByText('MOCK_FILE_PREVIEW',{exact:true}).waitFor()
      await page.getByText('MOCK_FILE_PREVIEW',{exact:true}).waitFor({state:'hidden'})
      delayedPreview=true
      await page.getByRole('button',{name:'Preview file mock.pem',exact:true}).click()
      await expect.poll(()=>previewRequested).toBe(true)
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
      previewReply();await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
      await expect(page.getByRole('button',{name:'Preview file mock.pem',exact:true})).toBeEnabled()
      await expect(page.getByText('MOCK_LATE_FILE',{exact:true})).toHaveCount(0);delayedPreview=false
      await page.getByRole('button',{name:'Rename file mock.pem',exact:true}).click()
      await page.getByLabel('New vault file name',{exact:true}).fill('renamed.pem');fileRenameAllowed=false
      await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click()
      await page.getByText('This file action is no longer allowed.',{exact:true}).last().waitFor()
      assert.equal(fileRows[0].name,'mock.pem');fileRenameAllowed=true
      await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click()
      await page.getByRole('button',{name:'Download file renamed.pem',exact:true}).click()
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click();assert.equal((await download).suggestedFilename(),'renamed.pem')
      const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload vault file',exact:true}).click();await (await chooser).setFiles({name:'upload.pem',mimeType:'application/octet-stream',buffer:Buffer.from('MOCK UPLOAD')})
      await page.getByRole('button',{name:'Delete file upload.pem',exact:true}).click();await page.getByRole('button',{name:'Confirm vault file action',exact:true}).click()
      await expect(page.getByRole('button',{name:'Delete file upload.pem',exact:true})).toHaveCount(0)
      await page.screenshot({path:'test-results/vault-files-'+width+'.png',fullPage:true})
`);
insert("      await page.getByRole('button',{name:'Close person details',exact:true}).click()",`      await page.getByRole('button',{name:'devices',exact:true}).click()
      await page.getByRole('button',{name:'Revoke device Mock tablet',exact:true}).click()
      await page.getByRole('button',{name:'Confirm session revocation',exact:true}).click()
      await expect(page.getByRole('button',{name:'Revoke device Mock tablet',exact:true})).toHaveCount(0)
`);
insert("      await page.getByRole('button', { name: 'Sign out', exact: true }).click()",`      approvalRows=['approve','deny','cancel'].map(kind=>({...pendingApproval,id:kind,label:'Mock '+kind,can:{decide:kind!=='cancel',cancel:kind==='cancel'}}))
      await page.getByRole('button',{name:'approvals',exact:true}).click()
      for(const kind of ['approve','deny','cancel']){await page.getByRole('button',{name:kind[0].toUpperCase()+kind.slice(1)+' Mock '+kind,exact:true}).click();await page.getByRole('button',{name:'Confirm decision',exact:true}).click();await page.getByRole('button',{name:'Go back',exact:true}).waitFor({state:'hidden'});if(kind==='approve'){await page.getByText('https://example.invalid/reset/MOCK_APPROVED',{exact:true}).waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.getByRole('button',{name:'Close access link',exact:true}).waitFor({state:'hidden'});await page.evaluate(()=>window.dispatchEvent(new Event('focus')))}}
      assert.deepEqual(approvalRows.map(a=>a.status),['approve','deny','cancel'])
`);
fs.writeFileSync('mocked-ui.cjs',s);
