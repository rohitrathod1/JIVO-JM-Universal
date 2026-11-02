import type { PickedLocation } from './model'
export async function currentLocation(): Promise<PickedLocation> {
  throw new Error('Location is unavailable on this device. Search for a place instead.')
}
