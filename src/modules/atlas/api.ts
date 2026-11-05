import { api } from '../../core/api/client'
import { ATLAS_PAGE_SIZE, type Ask, type AskPage, type AtlasStatus } from './model'

export type { Ask, AskPage, AtlasStatus } from './model'

/** GET /api/jm/atlas/status/ */
export const atlasStatus = async () => (await api.get<AtlasStatus>('/atlas/status/')).data

/** GET /api/jm/atlas/asks/?before=<id>&limit=30, newest first. */
export const listAsks = async (before?: number) =>
  (await api.get<AskPage>('/atlas/asks/', { params: { limit: ATLAS_PAGE_SIZE, ...(before ? { before } : {}) } })).data

/** POST /api/jm/atlas/asks/ -> 201 Ask. A 503 means Atlas did not take the ask: keep the draft. */
export const createAsk = async (text: string, replyTo: number | null) =>
  (await api.post<Ask>('/atlas/asks/', { text, reply_to: replyTo })).data

/** GET /api/jm/atlas/asks/<id>/; the server refreshes from Atlas first when a poll is due. */
export const getAsk = async (id: number) => (await api.get<Ask>(`/atlas/asks/${encodeURIComponent(String(id))}/`)).data

export const atlasApi = { list: listAsks, create: createAsk, get: getAsk }
