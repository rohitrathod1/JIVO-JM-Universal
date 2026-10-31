import { Platform } from 'react-native'
import { csrfCookie } from './cookies'
import { sessionLost } from './events'
import { createTransport } from './transport'
export const origin = (process.env.EXPO_PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '')
export const { api, onStepUpRequired, advanceSession } = createTransport({ origin, native: Platform.OS !== 'web', csrf: csrfCookie, lost: sessionLost })
export { onSessionLost } from './events'
export { errorMessage } from './transport'

