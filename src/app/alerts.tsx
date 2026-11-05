import { ScrollView } from 'react-native'
import { Workspace } from '../components/Workspace'
import { AlertsPanel } from '../components/AlertsPanel'
import { styles } from '../ui'
export default function AlertsScreen() { return <Workspace><ScrollView contentContainerStyle={styles.page}><AlertsPanel /></ScrollView></Workspace> }
