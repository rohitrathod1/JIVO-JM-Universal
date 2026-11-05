import type { QueuedMedia } from './queuedMedia'
import type { Attachment, Message, SendPayload } from './api'

export interface PendingSend {
  owner: string; conversation: string; payload: SendPayload; created: number
  status: 'queued' | 'sending' | 'failed'; error?: string
  attempts?: number; nextAttemptAt?: number; media?: QueuedMedia[]; attachments?: Attachment[]; progress?: number
}
export interface OutboxStorage {
  read: (owner?: string) => Promise<PendingSend[]>
  put: (entry: PendingSend, create: boolean) => Promise<void>
  remove: (owner: string, client: string) => Promise<void>
  clear: () => Promise<void>
  subscribe?: (changed: () => void) => () => void
}
export const retryDelay = (attempts: number) => Math.min(60_000, 1_000 * 2 ** Math.min(6, Math.max(0, attempts - 1)))
/** An error that belongs to one queued item (e.g. a file scan that is still running), not to the connection. */
const itemOnly = (error: unknown) => Boolean(error && typeof error === 'object' && 'retryable' in error && (error as { retryable?: unknown }).retryable === true)
/**
 * Order is kept per chat (OFF-06): the first queued item of each chat is its head, and a head that is waiting
 * for its retry time holds back only later items of the same chat. Returns the oldest head that is due now,
 * and the earliest time any head becomes due.
 */
export function nextDue(entries: PendingSend[], now: number): { item?: PendingSend; wake?: number } {
  const heads = new Set<string>(); let wake: number | undefined
  for (const p of entries) {
    if (p.status !== 'queued' || heads.has(p.conversation)) continue
    heads.add(p.conversation)
    const at = p.nextAttemptAt ?? 0
    if (at <= now) return { item: p }
    wake = wake === undefined ? at : Math.min(wake, at)
  }
  return { wake }
}

