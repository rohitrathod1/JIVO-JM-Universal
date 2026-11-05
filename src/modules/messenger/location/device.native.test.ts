import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { currentLocation } from './device.native'
const location = vi.hoisted(() => ({ requestForegroundPermissionsAsync: vi.fn(), getCurrentPositionAsync: vi.fn(), Accuracy: { High: 4 } }))
vi.mock('expo-location', () => location)
beforeEach(() => { vi.clearAllMocks(); location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true }) })
afterEach(() => vi.useRealTimers())
it('asks only foreground permission and returns the current fix with accuracy', async () => {
  location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 28.6, longitude: 77.2, accuracy: 18.4 } })
  expect(await currentLocation()).toEqual({ latitude: 28.6, longitude: 77.2, accuracy: 18, name: '', address: '' })
  expect(location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 })
})
it('does not access location after permission refusal', async () => {
  location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false })
  await expect(currentLocation()).rejects.toThrow('Location access is blocked')
  expect(location.getCurrentPositionAsync).not.toHaveBeenCalled()
})
it('times out a device that cannot obtain a fix', async () => {
  vi.useFakeTimers(); location.getCurrentPositionAsync.mockImplementation(() => new Promise(() => {}))
  const attempt = expect(currentLocation()).rejects.toThrow('could not be found')
  await vi.advanceTimersByTimeAsync(15000); await attempt
})
