import { expect, it } from 'vitest'
import { mobileError, safeTelHref } from './phone'

it('preserves supported Indian and international profile number formats', () => {
  for (const phone of ['98100 00000', '+91 98100 00000', '919810000000', '00919810000000', '09810000000', '+44 7700 900123']) {
    expect(mobileError(phone)).toBeNull(); expect(safeTelHref(phone)).toMatch(/^tel:\+?\d+$/)
  }
  expect(safeTelHref('+91 98100 00000')).toBe('tel:+919810000000')
})
it('never invokes URI schemes or control codes embedded in a profile number', () => {
  for (const phone of ['javascript:alert(1)', 'tel:+919810000000', '*123#', '+91;9810000000', '+91,9810000000', '++919810000000', '12', '+00123456789', '', null, undefined]) expect(safeTelHref(phone)).toBeNull()
})
it('validates exact international and Indian number boundaries', () => {
  expect(safeTelHref('+12345678')).not.toBeNull()
  expect(safeTelHref('+1234567')).toBeNull()
  expect(safeTelHref('+123456789012345')).not.toBeNull()
  expect(safeTelHref('+1234567890123456')).toBeNull()
  expect(safeTelHref('5810000000')).toBeNull()
  expect(safeTelHref('6810000000')).not.toBeNull()
})
