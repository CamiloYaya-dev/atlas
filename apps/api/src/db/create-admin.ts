import {pool} from './pool'
import {hashPassword} from '../security/password'
import {DEMO_USER_ID} from '../security/identity'
import {provisionUserDemo} from './demo-provision'
async function main(){
 const email=(process.env.NOVZI_ADMIN_EMAIL||'').trim().toLowerCase()
 const password=process.env.NOVZI_BOOTSTRAP_PASSWORD||''
 const name=(process.env.NOVZI_ADMIN_NAME||'Administrador NOVZI').trim()
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password)throw Error('Indica NOVZI_ADMIN_EMAIL y NOVZI_BOOTSTRAP_PASSWORD mediante npm run admin:setup')
 const client=await pool.connect()
 try{
  await client.query('BEGIN')
  const {rows}=await client.query<{count:string}>('SELECT count(*)::text AS count FROM novzi_users WHERE platform_admin=true')
  if(Number(rows[0].count)!==0)throw Error('Ya existe un administrador. No se puede ejecutar bootstrap por segunda vez.')
  const pass=await hashPassword(password)
  // Reutilizamos el usuario semilla de V4.1 para conservar sus workspaces y documentos.
  const {rows:created}=await client.query<{id:string}>(`INSERT INTO novzi_users(id,email,display_name,password_hash,platform_admin)
    VALUES($1,$2,$3,$4,true) RETURNING id`,[DEMO_USER_ID,email,name,pass])
  await provisionUserDemo(client,created[0].id)
  await client.query('COMMIT')
  console.log(`Administrador creado: ${email} (${created[0].id}). El login es cerrado y no existe registro público.`)
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await pool.end()}
}
main().catch(e=>{console.error('No se creó el administrador:',e instanceof Error?e.message:e);process.exitCode=1})
