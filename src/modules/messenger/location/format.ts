import type { PickedLocation } from './model'

/** Text helpers shared by the location picker and the event place field (reference LocationEvent.tsx). */
export function distanceLabel(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km) || km < 0) return ''
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('en-IN', { maximumFractionDigits: 1 })} km`
}

export function accuracyLabel(accuracy: number | null | undefined): string {
  if (accuracy === null || accuracy === undefined || !Number.isFinite(accuracy)) return 'Your device’s position'
  return `Accurate to ${Math.round(accuracy).toLocaleString('en-IN')} m`
}

/** Approximate fixes (over 1 km) get the reference's "move the map" hint. */
export const approximateFix = (accuracy: number | null | undefined) => typeof accuracy === 'number' && accuracy > 1000

/** Event place text from a picked point: "name, address" capped at the backend's 200 chars, else coordinates. */
export function eventPlaceText(place: Pick<PickedLocation, 'latitude' | 'longitude' | 'name' | 'address'>): string {
  const text = [place.name.trim(), place.address.trim()].filter(Boolean).join(', ').slice(0, 200).trim()
  return text || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`
}
