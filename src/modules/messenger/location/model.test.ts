import { expect, it } from 'vitest'
import { mapTiles, mapsUrl, pointAt, validLocation, worldPoint } from './model'
it('projects points and reverses them without changing the selected map location', () => {
  for (const point of [{ latitude: 28.6139, longitude: 77.209 }, { latitude: -80, longitude: -179.9 }, { latitude: 0, longitude: 0 }]) {
    const world = worldPoint(point, 16); const result = pointAt(world.x, world.y, 16)
    expect(result.latitude).toBeCloseTo(point.latitude, 8); expect(result.longitude).toBeCloseTo(point.longitude, 8)
  }
})
it('wraps date-line tiles and bounds requests to valid server indices', () => {
  const tiles = mapTiles({ latitude: 85, longitude: 179.99 }, 3, 500, 300)
  expect(tiles.length).toBeGreaterThan(0)
  expect(tiles.every(tile => tile.x >= 0 && tile.x < 8 && tile.y >= 0 && tile.y < 8)).toBe(true)
  expect(mapTiles({ latitude: NaN, longitude: 1 }, 16, 320, 200)).toEqual([])
  expect(mapTiles({ latitude: 20, longitude: 1 }, 20, 320, 200)).toEqual([])
})
it('validates finite coordinate, accuracy and text limits before sharing', () => {
  const point = { latitude: 90, longitude: 180, accuracy: null, name: '', address: '' }
  expect(validLocation(point)).toBe(true)
  for (const patch of [{ latitude: 90.0001 }, { longitude: Infinity }, { accuracy: -1 }, { accuracy: NaN }, { name: 'x'.repeat(121) }, { address: 'x'.repeat(301) }]) expect(validLocation({ ...point, ...patch })).toBe(false)
  expect(mapsUrl({ latitude: 1.5, longitude: -2.25 })).toBe('https://www.google.com/maps/search/?api=1&query=1.5,-2.25')
  expect(mapsUrl({ latitude: NaN, longitude: 0 })).toBeNull()
})
