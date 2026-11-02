import * as Location from 'expo-location'
import type { PickedLocation } from './model'
export async function currentLocation(): Promise<PickedLocation> {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (!permission.granted) throw new Error('Location access is blocked. Allow it in device settings, or search for a place.')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Your location could not be found. Search for a place instead.')), 15000) }),
    ])
    return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy === null ? null : Math.round(position.coords.accuracy), name: '', address: '' }
  } finally { clearTimeout(timer) }
}
