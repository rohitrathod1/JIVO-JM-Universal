const fs=require('fs');const p='src/components/ActivityPanel.tsx';let s=fs.readFileSync(p,'utf8');s=s.replace("import { Sheet }", "import { AlertsPanel } from './AlertsPanel'\nimport { Sheet }");s=s.replace('export function ActivityPanel()', 'function NotificationList()');s+=`
export function ActivityPanel() {
  const [tab, setTab] = useState<'notifications' | 'alerts'>('notifications')
  return <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', gap: 8, padding: 12 }}><Button title="Notifications" onPress={() => setTab('notifications')} /><Button title="Alerts" onPress={() => setTab('alerts')} /></View>{tab === 'notifications' ? <NotificationList /> : <AlertsPanel />}</View>
}
`;fs.writeFileSync(p,s);
