export interface CursorPage<T> { results: T[]; next_cursor: string | null }
export interface CursorState<T> { items: T[]; cursor: string | null; loading: boolean; error: string }
export class CursorController<T extends { id: string | number }> {
  private state: CursorState<T> = { items: [], cursor: null, loading: false, error: '' }
  private generation = 0
  private listeners = new Set<() => void>()
  private load: (cursor?: string | null) => Promise<CursorPage<T>> = async () => ({ results: [], next_cursor: null })
  constructor(private readonly message: (error: unknown) => string) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(state: CursorState<T>) { this.state = state; this.listeners.forEach(fn => fn()) }
  invalidate = () => { this.generation++ }
  reset = (load: (cursor?: string | null) => Promise<CursorPage<T>>) => { this.load = load; return this.refresh() }
  refresh = async () => {
    const generation = ++this.generation
    this.publish({ items: [], cursor: null, loading: true, error: '' })
    await this.fetch(undefined, generation, true)
  }
  more = async () => {
    if (this.state.loading || !this.state.cursor) return
    const { cursor } = this.state; const generation = this.generation
    this.publish({ ...this.state, loading: true, error: '' })
    await this.fetch(cursor, generation, false)
  }
  private async fetch(cursor: string | undefined, generation: number, replace: boolean) {
    try {
      const page = await this.load(cursor)
      if (generation !== this.generation) return
      const byId = new Map((replace ? [] : this.state.items).map(item => [item.id, item]))
      page.results.forEach(item => byId.set(item.id, item))
      this.publish({ items: [...byId.values()], cursor: page.next_cursor, loading: false, error: '' })
    } catch (error) {
      if (generation === this.generation) this.publish({ ...this.state, loading: false, error: this.message(error) })
    }
  }
}
