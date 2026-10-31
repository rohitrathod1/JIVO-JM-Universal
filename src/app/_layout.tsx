import { AppLock } from '../components/AppLock'
import { AttachmentExportStatus } from '../components/AttachmentExportStatus'
import { ChatAppearance } from '../components/ChatAppearance'
import { VaultExportStatus } from '../components/VaultExportStatus'
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider } from '../core/auth/Session'
import { StepUp } from '../components/StepUp'
export default function Layout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold })
  if (!loaded && !error) return <ActivityIndicator accessibilityLabel="Loading JM" />
  return <SafeAreaProvider><SessionProvider><ChatAppearance><VaultExportStatus /><AttachmentExportStatus /><StatusBar style="auto" /><AppLock><Stack screenOptions={{ headerShown: false }} /><StepUp /></AppLock></ChatAppearance></SessionProvider></SafeAreaProvider>
}

