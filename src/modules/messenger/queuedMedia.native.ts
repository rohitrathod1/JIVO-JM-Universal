import { Directory, File, Paths } from 'expo-file-system'
import type { PickedFile } from './media/model'
import type { QueuedMedia } from './queuedMedia'
export type { QueuedMedia } from './queuedMedia'
const root = new Directory(Paths.document, 'jm-pending-media')
const segment = (value: string) => 'id-' + encodeURIComponent(value)
const ownerDir = (owner: string) => new Directory(root, segment(owner))
const messageDir = (owner: string, client: string) => new Directory(ownerDir(owner), segment(client))
export const queuedMedia = {
 async save(owner: string, client: string, key: string, file: PickedFile): Promise<QueuedMedia> {
  if (file.size + (root.exists ? root.size ?? 0 : 0) > 500 * 1024 * 1024) throw Error('Offline files are limited to 500 MB. Send or discard queued files first.')
  const dir = messageDir(owner, client); dir.create({ intermediates: true, idempotent: true })
  const target = new File(dir, segment(key)); new File(file.uri).copy(target)
  return { key, name: file.name, mime: file.mime, size: target.size }
 },
 async open(owner: string, client: string, media: QueuedMedia): Promise<PickedFile> {
  const file = new File(messageDir(owner, client), segment(media.key))
  if (!file.exists) throw Error('The saved file is missing. Remove this message and select the file again.')
  return { ...media, uri: file.uri }
 },
 async remove(owner: string, client: string) { const dir = messageDir(owner, client); if (dir.exists) dir.delete() },
 async retain(owner: string | null) { if (!root.exists) return; for (const item of root.list()) { if (!owner || item.name !== segment(owner)) item.delete() } },
}
