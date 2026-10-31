const fs=require('node:fs');let s=fs.readFileSync('src/core/api/transport.ts','utf8');s=s.replace('methods: string[]) => Promise<boolean>','methods: string[], signal?: AbortSignal) => Promise<boolean>');s=s.replace('    const body = error.response?.data',`    const raw: unknown = error.response?.data
    // Blob downloads still return JSON error bodies. Decode only bounded JSON errors, never file content.
    if (typeof Blob !== 'undefined' && raw instanceof Blob && /json/i.test(raw.type) && raw.size <= 1024 * 1024 && error.response) {
      try {
        const text = typeof raw.text === 'function' ? await raw.text() : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onerror = () => reject(Error('Cannot read API error')); reader.onload = () => resolve(String(reader.result)); reader.readAsText(raw)
        })
        error.response.data = JSON.parse(text)
      } catch { /* Preserve the original response if it is not valid JSON. */ }
    }
    const body = error.response?.data`);
s=s.replace("!config._stepUpRetried && !url.startsWith('/auth/step-up')", "!config.signal?.aborted && !config._stepUpRetried && !url.startsWith('/auth/step-up')");s=s.replace("handler(body.scope ?? 'security_settings', body.methods ?? []) && config._sessionEpoch === sessionEpoch", "handler(body.scope ?? 'security_settings', body.methods ?? [], config.signal as AbortSignal | undefined) && !config.signal?.aborted && config._sessionEpoch === sessionEpoch");fs.writeFileSync('src/core/api/transport.ts',s);
s=fs.readFileSync('src/core/api/transport.test.ts','utf8').replace("toHaveBeenCalledExactlyOnceWith('jp', ['password'])","toHaveBeenCalledExactlyOnceWith('jp', ['password'], undefined)");fs.writeFileSync('src/core/api/transport.test.ts',s);
s=fs.readFileSync('src/modules/passwords/api.ts','utf8');s=s.replace("listVaultFiles = async (vault: string) => (await api.get<VaultFiles>(`/vaults/${vault}/files/`, jp))", "listVaultFiles = async (vault: string, signal?: AbortSignal) => (await api.get<VaultFiles>(`/vaults/${vault}/files/`, { ...jp, signal }))");s=s.replace("downloadVaultFile = async (id: string)","downloadVaultFile = async (id: string, signal?: AbortSignal)").replace("responseType: 'blob', timeout: 0", "responseType: 'blob', timeout: 120000, signal");s=s.replace("previewVaultFile = async (id: string)","previewVaultFile = async (id: string, signal?: AbortSignal)").replace("`/files/${id}/preview/`, {}, jp)","`/files/${id}/preview/`, {}, { ...jp, signal })");fs.writeFileSync('src/modules/passwords/api.ts',s);
s=fs.readFileSync('src/components/StepUp.tsx','utf8');s=s.replace('resolve: (value: boolean) => void }','resolve: (value: boolean) => void; detach?: () => void }');s=s.replace('current.current?.resolve(result); next()', 'current.current?.detach?.(); current.current?.resolve(result); next()');s=s.replace('onStepUpRequired((scope, methods) => new Promise(resolve => {\n      const request = { scope, methods, resolve }',`onStepUpRequired((scope, methods, signal) => new Promise(resolve => {
      if (signal?.aborted) { resolve(false); return }
      const request: Request = { scope, methods, resolve }
      const abort = () => {
        request.detach?.(); request.resolve(false)
        if (current.current === request) next()
        else queue.current = queue.current.filter(item => item !== request)
      }
      signal?.addEventListener('abort', abort, { once: true }); request.detach = () => signal?.removeEventListener('abort', abort)`);
s=s.replace('current.current?.resolve(false); current.current = null', 'current.current?.detach?.(); current.current?.resolve(false); current.current = null').replace('pending.splice(0).forEach(r => r.resolve(false))', 'pending.splice(0).forEach(r => { r.detach?.(); r.resolve(false) })');
// Preserve the same array reference used by the account cleanup effect.
s=s.replace('else queue.current = queue.current.filter(item => item !== request)', 'else { const index = queue.current.indexOf(request); if (index >= 0) queue.current.splice(index, 1) }');fs.writeFileSync('src/components/StepUp.tsx',s);
s=fs.readFileSync('src/components/VaultFiles.tsx','utf8');s=s.replace("const [busy,setBusy] = useState(false);", "const [reading,setReading] = useState(false); const [busy,setBusy] = useState(false);");s=s.replace("id?:string) { const current=await load();", "id?:string, signal?:AbortSignal) { const current=await vault.listVaultFiles(vaultId,signal);");s=s.replace(' const can=resource.value?.can',` async function read(work:(signal:AbortSignal)=>Promise<void>) {
  const controller=new AbortController();abort.current=controller;setReading(true)
  try { await work(controller.signal) } catch(e) { if(controller.signal.aborted)throw Error('File transfer cancelled.');throw e }
  finally { if(abort.current===controller)abort.current=null;if(active.current)setReading(false) }
 }
 const cancelRead=()=>{abort.current?.abort();clear()}
 const can=resource.value?.can`);
s=s.replace('<Button title="Refresh vault files"', '{reading && <Button title="Cancel vault file transfer" onPress={cancelRead} />}\n <Button title="Refresh vault files"');
s=s.replace("onPress={()=>void run(async()=>{const generation=guard.current.begin();await fresh('download',file.id);const value=await vault.previewVaultFile(file.id);", "onPress={()=>void run(()=>read(async(signal)=>{const generation=guard.current.begin();await fresh('download',file.id,signal);const value=await vault.previewVaultFile(file.id,signal);");s=s.replace('timer.current=setTimeout(clear,duration)})}', 'timer.current=setTimeout(clear,duration)}))}');
s=s.replace("else{const blob=await vault.downloadVaultFile(action.file.id);if(!guard.current.accepts(generation))return;await saveVaultFile(blob,action.file.name,()=>guard.current.accepts(generation))}","else{await read(async(signal)=>{await fresh('download',action.file.id,signal);const blob=await vault.downloadVaultFile(action.file.id,signal);if(!guard.current.accepts(generation))return;await saveVaultFile(blob,action.file.name,()=>guard.current.accepts(generation))})}");s=s.replace('<Button title="Cancel vault file action"', '{reading && <Button title="Cancel current file download" onPress={cancelRead} />}<Button title="Cancel vault file action"');fs.writeFileSync('src/components/VaultFiles.tsx',s);
