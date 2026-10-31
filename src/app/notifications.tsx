import { useLocalSearchParams } from 'expo-router'
import { Workspace } from '../components/Workspace'
import { ActivityPanel } from '../components/ActivityPanel'
export default function Screen() { const p = useLocalSearchParams<{ view?: string }>(); return <Workspace><ActivityPanel key={p.view} initialView={typeof p.view === 'string' ? p.view : undefined} /></Workspace> }
