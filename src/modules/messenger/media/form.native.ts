import type { PickedFile } from './model'
export function uploadForm(asset: PickedFile, purpose: 'attachment' | 'avatar' | 'background' | 'group_avatar' = 'attachment') {
  const form = new FormData()
  // React Native's multipart networking accepts a URI descriptor instead of browser File.
  form.append('file', { uri: asset.uri, name: asset.name, type: asset.mime } as unknown as Blob)
  form.append('purpose', purpose)
  return form
}
