import { api } from '@/core/api/client'
import { realtime } from '@/core/realtime/socket'

/** Messenger API types: the backend's JSON, unchanged (Stage B API §4–§6). */

export interface PersonCard {
  id: string
  name: string
  avatar_url: string | null
  company: string | null
  is_active: boolean
  email?: string
}

export interface Attachment {
  id: string
  status: 'received' | 'processing' | 'ready' | 'rejected'
  reject_reason: string
  scan_status?: 'not_scanned' | 'clean' | 'infected' | 'error'
  name: string
  size: number
  mime: string
  kind: 'image' | 'audio' | 'video' | 'file'
  width: number | null
  height: number | null
  /** Audio: the recording's length, measured by the recorder. */
  duration_ms?: number | null
  blurhash: string
  thumb_url: string | null
  preview_url: string | null
  download_url: string
  created_at: string
}

export interface ReplyPreview {
  id: string | null
  seq: number | null
  sender_name: string | null
  preview: string
  deleted: boolean
  unavailable: boolean
}

export interface ReactionSummary {
  emoji: string
  count: number
  me: boolean
}

export type DeliveryStatus = 'sent' | 'delivered' | 'read'

export interface PollOption {
  id: string
  text: string
  votes: number
  me: boolean
}

export interface PollData {
  question: string
  allow_multiple: boolean
  options: PollOption[]
  voters: number
  total_votes: number
}

export interface Message {
  content_status?: 'available' | 'unavailable' | 'temporarily_unavailable'
  id: string
  conversation: string
  seq: number
  sender: PersonCard | null
  client_id: string | null
  kind: 'text' | 'attachment' | 'system' | 'poll' | 'contact'
  body: string
  mentions: string[]
  reply_to: ReplyPreview | null
  attachments: Attachment[]
  reactions: ReactionSummary[]
  forwarded: boolean
  edited_at: string | null
  deleted: boolean
  deleted_by_moderator: boolean
  system: { type: string; actor: PersonCard | null; users: PersonCard[]; text: string } | null
  poll?: PollData | null
  contact?: PersonCard | null
  created_at: string
  updated_at: string
  status: DeliveryStatus | null
  can: { edit: boolean; delete_for_everyone: boolean; react: boolean; reply: boolean; forward: boolean; vote?: boolean }
}

export interface MessageWindow {
  results: Message[]
  mode: 'latest' | 'before' | 'after' | 'around' | 'changes'
  oldest_seq: number | null
  newest_seq: number | null
  has_more_before: boolean | null
  has_more_after: boolean | null
  first_unread_seq: number | null
  last_read_seq: number
  last_seq: number
  visible_from_seq: number
  receipts: { read_seq: number; delivered_seq: number }
  server_time: string
}

export type SendMode = 'everyone' | 'selected' | 'admins'
/** Why the composer is replaced by a notice. */
export type SendBlock = 'left' | 'company' | 'no_permission' | 'admins_only' | 'selected_only' | 'chat_restricted'
export type NotifyPreview = 'none' | 'sender' | 'sender_and_text'

export type PreviewMedia = 'photo' | 'video' | 'voice' | 'file' | 'contact' | 'poll'

export interface ConversationItem {
  send_mode: SendMode
  send_block: SendBlock | null
  /** This chat's notification preview; null = the person's default. */
  notify_preview: NotifyPreview | null
  id: string
  kind: 'direct' | 'group'
  title: string
  avatar_url: string | null
  restricted_company: string | null
  peer: PersonCard | null
  /** Saved Messages: a chat with only yourself (notes, files to keep). */
  is_self?: boolean
  member_count: number
  last_message: {
    id: string
    seq: number
    kind: Message['kind']
    sender: PersonCard | null
    /** One line with an emoji (notifications, older screens). */
    preview: string
    /** For the chat list: the kind as an icon, and the text without an emoji. */
    media?: PreviewMedia | null
    text?: string | null
    deleted: boolean
    created_at: string
  } | null
  last_seq: number
  last_read_seq: number
  unread_count: number
  mention_unread: boolean
  muted_until: string | null
  pinned_at: string | null
  archived_at: string | null
  left: boolean
  updated_at: string
  can: { send: boolean; send_file: boolean; edit_info: boolean; manage_members: boolean; leave: boolean }
}

export interface ConversationDetail extends ConversationItem {
  description: string
  created_at: string
  my_role: 'owner' | 'admin' | 'member'
  visible_from_seq: number
  is_owner: boolean
}

export interface Member {
  user: PersonCard
  role: 'owner' | 'admin' | 'member'
  can_send: boolean
  joined_at: string
  is_me: boolean
}

export interface CursorPage<T> {
  results: T[]
  next_cursor: string | null
}

export type ConversationFilter = 'all' | 'unread' | 'groups' | 'direct' | 'archived'

export interface SendPayload {
  client_id: string
  body: string
  upload_ids?: string[]
  reply_to?: string | null
}

const C = '/conversations'

