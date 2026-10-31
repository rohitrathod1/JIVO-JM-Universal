import { VaultGate } from '../components/VaultGate'
import { useLocalSearchParams } from 'expo-router'
import { Workspace } from '../components/Workspace'
import { VaultPanel } from '../components/VaultPanel'
export default function Screen() { const p = useLocalSearchParams<{ vault?: string; entry?: string; view?: string }>(); return <Workspace><VaultGate><VaultPanel key={[p.vault,p.entry,p.view].join(':')} initialVault={typeof p.vault === 'string' ? p.vault : undefined} initialEntry={typeof p.entry === 'string' ? p.entry : undefined} initialView={typeof p.view === 'string' ? p.view : undefined} /></VaultGate></Workspace> }
