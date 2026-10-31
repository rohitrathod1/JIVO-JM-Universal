import { beforeEach,describe,expect,it,vi } from 'vitest'
import { editImage } from './edit'
import { defaultEdit } from './model'
const fake=vi.hoisted(()=>({deleted:vi.fn(),release:vi.fn(),metadataFails:false,uri:'file:///mock-cache/edited.png'}))
vi.mock('expo-image-manipulator',()=>({SaveFormat:{PNG:'png'},ImageManipulator:{manipulate:()=>{const context={reset:()=>context,rotate:()=>context,flip:()=>context,crop:()=>context,resize:()=>context,release:fake.release,renderAsync:async()=>({width:100,height:80,release:fake.release,saveAsync:async()=>({uri:fake.uri})})};return context}}}))
vi.mock('expo-file-system',()=>({Paths:{cache:{uri:'file:///mock-cache/'}},File:class{exists=true;get size(){if(fake.metadataFails)throw Error('metadata failed');return 100}delete(){fake.deleted()}}}))
const input={name:'input.png',mime:'image/png',uri:'content://selected/image',size:100}
beforeEach(()=>{vi.clearAllMocks();fake.metadataFails=false;fake.uri='file:///mock-cache/edited.png'})
describe('native image output ownership',()=>{
 it('releases native image handles and returns cleanup for its output',async()=>{const output=await editImage(input,defaultEdit);expect(fake.release).toHaveBeenCalledTimes(3);expect(fake.deleted).not.toHaveBeenCalled();output.dispose?.();expect(fake.deleted).toHaveBeenCalledOnce()})
 it('cleans newly saved output if metadata fails',async()=>{fake.metadataFails=true;await expect(editImage(input,defaultEdit)).rejects.toThrow('metadata failed');expect(fake.deleted).toHaveBeenCalledOnce();expect(fake.release).toHaveBeenCalledTimes(3)})
 it('does not delete a non-cache location',async()=>{fake.uri='file:///documents/user-photo.png';fake.metadataFails=true;await expect(editImage(input,defaultEdit)).rejects.toThrow('Unexpected editor output location');expect(fake.deleted).not.toHaveBeenCalled()})
 it('rejects native frame effects before allocating native handles',async()=>{await expect(editImage(input,{...defaultEdit,frame:'circle'})).rejects.toThrow('native frame renderer');expect(fake.release).not.toHaveBeenCalled()})
})
