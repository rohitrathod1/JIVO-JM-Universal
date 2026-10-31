const {spawn}=require('node:child_process');const net=require('node:net');const fs=require('node:fs');
(async()=>{
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));fs.writeFileSync('.local-ui-port',String(port));
 const child=spawn(process.execPath,[require.resolve('expo/bin/cli'),'start','--web','--localhost','--port',String(port)],{env:{...process.env,EXPO_PUBLIC_API_ORIGIN:`http://localhost:${port}`,BROWSER:'none',EXPO_NO_TELEMETRY:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));
 try{let ready=false;for(let n=0;n<90;n++){if(child.exitCode!==null)throw Error('Dev server exited '+child.exitCode);try{const s=await fetch(`http://localhost:${port}/status`);if(s.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}if(!ready)throw Error('Dev server startup timeout');console.log('Dev server ready',port);
 for(const script of (process.env.JM_TEST_ONLY==='cross-tab'?['cross-tab-ui.cjs']:['mocked-ui.cjs','cross-tab-ui.cjs'])){const test=spawn(process.execPath,[script],{stdio:'inherit',windowsHide:true});process.exitCode=await new Promise(r=>test.on('exit',r));if(process.exitCode)break}
 }finally{child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

