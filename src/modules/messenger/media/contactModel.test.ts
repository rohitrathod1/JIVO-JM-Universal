import { describe,expect,it } from 'vitest'
import { buildVCard,parseVCard } from './contactModel'
describe('selected vCard data',()=>{
 it('round trips only bounded selected contact fields and prevents line injection',()=>{const text=buildVCard({name:'Example\r\nINJECT:bad',phones:['+123'],emails:['test@example.invalid']});expect(text).not.toContain('\r\nINJECT:');expect(parseVCard(text)).toEqual({name:'Example INJECT:bad',phones:['+123'],emails:['test@example.invalid']})})
 it('bounds imports and output cardinality',()=>{expect(()=>parseVCard('x'.repeat(65537))).toThrow('64 KB');expect(()=>parseVCard('not a contact')).toThrow('vCard');expect(parseVCard(buildVCard({name:'A',phones:Array(20).fill('123'),emails:[]})).phones).toHaveLength(5)})
})
