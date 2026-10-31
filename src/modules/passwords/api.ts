import { randomUUID } from 'expo-crypto'
import { api } from '@/core/api/client'

/**
 * JP (Passwords) API, /api/jp/ (Stage B API §10). Everything here is metadata, safe for the query cache,
 * EXCEPT `revealField`: its result must never be cached, stored or put in a URL. It is a plain function
 * (not a query or mutation) so the value lives only in the calling component's state.
 */

const jp = { baseURL: '/api/jp' }

export interface Person {
  id: string
  name: string
  email: string
  is_active: boolean
}

export type VaultRole = 'owner' | 'manager' | 'editor' | 'viewer'
export type OwnerType = 'personal' | 'company' | 'shared'
export type EntryKind = 'login' | 'api_key' | 'note' | 'card' | 'server' | 'wifi' | 'other'

export interface Vault {
  id: string
  name: string
  description: string
  owner_type: OwnerType
  company: { id: string; code: string; name: string } | null
  my_role: VaultRole | null
  break_glass_until: string | null
  entry_count: number
  archived_at: string | null
  legal_hold: boolean
  frozen: boolean
  created_at: string
  /** My own vault (personal, or a team vault I created: its super owner). Others are under Shared with me. */
  mine: boolean
  can: {
    create_entry: boolean
    edit_folders: boolean
    rename: boolean
    manage_members: boolean
    remove_members: boolean
    trash: boolean
    archive: boolean
    view_activity: boolean
    appoint_owner: boolean
  }
}

export interface Folder {
  id: string
  name: string
  parent: string | null
}

export interface Member {
  user: Person
  role: VaultRole
  added_by: Person | null
  added_at: string
  expires_at: string | null
  via_break_glass: boolean
  /** Created the vault: nobody else can remove them or change their role. */
  super_owner: boolean
}

export interface EntryCan {
  reveal: boolean
  edit: boolean
  share: boolean
  revoke: boolean
  delete: boolean
  move: boolean
  history: boolean
}

export interface Entry {
  id: string
  vault: { id: string; name: string; mine?: boolean }
  kind: EntryKind
  title: string
  username: string
  url: string
  tags: string[]
  folder: string | null
  expires_on: string | null
  updated_at: string
  password_changed_at: string | null
  version: number | null
  trashed_at: string | null
  via: 'role' | 'share' | 'break_glass' | 'none'
  can: EntryCan
}

export interface Share {
  id: string
  grantee: Person
  granted_by: Person
  granted_at: string
  expires_at: string | null
}

export interface EntryDetail extends Entry {
  versions: { version: number; created_by: Person; created_at: string; shredded: boolean; current: boolean }[]
  /** Names of the stored secret fields (never values); null until the person confirmed it's them. */
  secret_fields: string[] | null
  shares: Share[] | null
}

/** What the create/edit form sends. Values travel once, over TLS, and are not kept by the client. */
export interface SecretInput {
  password?: string | null
  notes?: string | null
  fields?: Record<string, string | null>
}

export interface EntryInput {
  vault?: string
  kind: EntryKind
  title: string
  username: string
  url: string
  tags: string[]
  folder: string | null
  expires_on?: string | null
  secret?: SecretInput
}

export interface AuditRow {
  id: number
  at: string
  action: string
  actor: Person | null
  outcome: 'success' | 'denied' | 'failure'
  ip: string | null
  details: Record<string, unknown>
}

export interface BreakGlass {
  id: string
  vault: { id: string; name: string; owner_type: OwnerType }
  requested_by: Person
  reason: string
  requested_at: string
  approved_by: Person | null
  approved_at: string | null
  denied_at: string | null
  expires_at: string | null
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked'
  can: { decide: boolean; revoke: boolean }
}

export interface AdminVault {
  id: string
  name: string
  owner_type: OwnerType
  company: { id: string; code: string; name: string } | null
  entry_count: number
  owners: Person[]
  owner_user: Person | null
  archived_at: string | null
  frozen: boolean
  my_role: VaultRole | null
}

