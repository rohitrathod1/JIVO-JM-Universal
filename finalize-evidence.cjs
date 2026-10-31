const fs=require('node:fs'),crypto=require('node:crypto');
const m=JSON.parse(fs.readFileSync('test-results/verified-source-manifest.json','utf8'));
const mismatches=m.files.filter(f=>crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex')!==f.sha256);
console.log({files:m.files.length,mismatches:mismatches.map(f=>f.path),checkpoint:m.verificationFinished});
if(mismatches.length)process.exit(1);
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));let s=fs.readFileSync('DEPENDENCY-TRIAGE.md','utf8');
for(const name of ['@expo/cli','@expo/metro-config']){const versions=[...new Set(Object.entries(lock.packages).filter(([p])=>p.endsWith('node_modules/'+name)).map(([,v])=>v.version))].join(', ');if(!versions)throw Error(name);s=s.replace('| '+name+' | see tree |','| '+name+' | '+versions+' |');console.log(name,versions);}
fs.writeFileSync('DEPENDENCY-TRIAGE.md',s);
