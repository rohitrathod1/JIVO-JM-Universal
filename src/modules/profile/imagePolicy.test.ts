import { describe, expect, it } from 'vitest'
import { validateProfileImage } from './imagePolicy'
const asset={name:'synthetic.png',mime:'image/png',size:20,uri:'mock://synthetic'}
describe('profile image policy',()=>{
 it('allows supported bounded images',()=>expect(()=>validateProfileImage(asset,'avatar')).not.toThrow())
 it.each(['text/html','image/svg+xml','application/octet-stream'])('rejects unsupported MIME %s',mime=>expect(()=>validateProfileImage({...asset,mime},'avatar')).toThrow('JPEG'))
 it.each([NaN,Infinity,-1,0,17*1024*1024])('rejects invalid or oversized photo size %s',size=>expect(()=>validateProfileImage({...asset,size},'avatar')).toThrow('16 MB'))
 it('uses the stricter original 8 MB background limit',()=>expect(()=>validateProfileImage({...asset,size:9*1024*1024},'background')).toThrow('8 MB'))
})
