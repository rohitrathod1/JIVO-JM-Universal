import CookieManager from '@preeternal/react-native-cookie-manager'
export async function csrfCookie(url: string): Promise<string | undefined> {
  // Networking owns the session cookie. Only the CSRF value is read, never logged or persisted.
  const cookies = await CookieManager.get(url)
  return cookies.jm_csrftoken?.value
}
export async function clearNativeCookies(url: string) {
  const cookies = await CookieManager.get(url)
  await Promise.all(Object.keys(cookies).map(name => CookieManager.clearByName(url, name)))
}
