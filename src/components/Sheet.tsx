import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../ui'
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const c = useColors(); const { height } = useWindowDimensions(); const inset = useSafeAreaInsets()
  if (!visible) return null
  return <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: Math.max(16, inset.top), paddingBottom: Math.max(16, inset.bottom), backgroundColor: '#0008' }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, maxHeight: Math.max(100, height - inset.top - inset.bottom - 32), alignSelf: 'center', backgroundColor: c.panel, borderRadius: 18, flexShrink: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}><View style={{ gap: 12 }}>{children}</View></ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
}
