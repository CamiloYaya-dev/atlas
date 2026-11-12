/**
 * QA operacional instrumentado: solamente atlas_test (127.0.0.1:5433).
 * Recorre los entrypoints reales que no se importan durante unit/integration.
 * Cada comando tiene una expectativa comprobable; no se ejecuta en desarrollo
 * ni contra la base de datos del usuario.
 *
 * Se invoca dentro de c8 para recoger la cobertura de procesos secundarios.
 */
import {spawnSync,spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {existsSync} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'
import {createServer} from 'node:net'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'

const root=fileURLToPath(new URL('..',import.meta.url))
const api=resolve(root,'apps/api')
const tsx=resolve(root,'node_modules/tsx/dist/cli.mjs')
const qa=/^postgresql:\/\/[^\s]*@127\.0\.0\.1:5433\/atlas_test(?:\?.*)?$/
if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'||!qa.test(process.env.DATABASE_URL||'')||!qa.test(process.env.MIGRATIONS_DATABASE_URL||'')){
 throw Error('QA OPERACIONAL BLOQUEADO: solo atlas_test en 127.0.0.1:5433 y NODE_ENV=test')
}
assert(existsSync(tsx),'Falta tsx: instala dependencias npm antes de medir coverage')
const env={...process.env,HOST:'127.0.0.1'}
const cmd=(label,source,options={})=>{
 const result=spawnSync(process.execPath,[tsx,source],{
  cwd:api,env:{...env,...options.env},encoding:'utf8',timeout:30000,windowsHide:true,
 })
 if(result.error)throw new Error(`${label}: ${result.error.message}`)
 const status=options.expectedStatus??0
 assert.equal(result.status,status,`${label}: se esperaba salida ${status}, recibida ${result.status}.\n${result.stdout||''}\n${result.stderr||''}`)
 if(options.output)assert.match((result.stdout||'')+'\n'+(result.stderr||''),options.output,`${label}: resultado inesperado`)
 console.log(`[QA operacional] ${label}: comprobado (${status})`)
}

// La configuración se carga en un proceso nuevo para ensayar cada validación.
const snippet="import {env} from './src/config/env.ts'; console.log('QA-ENV:'+JSON.stringify({port:env.port,host:env.host,allowedOrigins:env.allowedOrigins,dbPoolMax:env.dbPoolMax,trustProxy:env.trustProxy,secureCookies:env.secureCookies}))"
function checkEnv(label,overrides,good,expectPattern){
 const result=spawnSync(process.execPath,[tsx,'-e',snippet],{cwd:api,encoding:'utf8',timeout:15000,windowsHide:true,env:{...env,...overrides}})
 if(result.error)throw result.error
 assert.equal(result.status,good?0:1,`${label}: código ${result.status}.\n${result.stderr||result.stdout}`)
 assert.match((result.stdout||'')+'\n'+(result.stderr||''),expectPattern,`Configuración: ${label}`)
 console.log(`[QA env] ${label}: comprobado`)
}

