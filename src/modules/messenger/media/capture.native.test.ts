import { beforeEach,describe,expect,it,vi } from 'vitest'
import { capturePhoto,pickPhoneContact } from './capture'
const mock=vi.hoisted(()=>({cameraPermission:vi.fn(),contactPermission:vi.fn(),camera:vi.fn(),picker:vi.fn(),details:vi.fn(),deleted:vi.fn()}))
vi.mock('expo-contacts',()=>({requestPermissionsAsync:mock.contactPermission,Contact:{presentPicker:mock.picker},ContactField:{FULL_NAME:'name',PHONES:'phones',EMAILS:'emails'}}))
vi.mock('expo-image-picker',()=>({requestCameraPermissionsAsync:mock.cameraPermission,launchCameraAsync:mock.camera}))
vi.mock('expo-crypto',()=>({randomUUID:()=> 'mock'}))
vi.mock('expo-file-system',()=>({Paths:{cache:{uri:'file:///cache/'}},File:class{size=10;exists=true;delete(){mock.deleted()}}}))
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve}}
beforeEach(()=>{vi.clearAllMocks();mock.cameraPermission.mockResolvedValue({granted:true});mock.contactPermission.mockResolvedValue({granted:true});mock.camera.mockResolvedValue({canceled:false,assets:[{uri:'file:///cache/owned.jpg'}]});mock.picker.mockResolvedValue({getDetails:mock.details});mock.details.mockResolvedValue({fullName:'Synthetic',phones:[],emails:[]})})
describe('native capture validity across every await',()=>{
 it.each(['camera','contact'])('does not open %s after a deferred permission completes following cancellation',async kind=>{let active=true;const permission=deferred<{granted:boolean}>();(kind==='camera'?mock.cameraPermission:mock.contactPermission).mockReturnValue(permission.promise);const result=kind==='camera'?capturePhoto(()=>active):pickPhoneContact(()=>active);active=false;permission.resolve({granted:true});expect(await result).toBeNull();expect(mock.camera).not.toHaveBeenCalled();expect(mock.picker).not.toHaveBeenCalled()})
 it('does not read contact details after picker returns to an invalidated view',async()=>{let active=true;const selected=deferred<unknown>();mock.picker.mockReturnValue(selected.promise);const result=pickPhoneContact(()=>active);await vi.waitFor(()=>expect(mock.picker).toHaveBeenCalled());active=false;selected.resolve({getDetails:mock.details});expect(await result).toBeNull();expect(mock.details).not.toHaveBeenCalled()})
 it('discards late contact details',async()=>{let active=true;const detail=deferred<unknown>();mock.details.mockReturnValue(detail.promise);const result=pickPhoneContact(()=>active);await vi.waitFor(()=>expect(mock.details).toHaveBeenCalled());active=false;detail.resolve({fullName:'Synthetic',phones:[],emails:[]});expect(await result).toBeNull()})
 it('cleans a late camera file without returning it',async()=>{let active=true;mock.camera.mockImplementation(async()=>{active=false;return{canceled:false,assets:[{uri:'file:///cache/owned.jpg'}]}});expect(await capturePhoto(()=>active)).toBeNull();expect(mock.deleted).toHaveBeenCalledOnce()})
 it('never requests permission from an already invalid view',async()=>{expect(await capturePhoto(()=>false)).toBeNull();expect(await pickPhoneContact(()=>false)).toBeNull();expect(mock.cameraPermission).not.toHaveBeenCalled();expect(mock.contactPermission).not.toHaveBeenCalled()})
})