// Directory
export const searchPeople = async (q: string, cursor?: string | null) =>
  (await api.get<CursorPage<PersonCard>>('/users/', { params: { q: q || undefined, cursor: cursor || undefined, limit: 30 } })).data

// Conversations
export const listConversations = async (filter: ConversationFilter, q: string, cursor?: string | null) =>
  (await api.get<CursorPage<ConversationItem>>(`${C}/`, { params: { filter, q: q || undefined, cursor: cursor || undefined } })).data
export const getConversation = async (id: string) => (await api.get<ConversationDetail>(`${C}/${id}/`)).data
export const openDirect = async (userId: string) => (await api.post<ConversationDetail>(`${C}/direct/`, { user_id: userId })).data
export const createGroup = async (data: { title: string; description?: string; member_ids: string[]; restricted_company?: string | null }) =>
  (await api.post<ConversationDetail>(`${C}/`, data)).data
export const updateGroup = async (id: string, data: { title?: string; description?: string; avatar_upload_id?: string; restricted_company?: string | null }, signal?: AbortSignal) =>
  (await api.patch<ConversationDetail>(`${C}/${id}/`, data, { signal })).data
export const listMembers = async (id: string) => (await api.get<{ results: Member[] }>(`${C}/${id}/members/`)).data.results
export const addMembers = async (id: string, userIds: string[], shareHistory: 'none' | 'recent') =>
  (await api.post<{ results: Member[] }>(`${C}/${id}/members/`, { user_ids: userIds, share_history: shareHistory })).data.results
export const setMemberRole = async (id: string, userId: string, role: 'admin' | 'member') =>
  (await api.patch<{ results: Member[] }>(`${C}/${id}/members/${userId}/`, { role })).data.results
export const removeMember = async (id: string, userId: string) => api.delete(`${C}/${id}/members/${userId}/`)
export const leaveConversation = async (id: string) => api.post(`${C}/${id}/leave/`)
export const setSendMode = async (id: string, mode: SendMode, senderIds: string[] = []) =>
  (await api.put<{ send_mode: SendMode; results: Member[] }>(`${C}/${id}/send-mode/`, { mode, sender_ids: senderIds })).data
export const updateSettings = async (id: string, data: { muted_until?: string | null; pinned?: boolean; archived?: boolean; notify_preview?: NotifyPreview | null }) =>
  (await api.patch<ConversationDetail>(`${C}/${id}/settings/`, data)).data
export const clearChat = async (id: string) => (await api.post<ConversationDetail>(`${C}/${id}/clear/`)).data
export const markRead = async (id: string, seq: number) => api.post(`${C}/${id}/read/`, { seq })
export const markDelivered = async (id: string, seq: number) => api.post(`${C}/${id}/delivered/`, { seq })

// Messages (cursor = seq; never page numbers)
export interface WindowQuery {
  limit?: number
  before?: number
  after?: number
  around?: number
  changed_since?: string
  from_seq?: number
  to_seq?: number
}
export const getWindow = async (id: string, q: WindowQuery = {}) =>
  (await api.get<MessageWindow>(`${C}/${id}/messages/`, { params: q })).data
export const sendMessage = async (id: string, payload: SendPayload, signal?: AbortSignal) =>
  (await api.post<Message>(`${C}/${id}/messages/`, payload, { timeout: 30_000, signal })).data
export const editMessage = async (messageId: string, body: string) => (await api.patch<Message>(`/messages/${messageId}/`, { body })).data
export const deleteMessage = async (messageId: string, scope: 'me' | 'everyone', reason?: string) =>
  api.delete(`/messages/${messageId}/`, { params: { for: scope }, data: reason ? { reason } : undefined })
export const setReaction = async (messageId: string, emoji: string) => (await api.put<ReactionSummary[]>(`/messages/${messageId}/reaction/`, { emoji })).data
export interface ReactionGroup {
  emoji: string
  users: { id: string; name: string; avatar_url: string | null }[]
}
export const listReactions = async (messageId: string) => (await api.get<ReactionGroup[]>(`/messages/${messageId}/reactions/`)).data
export const clearReaction = async (messageId: string) => (await api.delete<ReactionSummary[]>(`/messages/${messageId}/reaction/`)).data
/** `delivered` / `read` are always right; the times can be missing for older messages. */
export type ReceiptPerson = PersonCard & { delivered: boolean; read: boolean; delivered_at: string | null; read_at: string | null }
export interface MessageInfo {
  sent_at: string
  read_by: ReceiptPerson[]
  delivered_to: ReceiptPerson[]
  pending: ReceiptPerson[]
}
export const messageInfo = async (messageId: string) => (await api.get<MessageInfo>(`/messages/${messageId}/info/`)).data
export const forwardMessage = async (messageId: string, conversationIds: string[], clientId: string) =>
  (await api.post(`/messages/${messageId}/forward/`, { conversation_ids: conversationIds, client_id: clientId })).data

export interface SearchHit {
  message: Message
  conversation: { id: string; title: string; kind: 'direct' | 'group' }
  highlight?: string
}
export const searchMessages = async (q: string, cursor?: string | null, conversation?: string) =>
  (await api.get<CursorPage<SearchHit> & { incomplete?: boolean; unavailable_count?: number; coverage?: 'complete' | 'page' | 'partial' }>('/search/messages/', { params: { q, cursor: cursor || undefined, conversation } })).data

