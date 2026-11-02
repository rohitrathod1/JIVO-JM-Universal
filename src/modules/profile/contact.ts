/** A mailto: link for a plain address only (no extra headers, line breaks or other URI schemes). */
export function safeMailHref(email: string | null | undefined): string | null {
  const value = (email ?? '').trim()
  return /^[^\s@?&#<>"/\\:]+@[^\s@?&#<>"/\\:]+\.[^\s@?&#<>"/\\:]+$/.test(value) ? `mailto:${value}` : null
}
