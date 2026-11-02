import { IncomingShareBridge } from '../components/IncomingShareBridge'
import { AppLock } from '../components/AppLock'
import { AttachmentExportStatus } from '../components/AttachmentExportStatus'
import { ChatAppearance } from '../components/ChatAppearance'
import { VaultExportStatus } from '../components/VaultExportStatus'
import { useFonts } from 'expo-font'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '../core/theme/ThemeProvider'
import { SessionProvider } from '../core/auth/Session'
import { StepUp } from '../components/StepUp'
import { LiveUpdates } from '../components/LiveUpdates'
import { PwaSupport } from '../components/PwaSupport'
export default function Layout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })
  if (!loaded && !error) return <ActivityIndicator accessibilityLabel="Loading JM" />
  return <SafeAreaProvider><ThemeProvider><SessionProvider><ChatAppearance><VaultExportStatus /><AttachmentExportStatus /><AppLock><LiveUpdates><PwaSupport /><IncomingShareBridge /><Stack screenOptions={{ headerShown: false }} /><StepUp /></LiveUpdates></AppLock></ChatAppearance></SessionProvider></ThemeProvider></SafeAreaProvider>
}