export class OutboxController {
  private owner: string | null = null
  private epoch = 0
  private lastCreated = 0
  private active = false
  private hydrated = false
  private entries: PendingSend[] = []
  private notice = ''
  private snapshotValue = { entries: this.entries, notice: this.notice }
  private listeners = new Set<() => void>()
  private writes: Promise<unknown> = Promise.resolve()
  private pending = new Map<string, Promise<void>>()
  private flight: AbortController | null = null
  private draining = false
  private syncing = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private deps: {
    storage: OutboxStorage
    send: (conversation: string, payload: SendPayload, signal: AbortSignal) => Promise<Message | null>
    network: (error: unknown) => boolean
    message: (error: unknown) => string
    delivered: (message: Message) => void
    now?: () => number
  }) { deps.storage.subscribe?.(() => void this.sync()) }
  private now() { return this.deps.now?.() ?? Date.now() }
  snapshot = () => this.snapshotValue
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish() { this.syncing++; this.snapshotValue = { entries: this.entries, notice: this.notice }; this.listeners.forEach(l => l()) }
  private cancelTimer() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null }
  private write(work: () => Promise<void>) {
    const result = this.writes.catch(() => {}).then(work)
    this.writes = result.catch(() => {
      this.active = false; this.flight?.abort(); this.cancelTimer()
      this.notice = 'Outbox storage could not be synchronized. Sending is paused; reload the app after checking your connection and session.'
      this.publish()
    })
    return result
  }
  private async sync() {
    const epoch = this.epoch; const sync = ++this.syncing; await this.writes
    try {
      const saved = await this.deps.storage.read()
      if (epoch !== this.epoch || sync !== this.syncing || !this.owner) return
      this.entries = saved.filter(p => p.owner === this.owner).sort((a, b) => a.created - b.created)
      this.publish()
    } catch { this.setActive(false) }
  }
  async bind(owner: string | null, clearStorage = true) {
    if (owner !== null && owner === this.owner && this.hydrated) return
    const epoch = ++this.epoch; this.flight?.abort(); this.cancelTimer()
    this.owner = owner; this.entries = []; this.lastCreated = 0; this.pending.clear(); this.hydrated = false; this.notice = ''; this.publish()
    if (!owner) { this.hydrated = true; if (clearStorage) void this.write(() => this.deps.storage.clear()); return }
    try {
      await this.writes; const saved = await this.deps.storage.read(owner)
      if (epoch !== this.epoch) return
      this.entries = saved.filter(p => p && p.owner === owner && typeof p.conversation === 'string' && typeof p.payload?.client_id === 'string' && typeof p.payload?.body === 'string' && Array.isArray(p.payload?.upload_ids) && Number.isFinite(p.created))
        .sort((a, b) => a.created - b.created).slice(0, 100).map(p => ({ ...p, status: p.status === 'failed' ? 'failed' : 'queued', attempts: Number.isFinite(p.attempts) ? Math.max(0, Math.min(100, p.attempts!)) : 0, nextAttemptAt: Number.isFinite(p.nextAttemptAt) ? Math.min(p.nextAttemptAt!, this.now() + 60_000) : 0 }))
      this.lastCreated = this.entries.reduce((latest, entry) => Math.max(latest, entry.created), 0)
      this.hydrated = true; this.publish(); void this.flush()
    } catch { if (epoch === this.epoch) { this.notice = 'Outbox restore failed. Sending is paused.'; this.setActive(false); this.publish() } }
  }
  setActive(active: boolean) { this.active = active; if (!active) { this.flight?.abort(); this.cancelTimer() } else void this.flush() }

  // Await this before clearing the composer. Failed writes never create queued bubbles.
  enqueue(owner: string, conversation: string, payload: SendPayload, extra?: Pick<PendingSend, 'media' | 'attachments'>): Promise<void> {
    if (owner !== this.owner || !this.hydrated) throw Error('Wait for your outbox to finish restoring.')
    const key = payload.client_id
    const pending = this.pending.get(key)
    if (pending) return pending
    if (this.entries.some(p => p.payload.client_id === key)) return Promise.resolve()
    if (this.entries.length + this.pending.size >= 100) throw Error('The outbox contains 100 messages. Retry or discard some first.')
    const epoch = this.epoch
    // Device time can move backwards while composing; retain enqueue order.
    this.lastCreated = Math.max(this.now(), this.lastCreated + 1)
    const entry: PendingSend = { ...extra, owner, conversation, payload: { ...payload, upload_ids: [...(payload.upload_ids ?? [])] }, created: this.lastCreated, status: 'queued' }
    const operation = this.write(() => this.deps.storage.put(entry, true)).then(() => {
      if (epoch !== this.epoch) throw Error('Your session changed before the message was queued.')
      if (!this.entries.some(p => p.payload.client_id === key)) this.entries = [...this.entries, entry].sort((a, b) => a.created - b.created)
      this.publish(); void this.flush()
    }).finally(() => { if (epoch === this.epoch) this.pending.delete(key) })
    this.pending.set(key, operation)
    return operation
  }
  async uploaded(client: string, key: string, uploadId: string) {
    const epoch = this.epoch
    const entry = this.entries.find(p => p.payload.client_id === client)
    if (!entry) throw Error('Queued message is no longer available.')
    const updated = { ...entry, media: entry.media?.map(m => m.key === key ? { ...m, uploadId } : m) }
    await this.write(() => this.deps.storage.put(updated, false))
    if (epoch !== this.epoch || this.owner !== entry.owner) throw Error('Your session changed.')
    this.entries = this.entries.map(p => p.payload.client_id === client ? updated : p); this.publish()
  }
  progress(client: string, progress: number) {
    const rounded = Math.round(progress * 100) / 100
    const entry = this.entries.find(p => p.payload.client_id === client)
    if (!entry || entry.progress === rounded) return
    this.entries = this.entries.map(p => p === entry ? { ...p, progress: rounded } : p); this.publish()
  }
  discard(client: string) {
    const entry = this.entries.find(p => p.payload.client_id === client)
    if (!entry || entry.status === 'sending') return
    this.entries = this.entries.filter(p => p.payload.client_id !== client)
    void this.write(() => this.deps.storage.remove(entry.owner, client)); this.publish(); void this.flush()
  }
  retry(client: string) {
    const entry = this.entries.find(p => p.payload.client_id === client)
    if (entry && entry.status !== 'sending') this.change(client, 'queued', undefined, { attempts: 0, nextAttemptAt: 0 })
    void this.flush()
  }
  private change(client: string, status: PendingSend['status'], error?: string, retry?: Pick<PendingSend, 'attempts' | 'nextAttemptAt'>) {
    this.entries = this.entries.map(p => p.payload.client_id === client ? { ...p, ...retry, status, error } : p)
    const entry = this.entries.find(p => p.payload.client_id === client)
    if (entry) void this.write(() => this.deps.storage.put(entry, false))
    this.publish()
  }
  private schedule() {
    this.cancelTimer()
    if (!this.active || !this.hydrated) return
    const { item, wake } = nextDue(this.entries, this.now())
    if (!item && wake === undefined) return
    const delay = item ? 0 : Math.max(0, wake! - this.now())
    this.timer = setTimeout(() => { this.timer = null; void this.flush() }, delay)
  }
  async flush() {
    if (this.draining || !this.active || !this.hydrated || !this.owner) return
    this.cancelTimer(); this.draining = true
    const epoch = this.epoch
    try {
      await this.writes
      while (this.active && epoch === this.epoch) {
        // Never overtake an older queued message of the same chat whose retry is delayed (other chats may go on).
        const { item } = nextDue(this.entries, this.now())
        if (!item) break
        const controller = new AbortController(); this.flight = controller
        this.change(item.payload.client_id, 'sending'); await this.writes
        if (epoch !== this.epoch) break
        if (!this.active) { this.change(item.payload.client_id, 'queued'); this.flight = null; break }
        try {
          const message = await this.deps.send(item.conversation, item.payload, controller.signal)
          if (epoch !== this.epoch) return
          this.entries = this.entries.filter(p => p.payload.client_id !== item.payload.client_id)
          void this.write(() => this.deps.storage.remove(item.owner, item.payload.client_id)); await this.writes
          this.publish(); if (message) this.deps.delivered(message)
        } catch (error) {
          if (epoch !== this.epoch) return
          const aborted = controller.signal.aborted
          const queued = aborted || itemOnly(error) || this.deps.network(error)
          const attempts = aborted ? item.attempts ?? 0 : (item.attempts ?? 0) + 1
          this.change(item.payload.client_id, queued ? 'queued' : 'failed', queued ? undefined : this.deps.message(error), { attempts, nextAttemptAt: queued && !aborted ? this.now() + retryDelay(attempts) : 0 })
          // A connection failure stops the whole drain; a retry owned by this item lets other chats continue.
          if (queued && (aborted || !itemOnly(error))) break
        } finally { if (this.flight === controller) this.flight = null }
      }
    } finally { this.draining = false; this.schedule() }
  }
}

/** A websocket echo may arrive before the send request or disk cleanup finishes. */
export function pendingForConversation(entries: PendingSend[], conversation: string, messages: Pick<Message, 'client_id'>[]) {
 const acknowledged = new Set(messages.map(m => m.client_id).filter(Boolean))
 return entries.filter(p => p.conversation === conversation && !acknowledged.has(p.payload.client_id))
}
