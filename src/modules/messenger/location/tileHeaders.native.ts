import CookieManager from '@preeternal/react-native-cookie-manager'
import { origin } from '../../../core/api/client'
export async function tileHeaders(): Promise<Record<string, string> | undefined> {
  if (!origin) throw new Error('The map server is unavailable.')
  const cookie = await CookieManager.getCookieHeader(`${origin}/api/jm/maps/tiles/`)
  if (!cookie) throw new Error('Sign in again to load maps.')
  return { Cookie: cookie }
}
