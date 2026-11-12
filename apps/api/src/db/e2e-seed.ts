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
 const editorEmail=process.env.E2E_EDITOR_EMAIL,editorPass=process.env.E2E_EDITOR_PASSWORD
 if(!editorEmail||!editorPass)throw Error('Faltan credenciales editor QA')
 const adminHash=await hashPassword(adminPass),viewerHash=await hashPassword(viewerPass),editorHash=await hashPassword(editorPass)
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
  const editor=await c.query<{id:string}>(`INSERT INTO atlas_users(email,display_name,password_hash,platform_admin,active)
   VALUES($1,'Editor QA independiente',$2,false,true)
   ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,active=true RETURNING id`,[editorEmail,editorHash])
  const editorRole=await c.query<{id:string}>(`INSERT INTO workspace_roles(workspace_id,role_key,name,system_role)
   VALUES($1,'qa_live_editor','Editor colaborativo QA',false)
   ON CONFLICT(workspace_id,role_key) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[w.rows[0].id])
  const grants=['project.read','diagram.view.c1','diagram.view.c2','diagram.edit.c1','diagram.edit.c2',
   'element.view.system','element.view.actor','element.view.external','element.view.container']
  await c.query('DELETE FROM role_permissions WHERE role_id=$1',[editorRole.rows[0].id])
  await c.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,unnest($2::text[])',[editorRole.rows[0].id,grants])
  await c.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'editor',$3)
   ON CONFLICT(workspace_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id,role='editor'`,[w.rows[0].id,editor.rows[0].id,editorRole.rows[0].id])
  // Explicit access for QA accounts: future projects are NOT inherited from workspace roles.
  const demoProjects=await c.query<{id:string}>('SELECT id FROM projects WHERE workspace_id=$1',[w.rows[0].id])
  for(const pr of demoProjects.rows){
   await c.query(`INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES ($1,$2,$3,$4)
    ON CONFLICT(project_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id`,[pr.id,w.rows[0].id,r.rows[0].id,role.rows[0].id])
   await c.query(`INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES ($1,$2,$3,$4)
    ON CONFLICT(project_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id`,[pr.id,w.rows[0].id,editor.rows[0].id,editorRole.rows[0].id])
  }
  await c.query('COMMIT')
  console.log('[E2E] Usuarios QA preparados en atlas_test (contraseñas ocultas)')
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await pool.end()}
}
main().catch(e=>{console.error(e);process.exitCode=1;void pool.end()})
