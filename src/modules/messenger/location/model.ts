export interface LatLng { latitude: number; longitude: number }
export interface PickedLocation extends LatLng { accuracy: number | null; name: string; address: string }
export const DEFAULT_CENTER: LatLng = { latitude: 28.6139, longitude: 77.209 }
export const MAX_LATITUDE = 85.05112878
export function validPoint(point: LatLng): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
}
export function validLocation(point: PickedLocation): boolean {
  return validPoint(point) && (point.accuracy === null || Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 100000) && point.name.trim().length <= 120 && point.address.trim().length <= 300
}
export function worldPoint(point: LatLng, zoom: number): { x: number; y: number } {
  const size = 256 * 2 ** zoom
  const latitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude)) * Math.PI / 180
  return { x: (point.longitude + 180) / 360 * size, y: (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * size }
}
export function pointAt(x: number, y: number, zoom: number): LatLng {
  const size = 256 * 2 ** zoom; const wrapped = (x % size + size) % size
  return { longitude: wrapped / size * 360 - 180, latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.max(0, Math.min(size, y)) / size))) * 180 / Math.PI }
}
export interface MapTile { key: string; x: number; y: number; left: number; top: number; zoom: number }
export function mapTiles(center: LatLng, zoom: number, width: number, height: number): MapTile[] {
  if (!validPoint(center) || !Number.isInteger(zoom) || zoom < 0 || zoom > 19 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
  const c = worldPoint(center, zoom); const left = c.x - width / 2; const top = c.y - height / 2; const count = 2 ** zoom; const tiles: MapTile[] = []
  for (let x = Math.floor(left / 256); x <= Math.floor((left + Math.min(width, 2000)) / 256); x++) {
    for (let y = Math.floor(top / 256); y <= Math.floor((top + Math.min(height, 2000)) / 256); y++) {
      if (y < 0 || y >= count) continue
      tiles.push({ key: `${zoom}:${x}:${y}`, zoom, x: (x % count + count) % count, y, left: x * 256 - left, top: y * 256 - top })
    }
  }
  return tiles
}
export function mapsUrl(point: LatLng): string | null {
  return validPoint(point) ? `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}` : null
}
