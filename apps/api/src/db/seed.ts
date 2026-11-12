import {pool} from './pool'
import {demoDocument} from '@atlas/fixtures'
import {DEMO_USER_ID} from '../security/identity'
import {initializeWorkspaceRoles} from '../security/roles'
async function seed(){
  if(process.env.NODE_ENV==='production')throw new Error('SEED DEMO PROHIBIDO en producción')
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    let w=await client.query<{id:string}>("SELECT id FROM workspaces WHERE created_by=$1 AND name='Zercano · DEMO' LIMIT 1",[DEMO_USER_ID])
    if(!w.rowCount)w=await client.query("INSERT INTO workspaces(name,created_by) VALUES ('Zercano · DEMO',$1) RETURNING id",[DEMO_USER_ID])
    const ws=w.rows[0].id
    await initializeWorkspaceRoles(client,ws)
    const owner=await client.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='owner'",[ws])
    await client.query("INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'owner',$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id",[ws,DEMO_USER_ID,owner.rows[0].id])
    let p=await client.query<{id:string}>("SELECT id FROM projects WHERE workspace_id=$1 AND name='Zercano · Plataforma' LIMIT 1",[ws])
    if(!p.rowCount)p=await client.query("INSERT INTO projects(workspace_id,name,created_by) VALUES ($1,'Zercano · Plataforma',$2) RETURNING id",[ws,DEMO_USER_ID])
    await client.query('INSERT INTO project_documents(project_id,document,updated_by) VALUES($1,$2::jsonb,$3) ON CONFLICT DO NOTHING',[p.rows[0].id,JSON.stringify(demoDocument()),DEMO_USER_ID])
    await client.query(`INSERT INTO project_document_versions(project_id,version,document,updated_by)
      SELECT project_id,version,document,updated_by FROM project_documents WHERE project_id=$1 ON CONFLICT DO NOTHING`,[p.rows[0].id])
    await client.query('COMMIT')
    console.log('Demo listo: workspace',ws,'proyecto',p.rows[0].id)
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await pool.end()}
}
seed().catch(e=>{console.error(e);process.exitCode=1})
