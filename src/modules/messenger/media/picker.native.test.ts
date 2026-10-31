import { pickDocument } from './picker.native'
import { beforeEach,describe,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({pick:vi.fn(),copy:vi.fn(),deleted:vi.fn(),created:new Set<string>(),serial:0}))
vi.mock('expo-document-picker',()=>({getDocumentAsync:mocks.pick}))
vi.mock('expo-crypto',()=>({randomUUID:()=>String(++mocks.serial)}))
vi.mock('expo-file-system',()=>({Paths:{cache:{uri:'file:///mock-cache/'}},Directory:class{uri:string;constructor(base:{uri:string},name:string){this.uri=base.uri+name+'/'}create(){mocks.created.add(this.uri)}get exists(){return mocks.created.has(this.uri)}delete(){mocks.deleted(this.uri);mocks.created.delete(this.uri)}},File:class{uri:string;size=42;constructor(base:string|{uri:string},name?:string){this.uri=typeof base==='string'?base:base.uri+(name??'')}copy(to:{uri:string}){mocks.copy(this.uri,to.uri)}}}))
beforeEach(()=>{vi.clearAllMocks();mocks.created.clear();mocks.pick.mockResolvedValue({canceled:false,assets:[{name:'../private.txt',size:42,uri:'content://selected-provider/file',mimeType:'text/plain'}]})})
describe('owned native picker copy',()=>{
 it('copies only the selected local asset into its own directory and cleans it idempotently',async()=>{const file=await pickDocument();expect(mocks.pick).toHaveBeenCalledWith(expect.objectContaining({copyToCacheDirectory:false}));expect(mocks.copy).toHaveBeenCalledWith('content://selected-provider/file',expect.stringMatching(/^file:\/\/\/mock-cache\/jivo-picker-\d+\/selected.txt$/));file!.dispose!();file!.dispose!();expect(mocks.deleted).toHaveBeenCalledTimes(1);expect(mocks.deleted.mock.calls[0][0]).not.toContain('content:')})
 it('removes only its newly owned directory when copying fails',async()=>{mocks.copy.mockImplementationOnce(()=>{throw Error('copy failed')});await expect(pickDocument()).rejects.toThrow('copy failed');expect(mocks.deleted).toHaveBeenCalledOnce()})
 it('does not create or remove files for cancellation or missing metadata',async()=>{mocks.pick.mockResolvedValueOnce({canceled:true});expect(await pickDocument()).toBeNull();mocks.pick.mockResolvedValueOnce({canceled:false,assets:[{name:'x',uri:'content://x'}]});await expect(pickDocument()).rejects.toThrow('valid file size');expect(mocks.created.size).toBe(0);expect(mocks.deleted).not.toHaveBeenCalled()})
})
