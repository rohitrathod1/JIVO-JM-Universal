import { ScrollView } from 'react-native'
import { Workspace } from '../components/Workspace'
import { SoftwareTools } from '../components/SoftwareTools'
import { styles } from '../ui'
export default function ToolsScreen() { return <Workspace><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><SoftwareTools /></ScrollView></Workspace> }
