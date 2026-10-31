import { confirmedAccessLoss } from './access'
import type { Frame } from '../../core/realtime/client'
import type { ConversationDetail, Message, MessageWindow, WindowQuery } from './api'
import * as window from './lib/window'
export interface HistoryState { id: string | null; detail: ConversationDetail | null; window: window.WindowState; loading: boolean; error: string; accessLost: boolean; latestJump: number; targetSeq: number | null }
interface Dependencies { detail: (id: string) => Promise<ConversationDetail>; read: (id: string, query?: WindowQuery) => Promise<MessageWindow>; message: (error: unknown) => string }
export class HistoryController {
  private state: HistoryState = { id: null, detail: null, window: window.emptyWindow, loading: false, error: '', accessLost: false, latestJump: 0, targetSeq: null }
  private generation = 0
  private listeners = new Set<() => void>()
  private reconciling = false
  private queued: Frame[] = []
  private drain() { if (this.state.loading || this.reconciling) return; const queued = this.queued.splice(0); queued.forEach(frame => this.event(frame)) }
  constructor(private readonly deps: Dependencies) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(state: HistoryState) { this.state = state; this.listeners.forEach(fn => fn()) }
  private fail(error: unknown) {
    if (confirmedAccessLoss(error)) { this.invalidate(); this.publish({ ...this.state, accessLost: true, detail: null, window: window.emptyWindow, loading: false, error: this.deps.message(error) }) }
    else this.publish({ ...this.state, loading: false, error: this.deps.message(error) })
  }
  invalidate = () => { this.generation++; this.reconciling = false; this.queued = [] }
  select = async (id: string | null, around?: number) => {
    const generation = ++this.generation; this.reconciling = false; this.queued = []
    this.publish({ ...this.state, id, detail: null, window: window.emptyWindow, loading: Boolean(id), error: '', accessLost: false })
    if (!id) return
    try {
      const [detail, page] = await Promise.all([this.deps.detail(id), this.deps.read(id, around ? { around } : undefined)])
      if (generation === this.generation) this.publish({ ...this.state, detail, targetSeq: around ?? null, window: window.fromWindow(page), loading: false, latestJump: this.state.latestJump + 1 })
    } catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) this.drain() }
  }
  latest = async (around?: number) => {
    const { id } = this.state; if (!id || this.state.loading || this.state.accessLost) return
    const generation = this.generation; this.publish({ ...this.state, loading: true })
    try {
      const page = await this.deps.read(id, around ? { around } : undefined)
      if (generation === this.generation) this.publish({ ...this.state, targetSeq: around ?? null, window: window.fromWindow(page), latestJump: this.state.latestJump + 1, loading: false })
    } catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) this.drain() }
  }
  page = async (direction: 'before' | 'after') => {
    const { id, window: current, loading } = this.state
    if (!id || loading || this.state.accessLost) return
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
    if (this.state.accessLost || !id || this.reconciling || this.state.loading) return
    if (!current.messages.length) { await this.latest(); return }
    const generation = this.generation; this.reconciling = true
    try {
      const changed = await this.deps.read(id, { changed_since: current.serverTime ?? undefined, from_seq: window.oldestSeq(current)!, to_seq: window.newestSeq(current)! })
      if (generation !== this.generation) return
      this.publish({ ...this.state, window: window.applyChanges(this.state.window, changed) })
      if (!this.state.window.hasMoreAfter) {
        const newer = await this.deps.read(id, { after: window.newestSeq(this.state.window)! })
        if (generation === this.generation) this.publish({ ...this.state, window: window.append(this.state.window, newer) })
      }
    } catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) { this.reconciling = false; this.drain() } }
  }
  refreshDetail = async () => {
    const { id } = this.state; const generation = this.generation; if (!id || this.state.accessLost) return
    try { const detail = await this.deps.detail(id); if (generation === this.generation) this.publish({ ...this.state, detail }) }
    catch (error) { if (generation === this.generation) this.fail(error) }
    finally { if (generation === this.generation) this.drain() }
  }
  accept = (message: Message) => {
    if (this.state.accessLost || message.conversation !== this.state.id) return
    this.publish({ ...this.state, window: window.upsert(this.state.window, message) })
  }
  event = (frame: Frame) => {
    if (!this.state.id || this.state.accessLost) return
    if (this.state.loading || this.reconciling) { this.queued.push(frame); return }
    if (frame.type === 'RESYNC') { void this.reconcile(); void this.refreshDetail(); return }
    const data = frame.data as Record<string, unknown> | null
    if (!data || (data.conversation !== this.state.id && !(frame.type.startsWith('CONVERSATION_') && data.id === this.state.id))) return
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
