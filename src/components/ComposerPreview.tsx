import { useCallback, useEffect, useState } from 'react'
import { Image, Linking, Pressable, Text, View } from 'react-native'
import { firstLink } from '../modules/messenger/lib/text'
import { getLinkPreview } from '../modules/messenger/api'
import { previewLines, safePreviewImage } from '../modules/messenger/composerPreview'
import { useResource } from '../shared/useResource'
import { useColors } from '../ui'

/** Link being typed: compact card above the box (reference Composer + LinkPreviewCard compact), with a hide button. */
export function ComposerPreview({ body }: { body: string }) {
  const c = useColors()
  const url = firstLink(body); const [settled, setSettled] = useState<string | null>(null); const [dismissed, setDismissed] = useState<string | null>(null)
  useEffect(() => { const timer = setTimeout(() => setSettled(url), 400); return () => clearTimeout(timer) }, [url])
  const load = useCallback(() => settled && settled !== dismissed ? getLinkPreview(settled) : Promise.resolve(null), [settled, dismissed])
  const { value } = useResource(load)
  if (!value || !url || url !== settled || url === dismissed) return null
  const lines = previewLines(value); const image = safePreviewImage(value.image)
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${lines.title}`} onPress={() => void Linking.openURL(url).catch(() => {})} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 8, backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', cursor: 'pointer' }}>
      {image && <Image accessible={false} source={{ uri: image }} style={{ width: 64, height: 64 }} resizeMode="cover" />}
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text numberOfLines={2} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.text }}>{lines.title}</Text>
        {!!lines.description && <Text numberOfLines={1} style={{ fontSize: 12, color: c.muted }}>{lines.description}</Text>}
        <Text numberOfLines={1} style={{ fontSize: 11, color: c.muted }}>{lines.site}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Hide link preview" onPress={() => setDismissed(url)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Text style={{ color: c.muted, fontSize: 18, lineHeight: 20 }}>×</Text></Pressable>
  </View>
}
