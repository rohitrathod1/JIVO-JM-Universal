import { useLocalSearchParams } from 'expo-router'
import { Workspace } from '../components/Workspace'
import { Messenger } from '../components/Messenger'
export default function Screen() { const p = useLocalSearchParams<{ conversation?: string; seq?: string }>(); const seq = Number(p.seq); return <Workspace><Messenger key={p.conversation ?? 'list'} conversation={typeof p.conversation === 'string' ? p.conversation : undefined} seq={Number.isSafeInteger(seq) && seq > 0 ? seq : undefined} /></Workspace> }
