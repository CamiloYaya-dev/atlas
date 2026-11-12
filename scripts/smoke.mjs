const targets=[['API saludable','http://127.0.0.1:3001/api/v1/health'],['API + BD listas','http://127.0.0.1:3001/api/v1/ready'],['Frontend','http://127.0.0.1:5173/']]
let failed=0
for(const [label,url] of targets){try{const r=await fetch(url,{signal:AbortSignal.timeout(6000)});console.log(r.ok?'OK':'ERROR',label,`${r.status}`,url);if(!r.ok)failed++}catch(error){console.error('ERROR',label,error.message);failed++}}
process.exitCode=failed?1:0
