import * as DocumentPicker from 'expo-document-picker'
import type { PickedFile } from './model'
export async function pickDocument(type: string | string[] = '*/*'): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type, multiple: false, copyToCacheDirectory: false, base64: false })
  if (result.canceled) return null
  const asset = result.assets[0]
  const dispose = () => { if(asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri) }; if (asset.size === undefined) { dispose(); throw new Error('The document provider did not report a file size.') }
  return { name: asset.name, size: asset.size, mime: asset.mimeType || 'application/octet-stream', uri: asset.uri, file: asset.file, dispose }
}
