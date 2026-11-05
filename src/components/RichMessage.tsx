import { useCallback, type ReactNode } from 'react'
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native'
import { firstLink, segments } from '../modules/messenger/lib/text'
import { getLinkPreview } from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { useColors } from '../ui'

const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null
const open = (href: string) => void Linking.openURL(href).catch(() => {})

/** Reference Body + LinkPreviewCard: the preview card sits above the text; links are sky, medium weight, no underline. */
export function RichMessage({ body, mentions = [], trailing, own = false }: { body: string; mentions?: string[]; trailing?: ReactNode; own?: boolean }) {
  const c = useColors(); const url = firstLink(body)
  const load = useCallback(() => url ? getLinkPreview(url) : Promise.resolve(null), [url]); const preview = useResource(load).value
  const image = preview?.image && preview.image.length <= 350000 && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(preview.image) ? preview.image : null
  const link = c.dark ? '#7dd3fc' : '#0369a1'
  return <View>
    {preview && url && <Pressable accessibilityRole="link" accessibilityLabel={`Link preview: ${preview.title || preview.domain}`} onPress={() => open(url)}
      style={[{ marginBottom: 4, maxWidth: 352, flexDirection: 'row', overflow: 'hidden', borderRadius: 8, backgroundColor: own ? (c.dark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)') : (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }, pointer]}>
      {image && <Image accessibilityLabel="Link preview" source={{ uri: image }} style={{ width: 112, minHeight: 72 }} resizeMode="cover" />}
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text numberOfLines={2} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }}>{preview.title || preview.domain}</Text>
        {!!preview.description && <Text numberOfLines={2} style={{ marginTop: 2, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{preview.description}</Text>}
        <Text numberOfLines={1} style={{ marginTop: 2, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 }}>{preview.site_name || preview.domain}</Text>
      </View>
    </Pressable>}
    <Text style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 20.625 }}>{segments(body, mentions).map((s, i) => s.type === 'link'
      ? <Text key={i} accessibilityRole="link" onPress={() => open(s.href)} style={[{ color: link, fontFamily: 'Inter_500Medium' }, pointer]}>{s.value}</Text>
      : <Text key={i} style={s.type === 'mention' ? { fontFamily: 'Inter_600SemiBold', color: c.brand } : undefined}>{s.value}</Text>)}{trailing}</Text>
  </View>
}
