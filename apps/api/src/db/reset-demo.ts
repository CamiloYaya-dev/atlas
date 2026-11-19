/** Command: npm run db:reset:demo [-- --apply --confirm=REINICIAR-SOLO-DEMOS]
 * Without --apply it ONLY displays the operation's scope.
 * This is never executed by setup, migrations, server startup or QA.
 */
import {createHash} from 'node:crypto'
import {readdir,readFile,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pool} from './pool'
import {assertLocalDemoResetAllowed,isExplicitDemoReset,RESET_ACTION_KEY} from './reset-demo-policy'
import {resetToCanonicalDemos} from './reset-demo-core'

const root=resolve(process.cwd(),'../..')
async function ensureRecentBackup():Promise<string>{
 const folder=resolve(root,'backups')
 const candidates=(await readdir(folder)).filter(n=>/^(?:novzi|atlas)-local-.*\.dump$/.test(n)).sort().reverse()
 for (const name of candidates){
  const path=resolve(folder,name),details=await stat(path)
  if(details.size<1024||Date.now()-details.mtimeMs>24*60*60*1000)continue
  let expected:string
  try{expected=(await readFile(path+'.sha256','utf8')).trim().split(/\s+/)[0]}catch{continue}
  const {createReadStream}=await import('node:fs')
  const sha=createHash('sha256')
  for await(const chunk of createReadStream(path))sha.update(chunk)
  if(sha.digest('hex')===expected)return name
 }
 throw Error('No hay respaldo reciente válido (24 h) con SHA-256. Ejecuta npm run db:backup ANTES del reinicio.')
}
async function main(){
 assertLocalDemoResetAllowed(process.env)
 const apply=isExplicitDemoReset(process.argv.slice(2))
 const c=await pool.connect()
 try {
  const done=await c.query('SELECT performed_at FROM novzi_maintenance_runs WHERE action_key=$1',[RESET_ACTION_KEY])
  if (done.rows.length)throw Error('Este reinicio ya fue ejecutado. Los datos creados posteriormente están protegidos.')
  const query=async(sql:string)=>Number((await c.query<{n:string}>(sql)).rows[0]?.n||0)
  const before={
   users:await query('SELECT count(*)::text AS n FROM novzi_users'),
   workspaces:await query('SELECT count(*)::text AS n FROM workspaces'),
   projects:await query('SELECT count(*)::text AS n FROM projects'),
   diagrams:await query("SELECT COALESCE(sum(jsonb_array_length(CASE WHEN jsonb_typeof(document->'diagrams')='array' THEN document->'diagrams' ELSE '[]'::jsonb END)),0)::text AS n FROM project_documents"),
   functionalRecords:await query('SELECT count(*)::text AS n FROM functional_items'),
   asisBaselines:await query('SELECT count(*)::text AS n FROM functional_baselines'),
  }
  console.table(before)
  console.log('Se conservarán cuentas, credenciales y sesiones; se sustituirán TODOS los espacios/proyectos y su contenido por demos canónicos de 19 diagramas por usuario.')
  console.log('No se modificarán migraciones ni se eliminarán las cuentas.')
  if(!apply){console.log('SOLO PREVISUALIZACIÓN. Para aplicar: npm run db:backup y luego npm run db:reset:demo -- --apply --confirm=REINICIAR-SOLO-DEMOS');return}
  const backup=await ensureRecentBackup()
  console.log('Respaldo validado:',backup)
  const result=await resetToCanonicalDemos(c)
  console.log('Reinicio completado con transacción:',result)
  console.log('No ejecutes de nuevo esta operación: el bloqueo permanente protege contenido nuevo.')
 }finally{c.release()}
}
main().catch(error=>{console.error('[NOVZI] Reinicio cancelado:',error instanceof Error?error.message:error);process.exitCode=1}).finally(()=>pool.end())
