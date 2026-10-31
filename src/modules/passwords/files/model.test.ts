import { describe, expect, it } from 'vitest'
import { previewDuration, validateVaultFile } from './model'
describe('vault file boundaries',()=>{
 it('accepts a non-empty file at the server limit',()=>expect(()=>validateVaultFile('example.pem',10,10)).not.toThrow())
 it.each([0,-1,NaN,Infinity,11])('rejects invalid or excessive size %s',size=>expect(()=>validateVaultFile('example.pem',size,10)).toThrow())
 it('fails closed without a valid server limit',()=>expect(()=>validateVaultFile('example.pem',1,0)).toThrow())
 it('rejects header control characters',()=>expect(()=>validateVaultFile('x\r\ny',1,10)).toThrow())
 it('honors short server expiry and caps long previews',()=>{expect(previewDuration(1)).toBe(1000);expect(previewDuration(120)).toBe(60000)})
 it.each([0,-1,NaN,Infinity])('does not reveal invalid expiry %s',seconds=>expect(previewDuration(seconds)).toBe(0))
})
