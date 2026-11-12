/** Strictly test-only accounts. Never run against development or production. */
import {pool} from './pool'
import {hashPassword} from '../security/password'
import {DEMO_USER_ID} from '../security/identity'
const db=process.env.DATABASE_URL||''
if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'||!/127\.0\.0\.1:5433\/atlas_test(?:\?|$)/.test(db))throw Error('E2E seed bloqueado: usar únicamente atlas_test en localhost:5433')
async function main(){
 const adminEmail=process.env.E2E_ADMIN_EMAIL,adminPass=process.env.E2E_ADMIN_PASSWORD
 const viewerEmail=process.env.E2E_VIEWER_EMAIL,viewerPass=process.env.E2E_VIEWER_PASSWORD
 if(!adminEmail||!adminPass||!viewerEmail||!viewerPass)throw Error('Faltan credenciales E2E temporales')
 const adminHash=await hashPassword(adminPass),viewerHash=await hashPassword(viewerPass)
 const c=await pool.connect()
 try{
  await c.query('BEGIN')
  await c.query(`INSERT INTO atlas_users(id,email,display_name,password_hash,platform_admin,active)
   VALUES($1,$2,'Administrador QA',$3,true,true)
   ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,active=true,platform_admin=true`,[DEMO_USER_ID,adminEmail,adminHash])
  const r=await c.query<{id:string}>(`INSERT INTO atlas_users(email,display_name,password_hash,platform_admin,active)
   VALUES($1,'Lector QA',$2,false,true)
   ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,active=true RETURNING id`,[viewerEmail,viewerHash])
  const w=await c.query<{id:string}>("SELECT id FROM workspaces WHERE name='Zercano · DEMO' AND created_by=$1",[DEMO_USER_ID])
  if(!w.rows[0])throw Error('Ejecuta db:seed contra atlas_test antes de E2E')
  const role=await c.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'",[w.rows[0].id])
  await c.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'viewer',$3)
   ON CONFLICT(workspace_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id,role='viewer'`,[w.rows[0].id,r.rows[0].id,role.rows[0].id])
  await c.query('COMMIT')
  console.log('[E2E] Usuarios QA preparados en atlas_test (contraseñas ocultas)')
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await pool.end()}
}
main().catch(e=>{console.error(e);process.exitCode=1;void pool.end()})
