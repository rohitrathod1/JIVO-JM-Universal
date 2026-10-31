const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/components/ConversationWorkspace.tsx',s=>s.replaceAll('style={{ flexGrow: 0 }}', 'style={{ flexGrow: 0, flexShrink: 0, minHeight: 48 }}'));
edit('src/components/AdminPanel.tsx',s=>s.replace("  if (!me?.capabilities.includes('ADMIN_USERS')) return <ScrollView contentContainerStyle={styles.page}><Label>Administration user management is not enabled for your account. Audit screens are still being migrated.</Label></ScrollView>", "  const managesUsers = me?.capabilities.includes('ADMIN_USERS') ?? false\n  if (!managesUsers && !me?.capabilities.includes('ADMIN_AUDIT')) return <Label>Administration access is not enabled for your account.</Label>\n  const currentTab = managesUsers ? tab : 'groups'").replace("(['people', 'companies', 'groups', 'approvals'] as const).map", "(managesUsers ? ['people', 'companies', 'groups', 'approvals'] as const : ['groups'] as const).map").replace("tab === 'people' ? <People /> : tab === 'companies' ? <Companies /> : tab === 'groups' ? <Groups />", "currentTab === 'people' ? <People /> : currentTab === 'companies' ? <Companies /> : currentTab === 'groups' ? <Groups />"));
edit('src/components/VaultPanel.tsx',s=>{
s=s.replace("import { useCursor }", "import { useResource } from '../shared/useResource'\nimport { useCursor }");
s=s.replace('export function VaultPanel() {', `function SharedEntries() {
  const c = useColors(); const resource = useResource(vault.listShared); const [selected, setSelected] = useState<vault.Entry | null>(null)
  return <View style={{ gap: 12 }}><Label large>Shared with me</Label>{resource.loading && <ActivityIndicator />}{!!resource.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{errorMessage(resource.error)}</Text>}{resource.value?.map(entry => <Card key={entry.id}><Label large>{entry.title}</Label><Label>{entry.vault.name} · Shared by {entry.share.granted_by.name}</Label><Button title={\`Open shared entry \${entry.title}\`} onPress={() => setSelected(entry)} /></Card>)}{!resource.loading && !resource.value?.length && <Label>No entries are shared with you.</Label>}{selected && <EntryDetails entry={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); resource.refresh() }} />}</View>
}
export function VaultPanel() {
  const [shared, setShared] = useState(false)`);
s=s.replace('<Label large>Passwords</Label>{loading', '<Label large>Passwords</Label><View style={{ flexDirection: \'row\', flexWrap: \'wrap\', gap: 8 }}><Button title={shared ? \'My vaults\' : \'My vaults selected\'} onPress={() => setShared(false)} /><Button title={shared ? \'Shared with me selected\' : \'Shared with me\'} onPress={() => setShared(true)} /></View>{loading');
s=s.replace("    <View style={{ flexDirection: width >= 1000", "    {shared ? <SharedEntries /> : <View style={{ flexDirection: width >= 1000");
s=s.replace('</View></View>\n  </ScrollView>', '</View></View>}\n  </ScrollView>');return s;
});
edit('mocked-ui.cjs',s=>{
s=s.replace("'JM_CREATE_GROUP', 'JP_ACCESS'", "'JM_CREATE_GROUP', 'JM_SEND_ALERT', 'JP_ACCESS'");s=s.replace('let folders = []; let shares = []', "let folders = []; let shares = []; let sentAlerts = []");
s=s.replace("if (path === '/api/jm/notifications/')", `if (path === '/api/jm/alerts/active/' || path === '/api/jm/alerts/') return send({ results: [], next_cursor: null })
        if (path === '/api/jm/admin/alerts/people/') return send({ results: [person], next_cursor: null })
        if (path === '/api/jm/admin/alerts/') { if (method === 'POST') { const alert = { ...body, id: 'alert', created_at: '2026-10-20', status: 'active', recipient_count: body.user_ids?.length || 1, cancelled_at: null }; sentAlerts.push(alert); return send(alert) } return send({ results: sentAlerts, next_cursor: null }) }
        if (path === '/api/jm/admin/alerts/alert/cancel/') { sentAlerts[0].status = 'cancelled'; return send(sentAlerts[0]) }
        if (path === '/api/jm/notifications/')`);
s=s.replace("assert.equal(preferences.dnd_start, '22:00')", `assert.equal(preferences.dnd_start, '22:00')
      await page.getByRole('button', { name: 'Alerts', exact: true }).click()
      await page.getByRole('button', { name: 'Compose alert', exact: true }).click()
      await page.getByLabel('Alert title', { exact: true }).fill('Example alert')
      await page.getByLabel('Alert message', { exact: true }).fill('Mocked alert content')
      await page.getByRole('button', { name: 'Example Colleague (colleague@example.invalid)', exact: true }).click()
      await page.getByRole('button', { name: 'Review alert', exact: true }).click()
      assert.equal(sentAlerts.length, 0, 'Review must not send an alert')
      await page.getByRole('button', { name: 'Send reviewed alert', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel sent alert Example alert', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm alert change', exact: true }).click()
      await page.getByRole('button', { name: 'Remove sent alert Example alert', exact: true }).waitFor()
      assert.equal(sentAlerts[0].status, 'cancelled')`);
s=s.replace('notifications/preferences, admin', 'notifications/preferences/alert review/send/cancel, admin');return s;
});
