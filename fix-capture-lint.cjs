const fs=require('fs');function edit(p,a,b){let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p);fs.writeFileSync(p,s.replace(a,b))}
edit('src/core/auth/Session.tsx','useEffect, useRef, useState,','useEffect, useState,');edit('src/core/auth/Session.tsx','const external=useRef(false)','const [external]=useState(()=>({active:false}))');const p='src/core/auth/Session.tsx';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('external.current','external.active').replace('),[controller])', '),[controller,external])'))
edit('src/components/InstallApp.web.tsx','[installed,setInstalled]=useState(false)',"[installed,setInstalled]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(display-mode: standalone)').matches)")
edit('src/components/InstallApp.web.tsx',"useEffect(()=>{setInstalled(window.matchMedia('(display-mode: standalone)').matches);","useEffect(()=>{")
edit('src/modules/messenger/media/voice.ts','const recorder=new AudioModule.AudioRecorder','const { AudioRecorder: Recorder }=AudioModule;const recorder=new Recorder')
edit('src/modules/messenger/outboxStorage.web.ts','OutboxStorage, PendingSend','OutboxStorage')
