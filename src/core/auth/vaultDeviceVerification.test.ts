import { verifyVaultDevice } from './vaultDeviceVerification'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ hardware: vi.fn(), enrolled: vi.fn(), authenticate: vi.fn(), cancel: vi.fn() }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('expo-local-authentication', () => ({ hasHardwareAsync: mocks.hardware, isEnrolledAsync: mocks.enrolled, authenticateAsync: mocks.authenticate, cancelAuthenticate: mocks.cancel }))
beforeEach(() => { vi.resetAllMocks(); mocks.hardware.mockResolvedValue(true); mocks.enrolled.mockResolvedValue(true); mocks.authenticate.mockResolvedValue({ success: true }); mocks.cancel.mockResolvedValue(undefined) })
describe('vault device verification', () => {
 it('requests strong biometrics and leaves password fallback to the app', async () => {
  expect(await verifyVaultDevice(new AbortController().signal)).toBe(true)
  expect(mocks.authenticate).toHaveBeenCalledWith(expect.objectContaining({ biometricsSecurityLevel: 'strong', disableDeviceFallback: true, cancelLabel: 'Use password' }))
 })
 it.each(['user_cancel', 'authentication_failed', 'lockout'])('uses the password path after %s', async error => {
  mocks.authenticate.mockResolvedValue({ success: false, error })
  expect(await verifyVaultDevice(new AbortController().signal)).toBe(false)
 })
 it('uses the password path when no biometrics are enrolled', async () => {
  mocks.enrolled.mockResolvedValue(false)
  expect(await verifyVaultDevice(new AbortController().signal)).toBe(false)
  expect(mocks.authenticate).not.toHaveBeenCalled()
 })
 it('does not open the prompt after cancellation during hardware lookup', async () => {
  const abort = new AbortController()
  mocks.hardware.mockImplementation(async () => { abort.abort(); return true })
  await expect(verifyVaultDevice(abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.authenticate).not.toHaveBeenCalled()
 })
 it('rejects late biometric success after account/unmount cancellation', async () => {
  const abort = new AbortController()
  mocks.authenticate.mockImplementation(async () => { abort.abort(); return { success: true } })
  await expect(verifyVaultDevice(abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.cancel).toHaveBeenCalledOnce()
 })
})
