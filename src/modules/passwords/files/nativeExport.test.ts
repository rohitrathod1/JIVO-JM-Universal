import { nativeExports,createNativeExporter } from './nativeExport'
import { afterEach, describe, expect, it, vi } from 'vitest'
const fake=vi.hoisted(()=>({paths:new Set<string>(),writes:[] as {uri:string;data:string;encoding:string}[],shares:[] as {uri:string;options:unknown}[],os:'ios'}))
vi.mock('react-native',()=>({Platform:{get OS(){return fake.os}},AppState:{addEventListener:()=>({remove(){}})}}))
vi.mock('expo-crypto',()=>({randomUUID:()=> '00000000-0000-4000-8000-000000000001'}))
vi.mock('expo-sharing',()=>({isAvailableAsync:async()=>true,shareAsync:async(uri:string,options:unknown)=>{fake.shares.push({uri,options})}}))
vi.mock('expo-file-system',()=>{
 const join=(parts:({uri:string}|string)[])=>parts.map(p=>(typeof p==='string'?p:p.uri).replace(/\/$/, '')).join('/')
 class Directory {uri:string;constructor(...parts:({uri:string}|string)[]){this.uri=join(parts)}get exists(){return fake.paths.has(this.uri)}create(){fake.paths.add(this.uri)}delete(){for(const p of [...fake.paths])if(p===this.uri||p.startsWith(this.uri+'/'))fake.paths.delete(p)}}
 class File extends Directory {write(data:string,options:{encoding:string}){fake.writes.push({uri:this.uri,data,encoding:options.encoding})}}
 return {Directory,File,Paths:{cache:{uri:'file:///private/cache'}}}
})
afterEach(()=>{vi.unstubAllGlobals();fake.paths.clear();fake.writes=[];fake.shares=[]})
describe('native adapter wiring with synthetic storage only',()=>{
 it('isolates message exports from vault and unrelated cache',async()=>{fake.os='ios';fake.paths.add('file:///private/cache/jivo-vault-exports/existing');fake.paths.add('file:///private/cache/unrelated');vi.stubGlobal('FileReader',class {result:string|null=null;onload:(()=>void)|null=null;readAsDataURL(){this.result='data:application/octet-stream;base64,TU9DSw==';this.onload?.()}});await createNativeExporter('jivo-message-exports','Export message attachment','message attachment').export(new Blob(['MOCK']),'mock.txt',()=>true);expect(fake.writes[0].uri).toContain('/jivo-message-exports/');expect(fake.shares[0].options).toEqual({dialogTitle:'Export message attachment'});expect([...fake.paths]).toEqual(['file:///private/cache/jivo-vault-exports/existing','file:///private/cache/unrelated'])})

 it.each(['ios','android'])('stages a sanitized filename and purges on %s without extra iOS type staging',async os=>{
  fake.os=os;fake.paths.add('file:///private/cache/unrelated-file')
  vi.stubGlobal('FileReader',class {result:string|null=null;onload:(()=>void)|null=null;readAsDataURL(){this.result='data:application/octet-stream;base64,TU9DSw==';this.onload?.()}})
  await nativeExports.export(new Blob(['MOCK']),'../../test.pem',()=>true)
  expect(fake.writes).toEqual([{uri:'file:///private/cache/jivo-vault-exports/00000000-0000-4000-8000-000000000001/export-test.pem',data:'TU9DSw==',encoding:'base64'}])
  expect(fake.shares).toHaveLength(1)
  expect(fake.shares[0].options).toEqual(os==='android'?{dialogTitle:'Export decrypted vault file',mimeType:'application/octet-stream'}:{dialogTitle:'Export decrypted vault file'})
  expect([...fake.paths]).toEqual(['file:///private/cache/unrelated-file'])
 })
})
