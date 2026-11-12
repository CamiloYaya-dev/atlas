import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
function envFile(relative){
 const name=resolve(root,relative)
 if(!existsSync(name)){console.error(`[piloto] No existe ${relative}. Copia su .env.example y configura el piloto.`);process.exitCode=1;return {}}
 const parsed={}
 for(const line of readFileSync(name,'utf8').split(/\r?\n/)){
  const match=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if(match)parsed[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'')
 }
 return parsed
}
const web=envFile('apps/web/.env'),api=envFile('apps/api/.env')
const host=web.ATLAS_NGROK_HOST||''
const origin=`https://${host}`
const checks=[
 ['Host ngrok específico',!!host&&/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(host)&&!host.includes('..')],
 ['Cookie HTTPS Secure',api.ATLAS_SECURE_COOKIES==='true'],
 ['CORS_ORIGINS incluye host HTTPS',Boolean(host&&api.CORS_ORIGINS?.split(',').map(x=>x.trim()).includes(origin))],
 ['API solo loopback',!api.HOST||api.HOST==='127.0.0.1'||api.HOST==='localhost'],
 ['DB local Docker',/127\.0\.0\.1|localhost/.test(api.DATABASE_URL||'')],
 ['Frontend llama al proxy de mismo origen',!web.VITE_API_BASE_URL||web.VITE_API_BASE_URL==='/api'],
]
for(const [label,pass] of checks)console.log(`[${pass?'OK':'FALLO'}] ${label}`)
if(checks.some(([,pass])=>!pass)){
 console.error('Piloto NO autorizado por esta verificación. Corrige variables antes de abrir ngrok.')
 process.exitCode=1
}else console.log('Configuración básica coherente. Faltan prueba HTTPS real, permisos, backup y auditoría manual.')
