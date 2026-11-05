import type { PickedLocation } from './model'
export function currentLocation(): Promise<PickedLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This browser cannot share your location. Search for a place instead.')); return }
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy) || null, name: '', address: '' }),
      error => reject(new Error(error.code === 1 ? 'Location access is blocked. Allow it in site settings, or search for a place.' : 'Your location could not be found. Search for a place instead.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 })
  })
}