export const jpKeys = {
  all: ['jp'] as const,
  vaults: ['jp', 'vaults'] as const,
  vault: (id: string) => ['jp', 'vault', id] as const,
  members: (id: string) => ['jp', 'members', id] as const,
  files: (id: string) => ['jp', 'files', id] as const,
  pendingOwnerRequests: ['jp', 'owner-requests', 'pending'] as const,
  ownerRequests: (id: string) => ['jp', 'owner-requests', id] as const,
  folders: (id: string) => ['jp', 'folders', id] as const,
  entries: (f: Record<string, string>) => ['jp', 'entries', f] as const,
  entry: (id: string) => ['jp', 'entry', id] as const,
  shared: ['jp', 'shared'] as const,
  audit: (f: Record<string, string>) => ['jp', 'audit', f] as const,
  breakGlass: ['jp', 'break-glass'] as const,
  adminVaults: ['jp', 'admin-vaults'] as const,
  people: (q: string, company?: string) => ['jp', 'people', q, company ?? ''] as const,
}

const clean = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v))

// Vaults
export const listVaults = async () => (await api.get<Vault[]>('/vaults/', jp)).data
export const getVault = async (id: string) => (await api.get<Vault>(`/vaults/${id}/`, jp)).data
export const createTeamVault = async (data: { name: string; description?: string; owner_type: 'company' | 'shared'; company?: string; owner_id: string }, idempotencyKey = randomUUID()) =>
  (await api.post<Vault>('/vaults/', data, { ...jp, headers: { 'Idempotency-Key': idempotencyKey } })).data
export const updateVault = async (id: string, data: { name?: string; description?: string }) => (await api.patch<Vault>(`/vaults/${id}/`, data, jp)).data
export const archiveVault = async (id: string, archived: boolean) => (await api.post<Vault>(`/vaults/${id}/archive/`, { archived }, jp)).data
export const listAdminVaults = async () => (await api.get<AdminVault[]>('/admin/vaults/', jp)).data

// Members
export const listMembers = async (vault: string) => (await api.get<Member[]>(`/vaults/${vault}/members/`, jp)).data
/** Making someone an owner when you are not an owner yourself: a current owner must approve. */
export interface OwnerRequest {
  id: string
  vault: { id: string; name: string }
  user: Person
  /** appoint: make them owner; remove: remove them as owner (requests by someone who is not an owner). */
  action: 'appoint' | 'remove'
  requested_by: Person
  reason: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  requested_at: string
  decided_by: Person | null
  decided_at: string | null
  can: { decide: boolean; cancel: boolean }
}
export type MemberResult = Member | { status: 'pending'; request: OwnerRequest }
export const isPending = (r: MemberResult): r is { status: 'pending'; request: OwnerRequest } => 'status' in r && r.status === 'pending'

export const addMember = async (vault: string, user_id: string, role: VaultRole, expires_at?: string) =>
  (await api.post<MemberResult>(`/vaults/${vault}/members/`, { user_id, role, expires_at: expires_at || undefined }, jp)).data
export const changeMember = async (vault: string, user: string, role: VaultRole) => (await api.patch<MemberResult>(`/vaults/${vault}/members/${user}/`, { role }, jp)).data
export const listOwnerRequests = async (vault: string) => (await api.get<OwnerRequest[]>(`/vaults/${vault}/owner-requests/`, jp)).data
export const decideOwnerRequest = async (id: string, decision: 'approve' | 'deny' | 'cancel') =>
  (await api.post<OwnerRequest>(`/owner-requests/${id}/${decision}/`, {}, jp)).data
/** 202 when an administrator who is not an owner removes an owner: it became a request (``pending``). */
export const removeMember = async (vault: string, user: string) => {
  const r = await api.delete(`/vaults/${vault}/members/${user}/`, jp)
  return { pending: r.status === 202 }
}
export const listPendingOwnerRequests = async () => (await api.get<OwnerRequest[]>('/owner-requests/pending/', jp)).data

// Files (keystores, certificates, config files): encrypted on the server, stored only as ciphertext
export interface VaultFile {
  id: string
  name: string
  size: number
  created_at: string
  updated_at: string
  created_by: { id: string; name: string }
  previewable: boolean
}
export interface VaultFiles {
  results: VaultFile[]
  can: { list: boolean; download: boolean; upload: boolean; rename: boolean; delete: boolean }
  max_bytes: number
}
export const listVaultFiles = async (vault: string, signal?: AbortSignal) => (await api.get<VaultFiles>(`/vaults/${vault}/files/`, { ...jp, signal })).data
/** The raw file as the request body (no multipart: the server never spools it to a temporary file). */
export const uploadVaultFile = async (vault: string, file: Blob & { name?: string }, onProgress?: (fraction: number) => void, signal?: AbortSignal, name = file.name ?? 'file') =>
  (await api.put<VaultFile>(`/vaults/${vault}/files/`, file, {
    ...jp,
    signal,
    timeout: 0,
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) },
    onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
  })).data
