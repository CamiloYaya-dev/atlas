/** One-time, transactional, user-preserving reset to the canonical NOVZI demos.
 * Project-owned data (functional items, versions, branches, licenses and so on)
 * is removed through declared ON DELETE CASCADE foreign keys.
 * No DROP TABLE, TRUNCATE, or auth table changes.
 */
import type {PoolClient} from 'pg'
import {RESET_ACTION_KEY} from './reset-demo-policy'
import {DEMO_PROJECT_NAME,DEMO_WORKSPACE_NAME,provisionUserDemo} from './demo-provision'

type DemoProvision = typeof provisionUserDemo
export interface ResetResult {accountsPreserved:number; demosCreated:number; workspacesRemoved:number}
export async function resetToCanonicalDemos(c:PoolClient,provision:DemoProvision=provisionUserDemo):Promise<ResetResult>{
 await c.query('BEGIN')
 try {
  await c.query("SET LOCAL lock_timeout = '7s'")
  await c.query('SELECT pg_advisory_xact_lock(58741322)')
  const previous=await c.query('SELECT action_key FROM novzi_maintenance_runs WHERE action_key=$1',[RESET_ACTION_KEY])
  if (previous.rows.length)throw Error('NOVZI ya fue reiniciado. No se vuelve a eliminar contenido creado después.')
  const users=await c.query<{id:string}>('SELECT id FROM novzi_users ORDER BY created_at,id')
  if (!users.rows.length)throw Error('No hay usuarios para conservar; reinicio cancelado')
  const count=await c.query<{n:string}>('SELECT count(*)::text AS n FROM workspaces')
  // Delete all old workspaces; all project-owned functional and diagram history
  // disappears via FK cascade, but novzi_users and novzi_sessions are untouched.
  await c.query('DELETE FROM workspaces')
  let demosCreated=0
  for (const user of users.rows) {
   const demo=await provision(c,user.id)
   if (!demo.created)throw Error('No se pudo recrear el demo limpio para '+user.id)
   demosCreated++
  }
  const remaining=await c.query<{n:string}>(`SELECT count(*)::text AS n FROM projects p
    JOIN workspaces w ON w.id=p.workspace_id
    WHERE w.name<>$1 OR p.name<>$2`,[DEMO_WORKSPACE_NAME,DEMO_PROJECT_NAME])
  if (Number(remaining.rows[0]?.n)!==0)throw Error('Quedaron proyectos ajenos al demo: transacción revertida')
  const result={accountsPreserved:users.rows.length,demosCreated,workspacesRemoved:Number(count.rows[0]?.n||0)}
  await c.query(`INSERT INTO novzi_maintenance_runs(action_key,accounts_preserved,demos_created,info)
   VALUES($1,$2,$3,$4::jsonb)`,[RESET_ACTION_KEY,result.accountsPreserved,demosCreated,JSON.stringify({workspacesRemoved:result.workspacesRemoved})])
  await c.query('COMMIT')
  return result
 }catch(error){await c.query('ROLLBACK');throw error}
}
