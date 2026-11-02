/**
 * Mobile numbers people can be called on (the same rules as the server, identity/phones.py): an Indian mobile
 * (10 digits starting 6–9, with or without +91 / 91 / 0091 / 0) or an international number with its country code.
 * Returns the reason a number cannot be used, or null.
 */
export function mobileError(value: string): string | null {
  const raw = value.trim().replace(/[()]/g, '')
  if (!raw) return 'Add your mobile number.'
  if (!/^\+?[\d\s\-.]+$/.test(raw)) return 'Use digits only, with + for the country code.'
  let plus = raw.startsWith('+')
  let digits = raw.replace(/\D/g, '')
  if (!plus && digits.startsWith('00')) {
    digits = digits.slice(2)
    plus = true
  }
  if (plus && digits.startsWith('91')) {
    digits = digits.slice(2)
    plus = false
  } else if (!plus && digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (!plus && digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (!plus) return /^[6-9]\d{9}$/.test(digits) ? null : 'Enter a 10-digit mobile number (it starts with 6, 7, 8 or 9).'
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0') ? null : 'Enter the number with its country code, e.g. +44 7700 900123.'
}

/** A tel: link for a stored number ("+91 98100 00000" → "tel:+919810000000"). */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** Validate stored numbers before invoking an external app; never accept control codes or another URI. */
export function safeTelHref(phone: string | null | undefined): string | null {
  return phone && mobileError(phone) === null ? telHref(phone) : null
}
