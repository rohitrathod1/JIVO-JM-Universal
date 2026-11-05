import { isAxiosError, isCancel } from 'axios'
import type { HistoryCache } from './conversationCacheController'
import { confirmedAccessLoss } from './access'
import type { Frame } from '../../core/realtime/client'
import type { ConversationDetail, Message, MessageWindow, WindowQuery } from './api'
import * as window from './lib/window'
export interface HistoryState { id: string | null; detail: ConversationDetail | null; window: window.WindowState; loading: boolean; error: string; accessLost: boolean; latestJump: number; targetSeq: number | null; cached: boolean; locked: boolean }
interface Dependencies { detail: (id: string) => Promise<ConversationDetail>; read: (id: string, query?: WindowQuery) => Promise<MessageWindow>; message: (error: unknown) => string; cache?: HistoryCache; lockedAccess?: () => boolean }
export class HistoryController {
  private state: HistoryState = { id: null, detail: null, window: window.emptyWindow, loading: false, error: '', accessLost: false, latestJump: 0, targetSeq: null, cached: false, locked: false }
  private generation = 0
  private listeners = new Set<() => void>()
  private reconciling = false
  private queued: Frame[] = []
  private cacheGeneration: number | undefined
  private drain() { if (this.state.loading || this.reconciling) return; const queued = this.queued.splice(0); queued.forEach(frame => this.event(frame)) }
  constructor(private readonly deps: Dependencies) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(state: HistoryState) {
    if (state.detail?.locked && state.id) this.deps.cache?.remove(state.id)
    if ((state.detail?.locked || state.locked) && !this.deps.lockedAccess?.()) {
      if (!state.locked) this.invalidate()
      if (state.id) this.deps.cache?.remove(state.id)
      state = { ...state, detail: null, window: window.emptyWindow, loading: false, accessLost: false, locked: true, error: '' }
    }
    const now = Date.now()
    state = { ...state, window: { ...state.window, messages: state.window.messages.filter(message => !message.expires_at || Date.parse(message.expires_at) > now) } }
    this.state = state
    if (state.id && state.detail && !state.detail.locked && !state.loading && !state.error && !state.accessLost && !state.cached) this.deps.cache?.put(state.id, { detail: state.detail, window: state.window }, this.cacheGeneration)
    this.listeners.forEach(fn => fn())
  }
  lockChanged = () => {
    if (!this.deps.lockedAccess?.() && this.state.detail?.locked) this.publish(this.state)
    else if (this.deps.lockedAccess?.() && this.state.locked && this.state.id) void this.select(this.state.id)
  }
  expire = () => { if (this.state.window.messages.some(message => message.expires_at && !(Date.parse(message.expires_at) > Date.now()))) this.publish(this.state) }
  private fail(error: unknown) {
    if (confirmedAccessLoss(error) || (isAxiosError(error) && error.response?.status === 401)) { if (this.state.id) this.deps.cache?.remove(this.state.id); this.invalidate(); this.publish({ ...this.state, accessLost: true, locked: false, detail: null, window: window.emptyWindow, loading: false, error: this.deps.message(error) }) }
    else this.publish({ ...this.state, loading: false, error: this.deps.message(error) })
  }
  invalidate = () => { this.generation++; this.reconciling = false; this.queued = [] }
  select = async (id: string | null, around?: number) => {
    const generation = ++this.generation; this.reconciling = false; this.queued = []
    this.publish({ ...this.state, id, detail: null, window: window.emptyWindow, loading: Boolean(id), error: '', accessLost: false, cached: false, locked: false })
    if (!id) return
    let freshDetail: ConversationDetail | undefined
    const cacheGeneration = this.deps.cache?.generation?.()
    try {
      const results = await Promise.allSettled([this.deps.detail(id), this.deps.read(id, around ? { around } : undefined)])
      if (generation !== this.generation) return
      if (results[0].status === 'fulfilled') { freshDetail = results[0].value; this.cacheGeneration = cacheGeneration }
      if (freshDetail?.locked) this.deps.cache?.remove(id)
      if (freshDetail?.locked && !this.deps.lockedAccess?.()) { this.publish({ ...this.state, detail: freshDetail }); return }
      // A fast network failure must not hide a concurrent permission refusal.
      const failures = results.filter(result => result.status === 'rejected')
      const denied = failures.find(result => confirmedAccessLoss(result.reason) || isCancel(result.reason) || (isAxiosError(result.reason) && result.reason.response?.status === 401))
      if (denied) throw denied.reason
      if (failures.length) throw failures[0].reason
      if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') this.publish({ ...this.state, detail: results[0].value, targetSeq: around ?? null, window: window.fromWindow(results[1].value), cached: false, loading: false, latestJump: this.state.latestJump + 1 })
    } catch (error) {
      if (generation !== this.generation) return
      const cached = isAxiosError(error) && !isCancel(error) && !error.response ? await this.deps.cache?.get(id) : null
      if (generation !== this.generation) return
      if (cached) this.publish({ ...this.state, detail: freshDetail ?? cached.detail, window: { ...cached.window, messages: cached.window.messages.filter(message => message.seq >= (freshDetail?.visible_from_seq ?? cached.window.visibleFrom)) }, loading: false, cached: true, error: 'Offline: showing recently synchronized messages.' })
      else this.fail(error)
    }
    finally { if (generation === this.generation) this.drain() }
  }
  latest = async (around?: number) => {
    const { id } = this.state; if (!id || this.state.loading || this.state.accessLost || this.state.locked) return
    const generation = this.generation; this.publish({ ...this.state, loading: true })
    try {
      const page = await this.deps.read(id, around ? { around } : undefined)
      if (generation === this.generation) this.publish({ ...this.state, targetSeq: around ?? null, window: window.fromWindow(page), cached: false, error: '', latestJump: this.state.latestJump + 1, loading: false })
    } catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) this.drain() }
  }
  page = async (direction: 'before' | 'after') => {
    const { id, window: current, loading } = this.state
    if (!id || loading || this.state.accessLost || this.state.locked) return
    const seq = direction === 'before' ? window.oldestSeq(current) : window.newestSeq(current)
    if (seq === null) return
    const generation = this.generation; this.publish({ ...this.state, loading: true, error: '' })
    try {
      const page = await this.deps.read(id, { [direction]: seq })
      if (generation === this.generation) this.publish({ ...this.state, window: direction === 'before' ? window.prepend(this.state.window, page) : window.append(this.state.window, page), loading: false })
    } catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) this.drain() }
  }
  reconcile = async () => {
    const { id, window: current } = this.state
    if (this.state.accessLost || this.state.locked || !id || this.reconciling || this.state.loading) return
    if (!current.messages.length) { await this.latest(); return }
    const generation = this.generation; this.reconciling = true
    try {
      const changed = await this.deps.read(id, { changed_since: current.serverTime ?? undefined, from_seq: window.oldestSeq(current)!, to_seq: window.newestSeq(current)! })
      if (generation !== this.generation) return
      this.publish({ ...this.state, cached: false, error: '', window: window.applyChanges(this.state.window, changed) })
      if (!this.state.window.hasMoreAfter) {
        const newer = await this.deps.read(id, { after: window.newestSeq(this.state.window)! })
        if (generation === this.generation) this.publish({ ...this.state, window: window.append(this.state.window, newer) })
      }
    } catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) { this.reconciling = false; this.drain() } }
  }
  refreshDetail = async () => {
    const { id } = this.state; const generation = this.generation; if (!id || this.state.accessLost || this.state.locked) return false
    const cacheGeneration = this.deps.cache?.generation?.()
    try {
      const detail = await this.deps.detail(id)
      if (generation !== this.generation) return false
      this.cacheGeneration = cacheGeneration
      this.publish({ ...this.state, detail })
      return !this.state.locked && !this.state.accessLost
    }
    catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) this.drain() }
  }
  accept = (message: Message) => {
    if (this.state.accessLost || this.state.locked || message.conversation !== this.state.id) return
    this.publish({ ...this.state, window: window.upsert(this.state.window, message) })
  }
  event = (frame: Frame) => {
    if (!this.state.id || this.state.accessLost) return
    if (this.state.locked && frame.type !== 'CONVERSATION_SETTINGS') return
    if (frame.type === 'RESYNC') {
      if (this.state.loading || this.reconciling) this.queued.push(frame)
      else void this.refreshDetail().then(refreshed => { if (refreshed) return this.reconcile() })
      return
    }
    const data = frame.data as Record<string, unknown> | null
    if (!data || (data.conversation !== this.state.id && !(frame.type.startsWith('CONVERSATION_') && data.id === this.state.id))) return
    if (frame.type === 'CONVERSATION_SETTINGS' && typeof data.locked === 'boolean') {
      if (data.locked) {
        if (this.state.id) this.deps.cache?.remove(this.state.id)
        if (!this.deps.lockedAccess?.()) {
          this.invalidate()
          this.publish({ ...this.state, detail: null, window: window.emptyWindow, accessLost: false, locked: true, loading: false, error: '' })
          return
        }
        if (this.state.detail) this.publish({ ...this.state, detail: { ...this.state.detail, locked: true } })
      } else if (this.state.locked) { void this.select(this.state.id); return }
      else if (this.state.detail) this.publish({ ...this.state, detail: { ...this.state.detail, locked: false } })
    }
    if (this.state.loading || this.reconciling) { this.queued.push(frame); return }
    const seq = typeof data.seq === 'number' ? data.seq : null
    if (frame.type === 'MESSAGE_CREATED' && seq !== null) {
      if (window.hasGap(this.state.window, seq)) void this.reconcile()
      else this.accept(data as unknown as Message)
    } else if (frame.type === 'MESSAGE_HIDDEN' && typeof data.id === 'string') {
      this.publish({ ...this.state, window: window.removeHidden(this.state.window, data.id) })
    } else if (frame.type === 'MESSAGE_DELETED' && seq !== null) {
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, window.tombstone(Boolean(data.by_moderator), String(data.updated_at))) })
     } else if (frame.type === 'MESSAGE_UPDATED' && seq !== null) {
      const patch = { body: data.body, edited_at: data.edited_at, updated_at: data.updated_at, mentions: data.mentions } as Partial<Message>
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, patch) })
    } else if (frame.type === 'REACTION_UPDATED' && seq !== null) {
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, { reactions: data.reactions as Message['reactions'] }) })
    } else if (frame.type === 'EVENT_UPDATED' && seq !== null) {
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, { event: data.event as Message['event'] }) })
    } else if (frame.type === 'POLL_UPDATED' && seq !== null) {
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, { poll: data.poll as Message['poll'] }) })
    } else if (['MESSAGE_READ', 'MESSAGE_DELIVERED'].includes(frame.type) && data.receipts) {
      this.publish({ ...this.state, window: window.advanceReceipts(this.state.window, data.receipts as window.WindowState['receipts']) })
    } else if (frame.type.startsWith('CONVERSATION_') || frame.type.startsWith('MEMBER_')) {
      void this.refreshDetail()
      if (frame.type === 'CONVERSATION_CLEARED' || (frame.type === 'CONVERSATION_SETTINGS' && typeof data.cleared_seq === 'number' && data.cleared_seq >= this.state.window.visibleFrom)) void this.latest()
    }
  }
}
