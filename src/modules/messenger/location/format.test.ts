import { expect, it } from 'vitest'
import { accuracyLabel, approximateFix, distanceLabel, eventPlaceText } from './format'
it('labels search distances in metres below a kilometre and km above', () => {
  expect(distanceLabel(0.4321)).toBe('432 m')
  expect(distanceLabel(12.34)).toBe('12.3 km')
  expect(distanceLabel(1234.5)).toBe('1,234.5 km')
  for (const value of [undefined, null, NaN, -1]) expect(distanceLabel(value)).toBe('')
})
it('labels device accuracy and flags approximate fixes', () => {
  expect(accuracyLabel(12.4)).toBe('Accurate to 12 m')
  expect(accuracyLabel(null)).toBe('Your device’s position')
  expect(approximateFix(1500)).toBe(true); expect(approximateFix(1000)).toBe(false); expect(approximateFix(null)).toBe(false)
})
it('builds event place text within the backend limit, falling back to coordinates', () => {
  expect(eventPlaceText({ latitude: 1, longitude: 2, name: ' Office ', address: 'MG Road' })).toBe('Office, MG Road')
  expect(eventPlaceText({ latitude: 28.613912, longitude: 77.20901, name: '', address: ' ' })).toBe('28.61391, 77.20901')
  expect(eventPlaceText({ latitude: 0, longitude: 0, name: 'x'.repeat(150), address: 'y'.repeat(150) })).toHaveLength(200)
})