checkEnv('desarrollo válido',{},true,/QA-ENV:/)
checkEnv('sin conexión', {DATABASE_URL:''},false,/DATABASE_URL requerido/)
checkEnv('modo demo rechazado',{AUTH_MODE:'demo'},false,/AUTH_MODE=local/)
checkEnv('puerto cero',{PORT:'0'},false,/PORT inválido/)
checkEnv('puerto fuera de rango',{PORT:'65536'},false,/PORT inválido/)
checkEnv('puerto no numérico',{PORT:'NaN'},false,/PORT inválido/)
checkEnv('secreto CSRF insuficiente',{ATLAS_CSRF_SECRET:'short'},false,/CSRF_SECRET/)
checkEnv('pool cero',{DB_POOL_MAX:'0'},false,/DB_POOL_MAX inválido/)
checkEnv('pool fuera de rango',{DB_POOL_MAX:'41'},false,/DB_POOL_MAX inválido/)
checkEnv('pool no numérico',{DB_POOL_MAX:'NaN'},false,/DB_POOL_MAX inválido/)
checkEnv('CORS producción inseguro',{NODE_ENV:'production',CORS_ORIGINS:'http://bad.example',DATABASE_URL:'postgresql://qa:qa@remote.example/atlas_qa',DB_SSL:'true'},false,/CORS_ORIGINS/)
checkEnv('TLS producción obligatorio',{NODE_ENV:'production',CORS_ORIGINS:'https://atlas.example',DATABASE_URL:'postgresql://qa:qa@remote.example/atlas_qa',DB_SSL:'false'},false,/DB_SSL=true/)
checkEnv('BD local prohibida en producción',{NODE_ENV:'production',CORS_ORIGINS:'https://atlas.example',DB_SSL:'true'},false,/DATABASE_URL local/)
checkEnv('configuración de producción válida (sin conexión)',{NODE_ENV:'production',DATABASE_URL:'postgresql://qa:qa@remote.example/atlas_qa',CORS_ORIGINS:'https://atlas.example',DB_SSL:'true',ATLAS_SECURE_COOKIES:'true',TRUST_PROXY:'true',DB_POOL_MAX:'10'},true,/QA-ENV:/)
checkEnv('orígenes normalizados',{CORS_ORIGINS:' https://a.example, ,https://b.example ',TRUST_PROXY:'true',ATLAS_SECURE_COOKIES:'true'},true,/https:\/\/b\.example/)

// El caso positivo del administrador se valida en integración; este caso ejercita
// la protección contra ejecutar bootstrap dos veces sobre atlas_test.
cmd('migraciones idempotentes','src/db/migrate.ts',{output:/Ya aplicada:|Migración aplicada:/})
cmd('cuenta semilla exclusiva QA','src/tests/coverage-bootstrap.test.ts',{output:/QA bootstrap:/})
cmd('seed de proyecto y permisos','src/db/seed.ts',{output:/Demo listo:/})
cmd('seed idempotente','src/db/seed.ts',{output:/Demo listo:/})
cmd('cuentas E2E aisladas','src/db/e2e-seed.ts',{env:{
 E2E_ADMIN_EMAIL:'coverage-admin@atlas.test',E2E_ADMIN_PASSWORD:'QA-Operacional-Admin-2026!',
 E2E_VIEWER_EMAIL:'coverage-viewer@atlas.test',E2E_VIEWER_PASSWORD:'QA-Operacional-Viewer-2026!'
},output:/Usuarios QA preparados/})
cmd('administrador existente','src/db/admin-status.ts',{output:/Administrador activo: OK/})
cmd('no duplicar administrador','src/db/create-admin.ts',{expectedStatus:1,env:{
 ATLAS_ADMIN_EMAIL:'nuevo@atlas.test',ATLAS_BOOTSTRAP_PASSWORD:'QA-Operacional-Admin-2026!'
},output:/Ya existe un administrador/})

const port=await new Promise((ok,fail)=>{
 const server=createServer();server.once('error',fail);server.listen(0,'127.0.0.1',()=>{
  const addr=server.address();const value=typeof addr==='object'&&addr?addr.port:0
  server.close(()=>ok(value))
 })
})
const server=spawn(process.execPath,[tsx,'src/server.ts'],{
 cwd:api,env:{...env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true,
})
let output=''
server.stdout.on('data',chunk=>{output+=String(chunk)})
server.stderr.on('data',chunk=>{output+=String(chunk)})
try{
 let started=false
 for(let i=0;i<90;i++){
  if(server.exitCode!==null)break
  try{const result=await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`)
   assert([200,401,403].includes(result.status),'Respuesta HTTP inesperada')
   started=true;break
  }catch{await delay(200)}
 }
 assert(started,`La API no respondió al arrancar en QA: ${output.slice(-2200)}`)
 console.log(`[QA operacional] arranque HTTP API: comprobado en puerto efímero`)
}finally{
 server.kill('SIGTERM')
 await Promise.race([new Promise(done=>server.once('exit',done)),delay(3500)])
 if(server.exitCode===null)server.kill('SIGKILL')
}
console.log('[QA operacional] Entrada de servidor y scripts de PostgreSQL verificados con atlas_test.')
