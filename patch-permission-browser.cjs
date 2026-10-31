const fs=require('fs');const p='mocked-ui.cjs';let s=fs.readFileSync(p,'utf8');function rep(a,b){if(!s.includes(a))throw Error(a);s=s.replace(a,b)}
rep("      let notes =", "      const audioAttachment = messages[0].attachments[0]\n      let notes =");
rep("      denied = true; socketClient.send", `      const restricted = message('restricted', 1, 'Restricted example'); restricted.attachments = [audioAttachment]; messages = [restricted]; socketClient.send(JSON.stringify({ type: 'MESSAGE_CREATED', data: restricted }))
      await page.getByRole('button', { name: 'Open media Example audio.wav', exact: true }).click()
      await page.getByRole('button', { name: 'Close media', exact: true }).waitFor()
      denied = true; socketClient.send`);
rep("      await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)", "      await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)\n      await expect(page.getByRole('button', { name: 'Close media', exact: true })).toHaveCount(0)");
for(const [cap,label] of [['share','Confirm entry share'],['revoke','Confirm revoke access'],['move','Confirm entry move']]){
 const marker=`      await page.getByRole('button', { name: '${label}', exact: true }).click()`;
 rep(marker,`      entries[0].can.${cap} = false
${marker}
      await page.getByText('This action is no longer permitted. Close and reopen the entry to refresh access.', { exact: true }).waitFor()
      entries[0].can.${cap} = true
${marker}`);
}
fs.writeFileSync(p,s);
