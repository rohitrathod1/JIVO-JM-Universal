import { useLocalSearchParams } from 'expo-router'
import { Workspace } from '../components/Workspace'
import { AdminPanel } from '../components/AdminPanel'
// Reference /admin/users, /admin/groups, /admin/security in one route (?tab=), one section at a time.
export default function Screen() { const p = useLocalSearchParams<{ tab?: string; user?: string }>(); return <Workspace><AdminPanel key={[p.tab,p.user].join(':')} initialTab={typeof p.tab === 'string' ? p.tab : undefined} initialUser={typeof p.user === 'string' ? p.user : undefined} /></Workspace> }
