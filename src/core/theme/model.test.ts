import { expect, it, vi } from 'vitest'
import { isDarkTheme, parseTheme, ThemeController, type ThemeChoice } from './model'

it('uses system until a valid saved choice is restored', async () => {
  const theme = new ThemeController({ read: async () => 'dark', write: async () => {} })
  expect(theme.snapshot()).toMatchObject({ choice: 'system', ready: false })
  await theme.initialize()
  expect(theme.snapshot()).toEqual({ choice: 'dark', ready: true, notice: null })
  expect(['', null, 'other', {}, 'LIGHT'].map(parseTheme)).toEqual(Array(5).fill('system'))
})
it('follows system changes only when system is selected', () => {
  expect(isDarkTheme('system', 'dark')).toBe(true)
  expect(isDarkTheme('system', 'light')).toBe(false)
  expect(isDarkTheme('light', 'dark')).toBe(false)
  expect(isDarkTheme('dark', 'light')).toBe(true)
})
it('does not let delayed restoration replace a newer user choice', async () => {
  let restore!: (value: string) => void
  const theme = new ThemeController({ read: () => new Promise(resolve => { restore = resolve }), write: async () => {} })
  const initial = theme.initialize()
  await theme.set('light'); restore('dark'); await initial
  expect(theme.snapshot()).toEqual({ choice: 'light', ready: true, notice: null })
})
it('serializes rapid changes so restart restores the latest preference', async () => {
  let saved: ThemeChoice = 'system'; let release!: () => void
  const theme = new ThemeController({ read: async () => saved, write: async choice => { if (choice === 'dark') await new Promise<void>(resolve => { release = resolve }); saved = choice } })
  const first = theme.set('dark'); const second = theme.set('light')
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  expect(theme.snapshot().choice).toBe('light'); release(); await Promise.all([first, second])
  expect(saved).toBe('light')
})
it('keeps the selected theme usable when persistence is blocked and reports the limitation', async () => {
  const theme = new ThemeController({ read: async () => { throw Error('blocked') }, write: async () => { throw Error('full') } })
  await theme.initialize(); expect(theme.snapshot().ready).toBe(true)
  await theme.set('dark')
  expect(theme.snapshot().choice).toBe('dark'); expect(theme.snapshot().notice).toContain('could not be saved')
})
it('does not show an obsolete write failure after a newer choice succeeds', async () => {
  const theme = new ThemeController({ read: async () => null, write: async choice => { if (choice === 'dark') throw Error('full') } })
  await Promise.all([theme.set('dark'), theme.set('light')])
  expect(theme.snapshot()).toEqual({ choice: 'light', ready: true, notice: null })
})
it('adopts changes from another window and removes the listener on unmount', () => {
  let changed!: (value: string | null) => void; const unsubscribe = vi.fn()
  const theme = new ThemeController({ read: async () => null, write: async () => {}, subscribe: listener => { changed = listener; return unsubscribe } })
  const stop = theme.listen(); changed('dark'); expect(theme.snapshot().choice).toBe('dark')
  changed(null); expect(theme.snapshot().choice).toBe('system')
  stop(); expect(unsubscribe).toHaveBeenCalledOnce()
})
it('notifies mounted consumers and tolerates an unsubscribed consumer', async () => {
  const theme = new ThemeController({ read: async () => null, write: async () => {} }); const changed = vi.fn()
  const stop = theme.subscribe(changed); await theme.set('dark'); expect(changed).toHaveBeenCalledOnce()
  stop(); await theme.set('system'); expect(changed).toHaveBeenCalledOnce()
})
