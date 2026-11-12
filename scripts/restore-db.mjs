/** Safe side-by-side PostgreSQL restoration. NEVER drops/overwrites an existing database. */
import {spawn} from 'node:child_process'
import {createReadStream,existsSync,readFileSync,openSync,readSync,closeSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash,randomBytes} from 'node:crypto'

const args=Object.fromEntries(process.argv.slice(2).filter(s=>s.startsWith('--')&&s.includes('=')).map(s=>{const idx=s.indexOf('=');return [s.slice(2,idx),s.slice(idx+1)]}))
if(process.argv.includes('--help')){console.log('Uso: npm run db:restore:verify -- --file=backups/atlas-local-....dump\nO: npm run db:restore:recover -- --file=... --confirm=RECUPERACION_AISLADA');process.exit(0)}
const mode=args.mode||'verify'
if(!['verify','recover'].includes(mode))throw Error('Modo inválido: verify o recover')
if(mode==='recover'&&args.confirm!=='RECUPERACION_AISLADA')throw Error('Para restaurar en una BASE NUEVA persistente indica --confirm=RECUPERACION_AISLADA')
if(process.env.NODE_ENV==='production')throw Error('Restauración local prohibida en producción')
if(!args.file)throw Error('Debes indicar --file=archivo.dump')
const backup=resolve(args.file)
if(!backup.endsWith('.dump')||!existsSync(backup))throw Error('Archivo .dump inexistente')
const fd=openSync(backup,'r'),header=Buffer.alloc(5)
try{if(statSync(backup).size<64||readSync(fd,header,0,5,0)!==5||header.toString()!=='PGDMP')throw Error('No es un archivo pg_dump formato custom válido')}finally{closeSync(fd)}
const manifestPath=backup+'.sha256'
if(existsSync(manifestPath)){
 const expected=readFileSync(manifestPath,'utf8').trim().split(/\s+/)[0]
 const hash=createHash('sha256')
 for await(const block of createReadStream(backup))hash.update(block)
 const actual=hash.digest('hex')
 if(expected!==actual)throw Error('Checksum SHA-256 no coincide. Restauración cancelada.')
}
const service=mode==='verify'?'db_test':'db'
const db=`atlas_${mode==='verify'?'verify':'recovered'}_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`
const label=mode==='verify'?'Prueba aislada (temporal)':'Recuperación paralela (persistente)'
const run=(command,argv,input)=>new Promise((resolveRun,reject)=>{
 const proc=spawn(command,argv,{stdio:['pipe','pipe','pipe'],windowsHide:true})
 const chunks=[],errs=[]
 proc.stdout.on('data',x=>chunks.push(x));proc.stderr.on('data',x=>errs.push(x))
 proc.on('error',reject)
 proc.stdin.on('error',()=>{})
 if(input){createReadStream(input).on('error',reject).pipe(proc.stdin)}else proc.stdin.end()
 proc.on('close',code=>code===0?resolveRun(Buffer.concat(chunks).toString('utf8').trim()):reject(Error(`${command} devolvió ${code}: ${Buffer.concat(errs).toString('utf8').slice(-1000)}`)))
})
const docker=(...argv)=>run('docker',['compose',...argv])
let created=false,success=false
try{
 console.log(`[ATLAS RESTORE] ${label}: ${db}. La base atlas original NO se modificará.`)
 await docker(...(mode==='verify'?['--profile','test']:[]),'up','-d','--wait',service)
 await docker('exec','-T',service,'createdb','-U','atlas',db)
 created=true
 await run('docker',['compose','exec','-T',service,'pg_restore','-U','atlas','-d',db,'--no-owner','--no-privileges','--exit-on-error'],backup)
 const result=await docker('exec','-T',service,'psql','-U','atlas','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',
  "SELECT 'projects='||(SELECT count(*) FROM projects)||';versions='||(SELECT count(*) FROM project_document_versions)||';users='||(SELECT count(*) FROM atlas_users)||';migrations='||(SELECT count(*) FROM schema_migrations)")
 console.log('[ATLAS RESTORE] Integridad estructural comprobada:',result)
 if(!result.includes('migrations=')||!result.includes('versions='))throw Error('No se pudieron verificar las tablas esenciales')
 success=true
 if(mode==='recover')console.log(`[ATLAS RESTORE] Base de recuperación disponible: ${db} (servicio db). Cambia DATABASE_URL manualmente solo tras validar el contenido y detener la API.`)
 else console.log('[ATLAS RESTORE] Verificación correcta. Se eliminará únicamente la base temporal de verificación.')
}catch(e){console.error('[ATLAS RESTORE] FALLÓ:',e instanceof Error?e.message:String(e));process.exitCode=1}
finally{
 if(created&&(mode==='verify'||!success)){
  try{await docker('exec','-T',service,'dropdb','--if-exists','-U','atlas',db);console.log('[ATLAS RESTORE] Base temporal/incompleta eliminada:',db)}
  catch(e){console.error('[ATLAS RESTORE] Requiere limpieza manual de',db,e instanceof Error?e.message:e);process.exitCode=1}
 }
}