export const downloadVaultFile = async (id: string, signal?: AbortSignal) => (await api.post<Blob>(`/files/${id}/download/`, {}, { ...jp, responseType: 'blob', timeout: 120000, signal })).data
export const previewVaultFile = async (id: string, signal?: AbortSignal) => (await api.post<{ name: string; text: string; expires_in: number }>(`/files/${id}/preview/`, {}, { ...jp, signal })).data
export const renameVaultFile = async (id: string, name: string) => (await api.patch<VaultFile>(`/files/${id}/`, { name }, jp)).data
export const deleteVaultFile = async (id: string) => api.delete(`/files/${id}/`, jp)

// Folders
export const listFolders = async (vault: string) => (await api.get<Folder[]>(`/vaults/${vault}/folders/`, jp)).data
export const createFolder = async (vault: string, name: string, parent?: string | null) => (await api.post<Folder>(`/vaults/${vault}/folders/`, { name, parent }, jp)).data
export const renameFolder = async (vault: string, id: string, name: string) => (await api.patch<Folder>(`/vaults/${vault}/folders/${id}/`, { name }, jp)).data
export const deleteFolder = async (vault: string, id: string) => api.delete(`/vaults/${vault}/folders/${id}/`, jp)

// Entries (metadata)
export const listEntries = async (f: Record<string, string | undefined>) =>
  (await api.get<{ results: Entry[]; next_cursor: string | null }>('/entries/', { ...jp, params: clean(f) })).data
export const getEntry = async (id: string) => (await api.get<EntryDetail>(`/entries/${id}/`, jp)).data
export const createEntry = async (data: EntryInput, idempotencyKey = randomUUID()) =>
  (await api.post<Entry>('/entries/', data, { ...jp, headers: { 'Idempotency-Key': idempotencyKey } })).data
export const updateEntry = async (id: string, data: Partial<EntryInput>) => (await api.patch<Entry>(`/entries/${id}/`, data, jp)).data
export const trashEntry = async (id: string) => (await api.post<Entry>(`/entries/${id}/trash/`, {}, jp)).data
export const restoreEntry = async (id: string) => (await api.post<Entry>(`/entries/${id}/restore/`, {}, jp)).data
export const moveEntry = async (id: string, vault: string, folder?: string | null) => (await api.post<Entry>(`/entries/${id}/move/`, { vault, folder }, jp)).data
export const listShared = async () => (await api.get<(Entry & { share: Share })[]>('/shared-with-me/', jp)).data

// Secrets: never cached. The caller keeps the value in component state and clears it.
export const revealField = async (id: string, field: string, version?: number) =>
  (await api.post<{ field: string; value: string; version: number; expires_in: number }>(`/entries/${id}/reveal/`, { field, version }, jp)).data
export const reportCopy = async (id: string, field: string) => api.post(`/entries/${id}/copy-event/`, { field }, jp)
export const unlock = async (signal?: AbortSignal) => (await api.post<{ unlocked: boolean; expires_at: string | null }>('/unlock/', {}, { ...jp, signal })).data

// Shares
export const shareEntry = async (id: string, grantee_id: string, expires_at?: string) =>
  (await api.post<Share>(`/entries/${id}/shares/`, { grantee_id, expires_at: expires_at || undefined }, jp)).data
export const revokeShare = async (id: string, share: string) => api.delete(`/entries/${id}/shares/${share}/`, jp)

// Activity, break-glass, people
export const listAudit = async (f: Record<string, string | undefined>) =>
  (await api.get<{ results: AuditRow[]; next_cursor: string | null }>('/audit/', { ...jp, params: clean(f) })).data
export const listBreakGlass = async () => (await api.get<BreakGlass[]>('/break-glass/', jp)).data
export const requestBreakGlass = async (vault_id: string, reason: string) => (await api.post<BreakGlass>('/break-glass/', { vault_id, reason }, jp)).data
export const actBreakGlass = async (id: string, decision: 'approve' | 'deny' | 'revoke', hours?: number) =>
  (await api.post<BreakGlass>(`/break-glass/${id}/${decision}/`, { hours }, jp)).data
export const searchPeople = async (q: string, company?: string) => (await api.get<Person[]>('/people/', { ...jp, params: clean({ q, company }) })).data
export const listCompanyDirectory = async () => (await api.get<{ id: string; code: string; name: string }[]>('/companies/')).data

