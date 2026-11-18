/** Per-account editable demo workspace. Never use the shared QA seed as a user tenant.
 * Run inside the SAME transaction that creates the account: no partial users
 * without a demo, no shared ownership, and no password/authentication changes.
 */
import type {PoolClient} from 'pg'
import {isProjectDocument} from '@novzi/contracts'
import type {ProjectDocument} from '@novzi/contracts'
import {initializeWorkspaceRoles} from '../security/roles'
import novziDemoJson from './novzi-demo-project.json'

export const DEMO_WORKSPACE_NAME='NOVZI · DEMO'
export const DEMO_PROJECT_NAME='NOVZI · Proyecto de exploración'

/** Fail closed if the packaged example becomes incompatible with the editor. */
export function onboardingDemoDocument():ProjectDocument {
 if(!isProjectDocument(novziDemoJson))throw new Error('El proyecto de demostración de NOVZI tiene un esquema incompatible')
 // Every registered user receives an isolated copy, never a shared mutable object.
 return structuredClone(novziDemoJson) as ProjectDocument
}

/** Idempotent provisioning: do NOT reset a demo a person has already edited. */
export async function provisionUserDemo(db:PoolClient,userId:string):Promise<{workspaceId:string;projectId:string;created:boolean}>{
 let ws=await db.query<{id:string}>(
  'SELECT id FROM workspaces WHERE created_by=$1 AND name=$2 LIMIT 1',
  [userId,DEMO_WORKSPACE_NAME])
 if(!ws.rows[0]){
  ws=await db.query<{id:string}>('INSERT INTO workspaces(name,created_by) VALUES($1,$2) RETURNING id',
   [DEMO_WORKSPACE_NAME,userId])
  await initializeWorkspaceRoles(db,ws.rows[0].id)
 }
 const workspaceId=ws.rows[0].id
 const owner=await db.query<{id:string}>(
  "SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='owner'",[workspaceId])
 if(!owner.rows[0])throw new Error('El workspace de demostración no tiene rol propietario')
 await db.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id)
   VALUES($1,$2,'owner',$3) ON CONFLICT(workspace_id,user_id) DO NOTHING`,
  [workspaceId,userId,owner.rows[0].id])
 let pr=await db.query<{id:string}>(
  'SELECT id FROM projects WHERE workspace_id=$1 AND name=$2 LIMIT 1',
  [workspaceId,DEMO_PROJECT_NAME])
 if(pr.rows[0])return {workspaceId,projectId:pr.rows[0].id,created:false}
 const document=onboardingDemoDocument()
 pr=await db.query<{id:string}>(
  'INSERT INTO projects(workspace_id,name,created_by) VALUES($1,$2,$3) RETURNING id',
  [workspaceId,DEMO_PROJECT_NAME,userId])
 const projectId=pr.rows[0].id
 await db.query('INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES($1,$2,$3,$4)',
  [projectId,workspaceId,userId,owner.rows[0].id])
 await db.query('INSERT INTO project_documents(project_id,document,updated_by) VALUES($1,$2::jsonb,$3)',
  [projectId,JSON.stringify(document),userId])
 await db.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES($1,1,$2::jsonb,$3)',
  [projectId,JSON.stringify(document),userId])
 return {workspaceId,projectId,created:true}
}
