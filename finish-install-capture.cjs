const fs=require('fs');function edit(p,a,b){let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p);fs.writeFileSync(p,s.replace(a,b))}
edit('src/components/ProfilePanel.tsx',"import { ProfileImages }", "import { InstallApp } from './InstallApp'\nimport { ProfileImages }")
edit('src/components/ProfilePanel.tsx','<ProfileImages key={me?.id} />','<ProfileImages key={me?.id} /><InstallApp />')
edit('src/modules/messenger/media/voiceController.ts',"if(this.state.phase!=='idle')return","if(this.state.phase!=='idle'||this.port)return")
edit('src/components/CapturePanel.tsx','setAsset(null);setContact(null)};','setAsset(null);setContact(null);setBusy(false)};')
edit('src/components/CapturePanel.tsx','onPress={()=>void voice.start()}','onPress={()=>void voice.start().catch(e=>setError(errorMessage(e)))}')
edit('src/components/CapturePanel.tsx','onPress={()=>void voice.stop()}','onPress={()=>void voice.stop().catch(e=>setError(errorMessage(e)))}')
