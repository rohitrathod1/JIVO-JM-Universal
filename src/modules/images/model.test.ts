import { describe,expect,it } from 'vitest'
import { cropPixels,defaultEdit } from './model'
describe('image transformations',()=>{
 it('crops in rotated image coordinates',()=>expect(cropPixels(800,600,{...defaultEdit,rotation:90,x:0.5,width:0.5})).toEqual({originX:300,originY:0,width:300,height:800}))
 it.each([NaN,Infinity,-1,0,1.5])('rejects invalid crop size %s',width=>expect(()=>cropPixels(800,600,{...defaultEdit,width})).toThrow())
 it('bounds decoded source size and rejects invalid rotations',()=>{expect(()=>cropPixels(10000,10000,defaultEdit)).toThrow('80 megapixels');expect(()=>cropPixels(100,100,{...defaultEdit,rotation:45 as 90})).toThrow('Crop')})
 it('keeps a tiny valid crop at least one pixel',()=>expect(cropPixels(1,1,{...defaultEdit,width:0.1,height:0.1}).width).toBe(1))
})
