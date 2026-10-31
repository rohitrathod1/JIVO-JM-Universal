export interface Frame<T = unknown> { type: string; id?: string; at?: string; data: T }
export interface Socket {
  readyState: number; send: (data: string) => void; close: (code?: number) => void
  onopen: (() => void) | null; onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number }) => void) | null; onerror: (() => void) | null
}
export class RealtimeClient {
  private ws: Socket | null = null
  private wanted = false
  private active = true
  private retries = 0
  private opened = false
  private lastRx = 0
  private retryTimer?: ReturnType<typeof setTimeout>
  private heartbeat?: ReturnType<typeof setInterval>
  private focused: string | null = null
  private listeners = new Map<string, Set<(frame: Frame<never>) => void>>()
  constructor(private readonly url: string, private readonly makeSocket: (url: string) => Socket, private readonly revoked: () => void) {}
  on<T = unknown>(type: string, handler: (frame: Frame<T>) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(handler as (frame: Frame<never>) => void); this.listeners.set(type, listeners)
    return () => { listeners.delete(handler as (frame: Frame<never>) => void) }
  }
  private emit(frame: Frame) {
    for (const key of [frame.type, '*']) for (const handler of this.listeners.get(key) ?? []) handler(frame as Frame<never>)
  }
  start() { if (this.wanted || !this.url) return; this.wanted = true; this.connect() }
  stop() { this.wanted = false; this.opened = false; this.retries = 0; this.focused = null; this.disconnect() }
  setActive(value: boolean) {
    if (this.active === value) return
    this.active = value
    if (!value) this.disconnect()
    else if (this.wanted) this.connect()
  }
  setFocusedConversation(id: string | null) { this.focused = id; this.sendState() }
  send(type: string, data: Record<string, unknown> = {}) {
    if (this.ws?.readyState !== 1) return false
    this.ws.send(JSON.stringify({ type, data })); return true
  }
  private sendState() { this.send('CLIENT_STATE', { visible: this.active, focused_conversation: this.focused }) }
  private disconnect() {
    clearTimeout(this.retryTimer); clearInterval(this.heartbeat)
    const ws = this.ws; this.ws = null
    if (ws) { ws.onopen = null; ws.onmessage = null; ws.onclose = null; ws.onerror = null; ws.close(1000) }
  }
  private schedule(slow = false) {
    if (!this.wanted || !this.active) return
    clearTimeout(this.retryTimer)
    const delay = slow ? 60000 : Math.min(30000, 1000 * 2 ** this.retries++) + Math.floor(Math.random() * 500)
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }
  private connect() {
    if (!this.wanted || !this.active || this.ws) return
    let ws: Socket
    try { ws = this.makeSocket(this.url) } catch { this.schedule(); return }
    this.ws = ws; this.lastRx = Date.now()
    ws.onopen = () => {
      if (this.ws !== ws) return
      this.lastRx = Date.now()
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastRx > 60000) { this.disconnect(); this.schedule(); return }
        this.send('PING')
      }, 25000)
    }
    ws.onmessage = event => {
      if (this.ws !== ws) return
      let frame: Frame
      try { frame = JSON.parse(String(event.data)) } catch { return }
      if (!frame || typeof frame.type !== 'string') return
      this.lastRx = Date.now()
      if (frame.type === 'HELLO') {
        const resync = this.opened; this.opened = true; this.retries = 0; this.sendState()
        if (resync) this.emit({ type: 'RESYNC', data: { reason: 'reconnected' } })
      }
      this.emit(frame)
    }
    ws.onerror = () => { /* close handles retry; heartbeat handles a silent connection */ }
    ws.onclose = event => {
      if (this.ws !== ws) return
      this.ws = null; clearInterval(this.heartbeat)
      if (event.code === 4401) { this.stop(); this.revoked(); return }
      if (event.code === 4403) { this.stop(); this.emit({ type: 'FORBIDDEN', data: {} }); return }
      this.schedule(event.code === 4429)
    }
  }
}
