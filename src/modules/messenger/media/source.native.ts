import CookieManager from '@preeternal/react-native-cookie-manager'
import { origin } from '../../../core/api/client'
import { trustedMediaUri } from './sourcePolicy'
export interface MediaSource { uri: string; headers?: Record<string, string> }
export async function authenticatedMediaSource(uri: string): Promise<MediaSource> {
  if (!trustedMediaUri(uri, origin)) throw Error('Unsupported media address.')
  // Expo's platform media players do not use Axios/RN's HTTP adapter. Supply only the cookies
  // matching this access-checked file endpoint, in memory, for this player's lifetime.
  const cookie = await CookieManager.getCookieHeader(uri)
  if (!cookie) throw Error('Your media session is unavailable. Sign in again.')
  return { uri, headers: { Cookie: cookie } }
}
