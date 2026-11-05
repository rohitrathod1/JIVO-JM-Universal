import type { LocationData } from './api'
/** Only finite coordinates enter an external map URL. */
export function locationLink(location: LocationData): string | null {
  const { latitude, longitude } = location
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
}
export const eventAnswers = [
  { value: 'going', label: 'Going' }, { value: 'maybe', label: 'Maybe' }, { value: 'not_going', label: "Can't go" },
] as const
