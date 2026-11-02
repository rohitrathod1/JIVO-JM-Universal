import { expect, it } from 'vitest'
import { ImageZoom } from './viewer'
it('supports pinch, rebases changing fingers, and clamps pan/zoom', () => {
  const model = new ImageZoom()
  model.begin([{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }])
  expect(model.move([{ pageX: 0, pageY: 0 }, { pageX: 200, pageY: 0 }], 300, 200).scale).toBe(2)
  const previous = model.value
  expect(model.move([{ pageX: 200, pageY: 0 }], 300, 200)).toBe(previous)
  expect(model.move([{ pageX: 2000, pageY: 2000 }], 300, 200)).toEqual({ scale: 2, x: 150, y: 100 })
  expect(model.zoom(0, 300, 200)).toEqual({ scale: 1, x: 0, y: 0 })
  expect(model.zoom(20, 300, 200).scale).toBe(4)
})
