const {spawn}=require('node:child_process');const net=require('node:net');const fs=require('node:fs');
(async()=>{
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));fs.writeFileSync('.local-ui-port',String(port));
 const child=spawn(process.execPath,[require.resolve('expo/bin/cli'),'start','--web','--localhost','--port',String(port),'--max-workers','2'],{env:{...process.env,EXPO_PUBLIC_API_ORIGIN:`http://localhost:${port}`,BROWSER:'none',EXPO_NO_TELEMETRY:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));
 try{let ready=false;const limit=Math.max(30,Number(process.env.JM_DEV_SERVER_TIMEOUT_S)||300);for(let n=0;n<limit;n++){if(child.exitCode!==null)throw Error('Dev server exited '+child.exitCode);try{const s=await fetch(`http://localhost:${port}/status`,{signal:AbortSignal.timeout(5000)});if(s.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}if(!ready)throw Error('Dev server startup timeout');console.log('Dev server ready',port);
 // Warm the web bundle once so the first page.goto (30 s limit) does not pay for the cold Metro build.
 try{const html=await(await fetch(`http://localhost:${port}/login`,{signal:AbortSignal.timeout(600000)})).text();for(const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)){const t=Date.now();await(await fetch(new URL(m[1],`http://localhost:${port}/`),{signal:AbortSignal.timeout(600000)})).arrayBuffer();console.log('Warmed',m[1].slice(0,60),Date.now()-t,'ms')}}catch(e){console.warn('Bundle warm-up failed',e.message)}
 for(const script of (process.env.JM_TEST_ONLY==='cross-tab'?['cross-tab-ui.cjs']:['mocked-ui.cjs','cross-tab-ui.cjs'])){const test=spawn(process.execPath,[script],{stdio:'inherit',windowsHide:true});process.exitCode=await new Promise(r=>test.on('exit',r));if(process.exitCode)break}
 }finally{child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

