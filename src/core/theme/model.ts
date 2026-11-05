export type ThemeChoice = 'light' | 'dark' | 'system'
export interface ThemeStorage {
  read(): Promise<string | null>
  write(choice: ThemeChoice): Promise<void>
  subscribe?(listener: (value: string | null) => void): () => void
}
export interface ThemeState { choice: ThemeChoice; ready: boolean; notice: string | null }
export const initialTheme: ThemeState = { choice: 'system', ready: false, notice: null }
export const parseTheme = (value: unknown): ThemeChoice => value === 'light' || value === 'dark' ? value : 'system'
export const isDarkTheme = (choice: ThemeChoice, system: 'light' | 'dark') => choice === 'dark' || choice === 'system' && system === 'dark'

/** Device preference, deliberately independent of the signed-in account and its cached content. */
export class ThemeController {
  private state: ThemeState = initialTheme
  private listeners = new Set<() => void>()
  private revision = 0
  private initialized: Promise<void> | null = null
  private writes: Promise<void> = Promise.resolve()
  constructor(private readonly storage: ThemeStorage) {}
  snapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(next: ThemeState) { this.state = next; this.listeners.forEach(listener => listener()) }
  initialize = (): Promise<void> => {
    if (this.initialized) return this.initialized
    const revision = this.revision
    this.initialized = this.storage.read().then(value => {
      if (revision === this.revision) this.publish({ choice: parseTheme(value), ready: true, notice: null })
    }).catch(() => {
      if (revision === this.revision) this.publish({ ...this.state, ready: true, notice: 'Your saved theme could not be read. You can choose it again.' })
    })
    return this.initialized
  }
  listen = () => this.storage.subscribe?.(value => {
    this.revision++
    this.publish({ choice: parseTheme(value), ready: true, notice: null })
  }) ?? (() => {})
  set = (choice: ThemeChoice): Promise<void> => {
    const revision = ++this.revision
    this.publish({ choice, ready: true, notice: null })
    this.writes = this.writes.catch(() => {}).then(() => this.storage.write(choice)).catch(() => {
      if (revision === this.revision) this.publish({ ...this.state, notice: 'This theme is active now, but could not be saved on this device.' })
    })
    return this.writes
  }
}
