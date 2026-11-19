/** Read-only status of the one-time demo reset. */
import {pool} from './pool'
import {RESET_ACTION_KEY} from './reset-demo-policy'
import {DEMO_PROJECT_NAME,DEMO_WORKSPACE_NAME} from './demo-provision'
async function main(){
 const checks={
  usuarios: 'SELECT count(*)::text AS n FROM novzi_users',
  espacios: 'SELECT count(*)::text AS n FROM workspaces',
  proyectos: 'SELECT count(*)::text AS n FROM projects',
  demos: `SELECT count(*)::text AS n FROM projects p JOIN workspaces w ON w.id=p.workspace_id WHERE w.name=$1 AND p.name=$2`,
  diagramas: `SELECT COALESCE(sum(jsonb_array_length(CASE WHEN jsonb_typeof(document->'diagrams')='array' THEN document->'diagrams' ELSE '[]'::jsonb END)),0)::text AS n FROM project_documents`,
  registros_funcionales: 'SELECT count(*)::text AS n FROM functional_items',
  lineas_base_asis: 'SELECT count(*)::text AS n FROM functional_baselines',
 }
 const rows:Record<string,number>={}
 for(const [key,sql] of Object.entries(checks)){
  const values=key==='demos'?[DEMO_WORKSPACE_NAME,DEMO_PROJECT_NAME]:[]
  rows[key]=Number((await pool.query<{n:string}>(sql,values)).rows[0]?.n||0)
 }
 const reset=(await pool.query('SELECT performed_at FROM novzi_maintenance_runs WHERE action_key=$1',[RESET_ACTION_KEY])).rows[0]
 console.table(rows)
 console.log('Reinicio de demos:',reset?`EJECUTADO (${new Date(reset.performed_at).toISOString()})`:'PENDIENTE')
}
main().catch(error=>{console.error('No se pudo consultar el estado:',error instanceof Error?error.message:error);process.exitCode=1}).finally(()=>pool.end())
