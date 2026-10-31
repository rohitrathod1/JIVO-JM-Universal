import { describe,expect,it,vi } from 'vitest'
import { captureOwnedFrame } from './frameCapture'
import { dragCrop,aspectCrop } from './interaction'
import { cropPixels,defaultEdit } from './model'
describe('crop interaction math',()=>{
 it('clamps moving to image edges',()=>expect(dragCrop({...defaultEdit,width:0.5,height:0.5},'move',2,-2)).toMatchObject({x:0.5,y:0}))
 it('keeps corner resize nonempty and within bounds',()=>{const e=dragCrop(defaultEdit,'nw',2,2);expect(e.width).toBeCloseTo(.06);expect(e.height).toBeCloseTo(.06);expect(dragCrop(e,'se',5,5)).toMatchObject({width:e.width,height:e.height})})
 it('centers an aspect preset in a landscape image',()=>expect(aspectCrop(defaultEdit,1,2)).toMatchObject({x:.25,y:0,width:.5,height:1}))
 it('zoom selects the centered underlying pixels',()=>expect(cropPixels(800,600,{...defaultEdit,zoom:2})).toEqual({originX:200,originY:150,width:400,height:300}))
 it.each([0,4,NaN])('rejects unsupported zoom %s',zoom=>expect(()=>cropPixels(800,600,{...defaultEdit,zoom})).toThrow())
})
describe('owned native frame capture',()=>{
 const setup=()=>({capture:vi.fn(async()=> 'file:///mock-owned.png'),size:vi.fn(()=>10),release:vi.fn()})
 it('releases only the returned captured file once',async()=>{const io=setup();const output=await captureOwnedFrame(()=>true,io);output.dispose?.();output.dispose?.();expect(io.release).toHaveBeenCalledExactlyOnceWith('file:///mock-owned.png')})
 it('releases a late result after cancellation',async()=>{const io=setup();let active=true;io.capture.mockImplementation(async()=>{active=false;return 'file:///mock-owned.png'});await expect(captureOwnedFrame(()=>active,io)).rejects.toThrow('cancelled');expect(io.release).toHaveBeenCalledOnce()})
 it('cleans capture when metadata fails',async()=>{const io=setup();io.size.mockImplementation(()=>{throw Error('metadata')});await expect(captureOwnedFrame(()=>true,io)).rejects.toThrow('metadata');expect(io.release).toHaveBeenCalledOnce()})
 it('does not capture after cancellation',async()=>{const io=setup();await expect(captureOwnedFrame(()=>false,io)).rejects.toThrow('cancelled');expect(io.capture).not.toHaveBeenCalled()})
})
