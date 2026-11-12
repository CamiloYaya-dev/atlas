/**
 * Inicio de API con hot-reload SIN reutilizar el puerto del piloto compilado.
 * Lee el mismo .env y la misma DATABASE_URL de apps/api (decisión explícita para el piloto).
 * QA puede especificar ATLAS_DEV_API_PORT=3003 y usar su DB aislada atlas_test.
 */
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const apiPort=Number(process.env.ATLAS_DEV_API_PORT||3002)
const webPort=Number(process.env.ATLAS_DEV_WEB_PORT||5173)
for(const [name,value] of [['ATLAS_DEV_API_PORT',apiPort],['ATLAS_DEV_WEB_PORT',webPort]]){
 if(!Number.isInteger(value)||value<1||value>65535){
  console.error(`${name}: puerto inválido`)
  process.exit(1)
 }
}
if(apiPort===3001){
 console.error('Puerto 3001 reservado para el piloto; no se inicia DEV sobre ese puerto.')
 process.exit(1)
}
const env={...process.env,
 PORT:String(apiPort),HOST:'127.0.0.1',ATLAS_SECURE_COOKIES:'false',
 CORS_ORIGINS:`http://127.0.0.1:${webPort},http://localhost:${webPort}`
}
console.log(`[ATLAS DEV] API en 127.0.0.1:${apiPort} (watch). La base de datos se lee desde apps/api/.env.`)
const child=spawn('npm',['run','dev','-w','@atlas/api'],{
 cwd:root,env,stdio:'inherit',shell:process.platform==='win32'
})
child.on('error',error=>{console.error('[ATLAS DEV] No pudo iniciarse la API:',error);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
