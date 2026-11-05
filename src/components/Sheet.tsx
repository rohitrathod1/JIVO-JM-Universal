import { useEffect, useState, type ReactNode } from 'react'
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, glass, radius, useColors } from '../ui'
import { Icon } from './Icon'

const web = Platform.OS === 'web'

/**
 * Modal sheet, the reference shared/ui/Dialog: a level-4 glass overlay, centred from 768px (max-w-md 448px,
 * `wide` max-w-2xl 672px) and a bottom sheet on phones (top corners rounded, at most 85% high).
 * With `title` it draws the reference header (px-5 py-4, 16px semibold title, optional description, 20px X)
 * and a divider; `footer` adds the right-aligned button row under a divider.
 * `side` with a title is the reference contact Profile: a 384px full-height panel on the right, full screen on phones.
 * The overlay is the reference slate-900/30 with a light blur on web.
 */
export function Sheet({ visible, onClose, children, title, description, footer, closeLabel = 'Close', closeDisabled = false, wide = false, side = false, stableForm = false, bottomAligned = false }: { visible: boolean; onClose: () => void; children?: ReactNode; title?: string; description?: ReactNode; footer?: ReactNode; closeLabel?: string; closeDisabled?: boolean; wide?: boolean; side?: boolean; stableForm?: boolean; bottomAligned?: boolean }) {
  const c = useColors(); const { height, width } = useWindowDimensions(); const inset = useSafeAreaInsets()
  const panel = side && !!title; const phonePanel = panel && width < 768
  const bottom = !panel && (bottomAligned || width < 768)
  const [keyboardVisible, setKeyboardVisible] = useState(() => !web && Keyboard.isVisible())
  useEffect(() => {
    if (web) return
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  // Web: Escape closes (Radix Dialog behaviour); RN Modal handles the Android back button through onRequestClose.
  useEffect(() => {
    if (!web || !visible || typeof document === 'undefined') return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !closeDisabled) { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [visible, closeDisabled, onClose])
  if (!visible) return null
  const surface: ViewStyle = panel
    ? { ...glass(c, 4), borderWidth: 0, width: phonePanel ? '100%' : 384, height: '100%', paddingTop: inset.top, paddingBottom: inset.bottom, borderLeftWidth: phonePanel ? 0 : 1, borderLeftColor: c.border, overflow: 'hidden', ...(web ? { boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } : {}) }
    : { ...glass(c, 4), borderWidth: 1, width: '100%', maxWidth: bottom ? undefined : wide ? 672 : 448, maxHeight: stableForm ? '100%' : Math.max(100, Math.round((height - (bottom ? inset.top : 0)) * 0.85)), alignSelf: 'center', flexShrink: 1, overflow: 'hidden',
      ...(bottom ? { borderTopLeftRadius: radius.panel, borderTopRightRadius: radius.panel, borderBottomWidth: 0, paddingBottom: keyboardVisible ? 0 : inset.bottom } : { borderRadius: radius.panel }) }
  const closeButton = <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} disabled={closeDisabled} onPress={onClose}
    style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [panel ? { width: 36, height: 36, borderRadius: 18 } : { width: 28, height: 28, margin: -4, borderRadius: 6 }, { alignItems: 'center', justifyContent: 'center', opacity: closeDisabled ? 0.5 : 1, backgroundColor: hovered || pressed ? c.hover : 'transparent' }, web ? ({ cursor: 'pointer' } as object) : null]}>
    <Icon name="x" size={panel ? 18 : 20} color={c.muted} />
  </Pressable>
  return <Modal transparent visible={visible} onRequestClose={onClose} animationType={bottomAligned ? "slide" : "none"}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : stableForm || bottomAligned ? undefined : 'height'} style={[{ flex: 1, backgroundColor: web ? 'rgba(15,23,42,0.3)' : '#0008', ...(stableForm ? { justifyContent: 'flex-start', paddingTop: inset.top + 16, paddingBottom: Math.max(16, inset.bottom), paddingHorizontal: bottom ? 0 : 16 } : panel ? { justifyContent: 'center', alignItems: 'flex-end' } : bottom ? { justifyContent: 'flex-end' } : { justifyContent: 'center', paddingHorizontal: 16, paddingTop: Math.max(16, inset.top), paddingBottom: Math.max(16, inset.bottom) }) }, web && !panel ? ({ backdropFilter: 'blur(8px)' } as object) : null]}>
      {/* A tap on the dim overlay closes, like the reference Radix overlay. It is pointer-only (keyboard uses
          Escape / the Close button), so it stays out of the tab order and the accessibility tree (DEF-007). */}
      <Pressable accessible={false} focusable={false} aria-hidden importantForAccessibility="no-hide-descendants" onPress={closeDisabled ? undefined : onClose} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, web ? ({ cursor: 'default' } as object) : null]} />
      <View accessibilityViewIsModal role="dialog" aria-label={title} style={surface}>
        {!!title && (panel
          ? <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 12, paddingVertical: 10 }}>
            <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24 }}>{title}</Text>
            {closeButton}
          </View>
          : <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text accessibilityRole="header" numberOfLines={2} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24 }}>{title}</Text>
              {!!description && <Text style={{ marginTop: 2, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{description}</Text>}
            </View>
            {closeButton}
          </View>)}
        {children != null && children !== false && <ScrollView automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never" style={panel ? { flex: 1 } : { flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={title && !panel ? { paddingHorizontal: 20, paddingVertical: 16 } : { padding: 20, paddingTop: panel ? 16 : 20 }}><View style={{ gap: 12 }}>{children}</View></ScrollView>}
        {!!footer && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border }}>{footer}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>
}

/** Reference ConfirmDialog: names the record and the consequence; Cancel plus a primary or danger confirm. */
export function ConfirmDialog({ visible, onClose, title, body, confirmLabel, confirmAccessibilityLabel, danger = false, loading = false, onConfirm }: { visible: boolean; onClose: () => void; title: string; body: ReactNode; confirmLabel: string; confirmAccessibilityLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void }) {
  const c = useColors()
  return <Sheet visible={visible} onClose={() => { if (!loading) onClose() }} title={title} closeDisabled={loading}
    footer={<><Button variant="secondary" title="Cancel" disabled={loading} onPress={onClose} /><Button variant={danger ? 'danger' : 'primary'} title={confirmLabel} accessibilityLabel={confirmAccessibilityLabel} loading={loading} onPress={onConfirm} /></>}>
    {typeof body === 'string' ? <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20 }}>{body}</Text> : body}
  </Sheet>
}
