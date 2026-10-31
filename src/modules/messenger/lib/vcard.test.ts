import { describe, expect, it } from 'vitest'

import { buildVCard, isVCard, parseVCard, vcardFile } from './vcard'

describe('vCard', () => {
  it('round-trips a contact, escaping separators', () => {
    const c = { name: 'Suresh, Plumber; Plant 2', phones: ['+91 99999 00000', ''], emails: ['s@x.test'] }
    const text = buildVCard(c)
    expect(text.startsWith('BEGIN:VCARD\r\n')).toBe(true)
    expect(parseVCard(text)).toEqual({ name: 'Suresh, Plumber; Plant 2', phones: ['+91 99999 00000'], emails: ['s@x.test'] })
  })

  it('reads cards from phones (folded lines, item prefixes, no FN)', () => {
    const text = 'BEGIN:VCARD\nVERSION:3.0\nN:Kumar;Ravi;;;\nitem1.TEL;type=CELL:+91 1\n 2345\nEMAIL;TYPE=INTERNET:r@x.test\nEND:VCARD\n'
    expect(parseVCard(text)).toEqual({ name: 'Ravi Kumar', phones: ['+91 12345'], emails: ['r@x.test'] })
  })

  it('treats values as text and names the file safely', () => {
    expect(parseVCard('BEGIN:VCARD\nFN:<img src=x onerror=alert(1)>\nEND:VCARD').name).toBe('<img src=x onerror=alert(1)>')
    const f = vcardFile({ name: 'A/B:C', phones: ['1'], emails: [] })
    expect(f.name).toBe('A B C.vcf')
    expect(f.type).toBe('text/vcard')
    expect(isVCard({ mime: 'text/vcard', name: 'x' }) && isVCard({ mime: '', name: 'Y.VCF' })).toBe(true)
  })
})
