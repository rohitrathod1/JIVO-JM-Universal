import type { ConversationItem } from '../messenger/api'
import type { PickedFile } from '../messenger/media/model'
export const SHARE_TTL = 10 * 60 * 1000
export const SHARE_MAX_FILES = 10
export const SHARE_MAX_BYTES = 50 * 1024 * 1024
export interface ShareJob { conversation: string; title: string; clientId: string; uploadKeys: string[]; uploadIds: (string | null)[]; sent: boolean }
export interface SharePlan { caption: string; jobs: ShareJob[] }
export interface IncomingShare { id: string; owner: string | null; at: number; caption: string; files: PickedFile[]; plan?: SharePlan }
export function compatibleSharePlan(previous: SharePlan | undefined, next: SharePlan | undefined): boolean {
  return !previous || (!!next && previous.caption === next.caption && JSON.stringify(previous.jobs.map(job => [job.conversation, job.clientId, job.uploadKeys])) === JSON.stringify(next.jobs.map(job => [job.conversation, job.clientId, job.uploadKeys])))
}
export function sharedCaption(parts: string[]): string {
  const unique = [...new Set(parts.map(part => part.trim()).filter(Boolean))]
  return unique.filter(part => !unique.some(other => other !== part && other.includes(part))).join('\n')
}
export function validateIncoming(value: Pick<IncomingShare, 'at' | 'caption' | 'files'>, now = Date.now()) {
  if (!Number.isFinite(value.at) || value.at > now + 60000 || now - value.at > SHARE_TTL) throw Error('This share expired. Share it to JM again.')
  if (value.caption.length > 4000) throw Error('Shared text can contain at most 4000 characters.')
  if (value.files.length > SHARE_MAX_FILES) throw Error('Share up to 10 files at a time.')
  if (value.files.some(file => !Number.isFinite(file.size) || file.size < 0) || value.files.reduce((sum, file) => sum + file.size, 0) > SHARE_MAX_BYTES) throw Error('Incoming shares can total at most 50 MB. Use the chat attachment picker for larger files.')
  if (!value.files.length && !value.caption.trim()) throw Error('Nothing to share. Share photos, files or text from another app.')
}
export function shareable(chat: Pick<ConversationItem, 'locked' | 'can'>, files: boolean) { return !chat.locked && chat.can.send && (!files || chat.can.send_file) }
export function makeSharePlan(caption: string, files: readonly PickedFile[], chats: ConversationItem[], uuid: () => string): SharePlan {
  if (!chats.length || chats.length > 5 || new Set(chats.map(chat => chat.id)).size !== chats.length) throw Error('Choose between one and five different chats.')
  if (chats.some(chat => !shareable(chat, files.length > 0))) throw Error('A selected chat is locked or cannot receive this share.')
  if (caption.length > 4000 || (!files.length && !caption.trim())) throw Error('Enter a message of up to 4000 characters.')
  return { caption: caption.trim(), jobs: chats.map(chat => ({ conversation: chat.id, title: chat.title, clientId: uuid(), uploadKeys: files.map(() => uuid()), uploadIds: files.map(() => null), sent: false })) }
}
