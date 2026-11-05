import type { SharePayload, ResolvedSharePayload } from 'expo-sharing'
import type { PickedFile } from '../messenger/media/model'
import { sharedCaption } from './model'
export const localShareUri = (uri: string) => /^(?:file|content):\/\//i.test(uri)
export function mayResolveNative(raw: SharePayload[]) {
  return raw.length > 0 && raw.every(item => ['file', 'image', 'audio', 'video'].includes(item.shareType ?? '') && localShareUri(item.value ?? ''))
}
export function nativeShareParts(raw: SharePayload[], resolved: ResolvedSharePayload[], inspect: (uri: string) => { size: number; name: string }) {
  const caption = sharedCaption(raw.filter(item => !['file', 'image', 'audio', 'video'].includes(item.shareType ?? '')).map(item => item.value ?? ''))
  const files: PickedFile[] = raw.filter(item => ['file', 'image', 'audio', 'video'].includes(item.shareType ?? '')).map(item => {
    const match = resolved.find(value => value.value === item.value)
    const uri = match?.contentUri || item.value || ''
    if (!localShareUri(uri)) throw Error('Only local files can be received from other apps. Web links are shared as text.')
    const info = inspect(uri)
    return { uri, size: match?.contentSize ?? info.size, name: match?.originalName || info.name || 'Shared file', mime: match?.contentMimeType || item.mimeType || 'application/octet-stream' }
  })
  return { caption, files }
}
