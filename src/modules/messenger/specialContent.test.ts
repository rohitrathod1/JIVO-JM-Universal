import { expect, it } from 'vitest'
import { locationLink } from './specialContent'
const location = { latitude: 28.6, longitude: 77.2, name: '', address: '', accuracy: null }
it('builds OSM coordinates without accepting injected or nonfinite values', () => {
  expect(locationLink(location)).toContain('mlat=28.6&mlon=77.2')
  for (const latitude of [NaN, Infinity, 90.0001, -90.0001]) expect(locationLink({ ...location, latitude })).toBeNull()
  for (const longitude of [NaN, Infinity, 180.0001, -180.0001]) expect(locationLink({ ...location, longitude })).toBeNull()
  expect(locationLink({ ...location, latitude: -90, longitude: 180 })).not.toBeNull()
})
