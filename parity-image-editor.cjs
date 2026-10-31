const fs=require('fs');function edit(p,a,b){let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p+' '+a);fs.writeFileSync(p,s.replace(a,b))}
edit('src/modules/messenger/media/model.ts','file?: File }','file?: File; dispose?: () => void | Promise<void> }')
edit('src/components/ProfileImages.tsx',"import { useEffect", "import { PhotoEditor } from './PhotoEditor'\nimport { useEffect")
edit('src/components/ProfileImages.tsx',"const {me,adopt}=useSession();", "const [editing,setEditing]=useState(false);const edited=useRef<PickedFile|null>(null);\n const {me,adopt}=useSession();")
edit('src/components/ProfileImages.tsx','return()=>{mounted.current=false;','return()=>{void edited.current?.dispose?.();mounted.current=false;')
edit('src/components/ProfileImages.tsx','<Button title="Confirm image change"','{review===\'photo\'&&file&&<Button title="Edit selected image" disabled={busy} onPress={()=>setEditing(true)}/>}<Button title="Confirm image change"')
edit('src/components/ProfileImages.tsx','</>}</Card>','</>}{editing&&file&&<PhotoEditor asset={file.asset} onClose={()=>setEditing(false)} onApply={asset=>{void edited.current?.dispose?.();edited.current=asset;setFile({...file,asset});setEditing(false)}}/>}</Card>')
// Original photo bound is 16 MB; attachment photo policy remains 10 MB.
edit('src/modules/profile/imagePolicy.ts',"purpose==='avatar'?10:8","purpose==='avatar'?16:8");edit('src/modules/profile/imagePolicy.ts',"purpose==='avatar'?10:8","purpose==='avatar'?16:8")
edit('src/modules/messenger/media/upload.ts','const error = uploadLimitError(asset);','const error = purpose === \'attachment\' ? uploadLimitError(asset) : null;')
edit('src/components/ProfileImages.tsx','up to 10 MB','up to 16 MB')
edit('src/modules/profile/imagePolicy.test.ts','11*1024*1024','17*1024*1024');edit('src/modules/profile/imagePolicy.test.ts',"toThrow('10 MB')","toThrow('16 MB')")
console.log('Image editor and profile integration written')