// Polls and contact cards
export const createPoll = async (conversationId: string, data: { client_id: string; question: string; options: string[]; allow_multiple: boolean }) =>
  (await api.post<Message>(`/conversations/${conversationId}/polls/`, data)).data
export const votePoll = async (messageId: string, option_ids: string[]) => (await api.put<PollData>(`/messages/${messageId}/poll-vote/`, { option_ids })).data
export const pollVoters = async (messageId: string) =>
  (await api.get<{ id: string; text: string; users: PersonCard[] }[]>(`/messages/${messageId}/poll-votes/`)).data
export const sendContact = async (conversationId: string, client_id: string, contact_id: string) =>
  (await api.post<Message>(`/conversations/${conversationId}/messages/`, { client_id, contact_id })).data

// A person's profile card (privacy rules on the server: the phone only for people who share a chat).
export interface PersonProfile extends PersonCard {
  full_name: string
  bio: string
  email: string
  phone: string | null
  companies: { id: string; company: string; company_name: string; company_color: string; title: string; department: string }[]
}
export const getPerson = async (id: string) => (await api.get<PersonProfile>(`/users/${id}/`)).data

// Uploads
const REJECTED: Record<string, string> = {
  infected: 'This file was blocked by the virus scanner.',
  scan_failed: 'This file could not be checked for viruses. Try again in a moment.',
  image_unreadable: 'This image could not be read. It may be damaged.',
}

export const getUpload = async (id: string) => (await api.get<Attachment>(`/uploads/${id}/`)).data

/**
 * Every file is virus-scanned (and images re-encoded) by the server's worker before it can be sent.
 * Resolves when UPLOAD_READY arrives over the socket (or a poll sees it); rejects with the reason.
 */
export function waitUntilReady(upload: Attachment, timeoutMs = 120_000): Promise<Attachment> {
  if (upload.status === 'ready') return Promise.resolve(upload)
  if (upload.status === 'rejected') return Promise.reject(new Error(REJECTED[upload.reject_reason] ?? 'This file cannot be sent.'))
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (a: Attachment) => {
      if (done || a.id !== upload.id || (a.status !== 'ready' && a.status !== 'rejected')) return
      done = true
      offReady()
      offRejected()
      clearInterval(poll)
      clearTimeout(timer)
      if (a.status === 'ready') resolve(a)
      else reject(new Error(REJECTED[a.reject_reason] ?? 'This file cannot be sent.'))
    }
    const offReady = realtime.on<Attachment>('UPLOAD_READY', (f) => finish(f.data))
    const offRejected = realtime.on<Attachment>('UPLOAD_REJECTED', (f) => finish(f.data))
    const poll = setInterval(() => void getUpload(upload.id).then(finish).catch(() => undefined), 2_000)
    const timer = setTimeout(() => {
      if (done) return
      done = true
      offReady()
      offRejected()
      clearInterval(poll)
      reject(new Error('Checking this file is taking too long. Try again.'))
    }, timeoutMs)
  })
}

export const uploadFile = async (
  file: File,
  purpose: 'attachment' | 'group_avatar' | 'avatar' | 'background',
  idempotencyKey: string,
  onProgress?: (fraction: number) => void,
  extra?: Record<string, string>,
) => {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)
  Object.entries(extra ?? {}).forEach(([k, v]) => form.append(k, v))
  const { data } = await api.post<Attachment>('/uploads/', form, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeout: 0, // big videos can take a while on a slow connection; progress is shown meanwhile
    onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
  })
  // Large files take longer to virus-scan on the server.
  return waitUntilReady(data, file.size > 50 * 1024 * 1024 ? 900_000 : 120_000)
}
export const discardUpload = async (id: string) => api.delete(`/uploads/${id}/`)

// The organisation-wide chat background (set by User Administrators)
export interface Appearance {
  type: 'default' | 'color' | 'image'
  color: string | null
  image_url: string | null
  updated_at: string
}
export const appearanceKey = ['messenger', 'appearance'] as const
export const getAppearance = async () => (await api.get<Appearance>('/appearance/')).data
export const setAppearance = async (data: { type: Appearance['type']; color?: string; upload_id?: string }, signal?: AbortSignal) =>
  (await api.put<Appearance>('/admin/appearance/', data, { signal })).data
export const removeAppearanceImage = async (signal?: AbortSignal) => (await api.delete<Appearance>('/admin/appearance/', { signal })).data

// Link previews (the server fetches the page; 204 = nothing to show)
export interface LinkPreview {
  url: string
  domain: string
  title: string
  description: string
  site_name: string
  /** A small re-encoded picture (data: URL), never a third-party address. */
  image: string | null
}
export const getLinkPreview = async (url: string) => {
  const res = await api.get<LinkPreview | ''>('/link-preview/', { params: { url } })
  return res.status === 204 || !res.data ? null : res.data
}

