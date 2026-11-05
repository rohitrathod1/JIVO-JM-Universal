import type { ComponentProps, ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../ui'
import { IconButton } from './Icon'
import { Sheet } from './Sheet'

export function ConversationInfoFrame({ page, actions, children, ...props }: ComponentProps<typeof Sheet> & { page?: boolean; actions?: ReactNode }) {
 const c = useColors()
 if (!page) return <Sheet {...props}>{children}</Sheet>
 return <SafeAreaView style={{ flex: 1, backgroundColor: c.shell }}>
  <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
   <IconButton name="back" label="Back" disabled={props.closeDisabled} onPress={props.onClose} />
   <Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 20 }}>{props.title}</Text>{actions}
  </View>
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 32 }}>{children}</ScrollView>
  </KeyboardAvoidingView>
 </SafeAreaView>
}
