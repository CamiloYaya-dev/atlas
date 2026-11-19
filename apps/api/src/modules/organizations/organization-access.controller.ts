import type {FastifyInstance} from 'fastify'
import {pool} from '../../db/pool'
import {identity} from '../../security/identity'
import {assertUUID,DomainError} from '../../domain/errors'
import {organizationAccess} from './organizations.controller'
import {projectEvents} from '../projects/realtime/project-events'
import {requireValidPermissions} from '../../security/roles'

type BaseParams={organizationId:string;userId:string}
const getBody=(body:unknown)=>{if(!body||typeof body!=='object'||Array.isArray(body))throw new DomainError('JSON requerido',400);return body as Record<string,unknown>}
const orgManager=async(id:string,userId:string)=>{
 const role=await organizationAccess(id,userId)
 if(role!=='admin'&&role!=='owner')throw new DomainError('Solo administradores de organización pueden gestionar accesos',403)
 return role
}
const isString=(v:unknown):v is string=>typeof v==='string'
const validNames=(v:unknown):v is string[]=>Array.isArray(v)&&v.length>0&&v.length<=200&&v.every(x=>typeof x==='string'&&x.length>0&&x.length<=150)&&new Set(v).size===v.length

export async function registerOrganizationAccessController(app:FastifyInstance){
 app.get<{Params:{organizationId:string;workspaceId:string}}>('/api/v1/organizations/:organizationId/workspaces/:workspaceId/roles',async req=>{
  const {organizationId,workspaceId}=req.params;assertUUID(organizationId);assertUUID(workspaceId)
  await orgManager(organizationId,(await identity(req)).id)
  const {rows}=await pool.query<{id:string;name:string;role_key:string;permissions:string[]}>(`SELECT r.id,r.name,r.role_key,COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL),'{}') AS permissions FROM workspace_roles r JOIN workspaces w ON w.id=r.workspace_id LEFT JOIN role_permissions p ON p.role_id=r.id WHERE r.workspace_id=$1 AND w.organization_id=$2 GROUP BY r.id,r.name,r.role_key ORDER BY r.name`,[workspaceId,organizationId])
  return rows
 })
 app.post<{Params:{organizationId:string;workspaceId:string}}>('/api/v1/organizations/:organizationId/workspaces/:workspaceId/roles',async(req,reply)=>{
  const {organizationId,workspaceId}=req.params;assertUUID(organizationId);assertUUID(workspaceId)
  await orgManager(organizationId,(await identity(req)).id)
  const b=getBody(req.body),name=String(b.name??'').trim(),key=String(b.roleKey??'').trim().toLowerCase(),permissions=requireValidPermissions(b.permissions)
  if(name.length<2||name.length>100||!/^[a-z][a-z0-9_-]{1,39}$/.test(key)||['owner','admin','viewer'].includes(key))throw new DomainError('Identificador o nombre de rol inválido',400)
  if(permissions.includes('workspace.delete'))throw new DomainError('La eliminación de espacios se reserva al propietario',403)
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const belongs=await c.query('SELECT 1 FROM workspaces WHERE id=$1 AND organization_id=$2',[workspaceId,organizationId]);if(!belongs.rows[0])throw new DomainError('Espacio ajeno a la organización',404)
   const {rows}=await c.query<{id:string}>('INSERT INTO workspace_roles(workspace_id,role_key,name) VALUES($1,$2,$3) RETURNING id',[workspaceId,key,name])
   await c.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,unnest($2::text[])',[rows[0].id,permissions])
   await c.query('COMMIT');return reply.code(201).send({id:rows[0].id})
  }catch(e){await c.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new DomainError('Ya existe el rol',409);throw e}finally{c.release()}
 })
 app.put<{Params:{organizationId:string;workspaceId:string;roleId:string}}>('/api/v1/organizations/:organizationId/workspaces/:workspaceId/roles/:roleId',async req=>{
  const {organizationId,workspaceId,roleId}=req.params;assertUUID(organizationId);assertUUID(workspaceId);assertUUID(roleId)
  await orgManager(organizationId,(await identity(req)).id)
  const b=getBody(req.body),permissions=requireValidPermissions(b.permissions)
  if(permissions.includes('workspace.delete'))throw new DomainError('No se puede conceder eliminación de espacios',403)
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const {rows}=await c.query<{role_key:string}>(`SELECT r.role_key FROM workspace_roles r JOIN workspaces w ON w.id=r.workspace_id WHERE r.id=$1 AND r.workspace_id=$2 AND w.organization_id=$3 FOR UPDATE OF r`,[roleId,workspaceId,organizationId])
   if(!rows[0])throw new DomainError('Rol no encontrado',404)
   if(rows[0].role_key==='owner')throw new DomainError('Política de propietario inmutable',403)
   await c.query('DELETE FROM role_permissions WHERE role_id=$1',[roleId])
   await c.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,unnest($2::text[])',[roleId,permissions])
   await c.query('COMMIT');return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.get<{Params:{organizationId:string}}>('/api/v1/organizations/:organizationId/access-tree',async req=>{
  const id=req.params.organizationId;assertUUID(id)
  await orgManager(id,(await identity(req)).id)
  const [spaces,projects,roles]=await Promise.all([
   pool.query<{id:string;name:string}>(`SELECT id,name FROM workspaces WHERE organization_id=$1 ORDER BY name`,[id]),
   pool.query<{id:string;name:string;workspace_id:string;document:{diagrams?:Array<{id:string;name:string;type:string}>}|null}>(`SELECT p.id,p.name,p.workspace_id,d.document FROM projects p JOIN workspaces w ON w.id=p.workspace_id LEFT JOIN project_documents d ON d.project_id=p.id WHERE w.organization_id=$1 ORDER BY p.name`,[id]),
   pool.query<{id:string;workspace_id:string;name:string;role_key:string}>(`SELECT r.id,r.workspace_id,r.name,r.role_key FROM workspace_roles r JOIN workspaces w ON w.id=r.workspace_id WHERE w.organization_id=$1 AND r.role_key<>'owner' ORDER BY r.name`,[id])
  ])
  return spaces.rows.map(w=>({id:w.id,name:w.name,roles:roles.rows.filter(r=>r.workspace_id===w.id),projects:projects.rows.filter(p=>p.workspace_id===w.id).map(p=>({id:p.id,name:p.name,diagrams:(p.document?.diagrams||[]).map(d=>({id:d.id,name:d.name,type:d.type}))}))}))
 })
 app.get<{Params:BaseParams}>('/api/v1/organizations/:organizationId/members/:userId/grants',async req=>{
  const {organizationId,userId}=req.params;assertUUID(organizationId);assertUUID(userId)
  await orgManager(organizationId,(await identity(req)).id)
  const member=await pool.query('SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2',[organizationId,userId])
  if(!member.rows[0])throw new DomainError('La persona no pertenece a esta organización',404)
  const [workspaces,projects]=await Promise.all([
   pool.query<{workspace_id:string;role_id:string;role_name:string;role_key:string}>(`SELECT wm.workspace_id,wm.role_id,r.name AS role_name,r.role_key FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id JOIN workspace_roles r ON r.id=wm.role_id WHERE w.organization_id=$1 AND wm.user_id=$2 ORDER BY w.name`,[organizationId,userId]),
   pool.query<{project_id:string;workspace_id:string;role_id:string;role_name:string;role_key:string;diagram_scope:string;diagram_ids:string[]}>(`SELECT pm.project_id,pm.workspace_id,pm.role_id,r.name AS role_name,r.role_key,pm.diagram_scope,COALESCE(array_agg(g.diagram_id) FILTER (WHERE g.diagram_id IS NOT NULL),'{}') AS diagram_ids FROM project_members pm JOIN projects p ON p.id=pm.project_id JOIN workspaces w ON w.id=p.workspace_id JOIN workspace_roles r ON r.id=pm.role_id LEFT JOIN project_diagram_grants g ON g.project_id=pm.project_id AND g.user_id=pm.user_id WHERE w.organization_id=$1 AND pm.user_id=$2 GROUP BY pm.project_id,pm.workspace_id,pm.role_id,r.name,r.role_key,pm.diagram_scope ORDER BY pm.project_id`,[organizationId,userId])
  ])
  return {workspaces:workspaces.rows,projects:projects.rows}
 })
 app.put<{Params:BaseParams}>('/api/v1/organizations/:organizationId/members/:userId/grants',async req=>{
  const {organizationId,userId}=req.params;assertUUID(organizationId);assertUUID(userId)
  const actor=await identity(req);await orgManager(organizationId,actor.id)
  const b=getBody(req.body)
  const workspaceId=b.workspaceId,projectId=b.projectId,workspaceRoleId=b.workspaceRoleId,projectRoleId=b.projectRoleId,diagramIds=b.diagramIds
  if(!isString(workspaceId))throw new DomainError('Espacio requerido',400);assertUUID(workspaceId)
  if(workspaceRoleId!==undefined&&workspaceRoleId!==null){if(!isString(workspaceRoleId))throw new DomainError('Rol de espacio inválido',400);assertUUID(workspaceRoleId)}
  if(projectId!==undefined&&projectId!==null){if(!isString(projectId))throw new DomainError('Proyecto inválido',400);assertUUID(projectId)}
  if(projectRoleId!==undefined&&projectRoleId!==null){if(!isString(projectRoleId))throw new DomainError('Rol de proyecto inválido',400);assertUUID(projectRoleId)}
  if(diagramIds!==undefined&&!validNames(diagramIds))throw new DomainError('Selecciona entre 1 y 200 diagramas válidos',400)
  if(diagramIds!==undefined&&!projectId)throw new DomainError('Selecciona un proyecto antes de limitar diagramas',400)
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const me=await organizationAccess(organizationId,actor.id,c)
   if(me!=='owner'&&me!=='admin')throw new DomainError('Solo administradores de organización',403)
   const target=await c.query<{role:string}>(`SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 FOR UPDATE`,[organizationId,userId])
   if(!target.rows[0])throw new DomainError('Miembro no encontrado',404)
   const space=await c.query(`SELECT id FROM workspaces WHERE id=$1 AND organization_id=$2`,[workspaceId,organizationId]);if(!space.rows[0])throw new DomainError('Espacio ajeno a la organización',404)
   const role=await c.query<{id:string;role_key:string}>(`SELECT id,role_key FROM workspace_roles WHERE workspace_id=$1 AND id=COALESCE($2::uuid,(SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'))`,[workspaceId,workspaceRoleId||null])
   if(!role.rows[0]||role.rows[0].role_key==='owner')throw new DomainError('Rol de espacio inválido o reservado',403)
   // Nunca demover un propietario. Si ya existe una membresía sin solicitud de rol, conservarla.
   const current=await c.query<{role_key:string}>(`SELECT r.role_key FROM workspace_members wm JOIN workspace_roles r ON r.id=wm.role_id WHERE wm.workspace_id=$1 AND wm.user_id=$2`,[workspaceId,userId])
   if(current.rows[0]?.role_key==='owner'&&diagramIds)throw new DomainError('Un propietario de espacio conserva acceso completo; no se puede limitar a diagramas',403)
   if(!current.rows[0])await c.query(
    `INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,$3,$4)`,
    [workspaceId,userId,role.rows[0].role_key==='admin'?'admin':role.rows[0].role_key==='viewer'?'viewer':'editor',role.rows[0].id]
   )
   else if(workspaceRoleId){if(current.rows[0].role_key==='owner')throw new DomainError('Rol propietario protegido',403);await c.query(`UPDATE workspace_members SET role_id=$3,role=$4 WHERE workspace_id=$1 AND user_id=$2`,[workspaceId,userId,role.rows[0].id,role.rows[0].role_key==='admin'?'admin':'editor'])}
   if(projectId){
    const project=await c.query<{id:string;document:{diagrams?:Array<{id:string;type:string}>}|null}>(`SELECT p.id,d.document FROM projects p LEFT JOIN project_documents d ON d.project_id=p.id WHERE p.id=$1 AND p.workspace_id=$2`,[projectId,workspaceId]);if(!project.rows[0])throw new DomainError('Proyecto ajeno al espacio',404)
    const selectedRole=await c.query<{id:string;role_key:string}>(`SELECT id,role_key FROM workspace_roles WHERE workspace_id=$1 AND id=COALESCE($2::uuid,(SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'))`,[workspaceId,projectRoleId||null]);if(!selectedRole.rows[0]||selectedRole.rows[0].role_key==='owner')throw new DomainError('Rol de proyecto inválido',403)
    const currentProject=await c.query<{role_key:string}>(`SELECT r.role_key FROM project_members pm JOIN workspace_roles r ON r.id=pm.role_id WHERE pm.project_id=$1 AND pm.user_id=$2`,[projectId,userId]);if(currentProject.rows[0]?.role_key==='owner')throw new DomainError('Propietario de proyecto protegido',403)
    if(diagramIds){const allowed=new Set((project.rows[0].document?.diagrams||[]).map(d=>d.id));if(diagramIds.some(id=>!allowed.has(id)))throw new DomainError('Uno o varios diagramas ya no existen en el proyecto',409)}
    // Usar el rol que quedará asignado tras el cambio, nunca el permiso
    // heredado de un rol distinto. No se puede conceder una vista sin lectura.
    const currentRole=await c.query<{role_id:string}>(
     'SELECT role_id FROM project_members WHERE project_id=$1 AND user_id=$2',
     [projectId,userId]
    )
    const effectiveRole=projectRoleId||currentRole.rows[0]?.role_id||selectedRole.rows[0].id
    if(diagramIds){
     const {rows:grants}=await c.query<{permission:string}>(
      'SELECT permission FROM role_permissions WHERE role_id=$1',[effectiveRole]
     )
     const grantsSet=new Set(grants.map(g=>g.permission))
     const diagramTypes=new Map((project.rows[0].document?.diagrams||[]).map(d=>[d.id,d.type]))
     if(!grantsSet.has('project.read')||diagramIds.some(id=>!grantsSet.has(`diagram.view.${diagramTypes.get(id)}`)))
      throw new DomainError('El rol seleccionado no permite leer los diagramas indicados',403)
    }
    if(!currentProject.rows[0])await c.query(`INSERT INTO project_members(project_id,workspace_id,user_id,role_id,diagram_scope) VALUES($1,$2,$3,$4,$5)`,[projectId,workspaceId,userId,selectedRole.rows[0].id,diagramIds?'selected':'all'])
    else await c.query(`UPDATE project_members SET role_id=COALESCE($3::uuid,role_id),diagram_scope=$4 WHERE project_id=$1 AND user_id=$2`,[projectId,userId,effectiveRole,diagramIds?'selected':'all'])
    await c.query(`DELETE FROM project_diagram_grants WHERE project_id=$1 AND user_id=$2`,[projectId,userId])
    if(diagramIds)for(const id of diagramIds)await c.query(`INSERT INTO project_diagram_grants(project_id,user_id,diagram_id) VALUES($1,$2,$3)`,[projectId,userId,id])
   }
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,'organization.access_granted',$3,$4::jsonb)`,[workspaceId,actor.id,projectId||null,JSON.stringify({userId,workspaceRoleId:workspaceRoleId||null,projectId:projectId||null,projectRoleId:projectRoleId||null,diagramCount:diagramIds?.length??null})])
   await c.query('COMMIT')
   if(projectId)projectEvents.revokeUser(projectId,userId)
   return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.delete<{Params:BaseParams;Body:{workspaceId?:string;projectId?:string}}>('/api/v1/organizations/:organizationId/members/:userId/grants',async req=>{
  const {organizationId,userId}=req.params;assertUUID(organizationId);assertUUID(userId)
  const actor=await identity(req);await orgManager(organizationId,actor.id)
  const b=getBody(req.body),workspaceId=b.workspaceId,projectId=b.projectId
  if(!isString(workspaceId))throw new DomainError('Espacio requerido',400);assertUUID(workspaceId)
  if(projectId!==undefined){if(!isString(projectId))throw new DomainError('Proyecto inválido',400);assertUUID(projectId)}
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const org=await organizationAccess(organizationId,actor.id,c);if(org!=='owner'&&org!=='admin')throw new DomainError('Acceso denegado',403)
   const space=await c.query('SELECT 1 FROM workspaces WHERE id=$1 AND organization_id=$2',[workspaceId,organizationId]);if(!space.rows[0])throw new DomainError('Espacio no encontrado',404)
   const affected=await c.query<{project_id:string}>(`SELECT project_id FROM project_members WHERE workspace_id=$1 AND user_id=$2 AND ($3::uuid IS NULL OR project_id=$3)`,[workspaceId,userId,projectId||null])
   if(projectId){const result=await c.query(`DELETE FROM project_members pm USING workspace_roles r WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.workspace_id=$3 AND pm.role_id=r.id AND r.role_key<>'owner'`,[projectId,userId,workspaceId]);if(!result.rowCount)throw new DomainError('Acceso inexistente o propietario protegido',404)}
   else{const result=await c.query(`DELETE FROM workspace_members wm USING workspace_roles r WHERE wm.workspace_id=$1 AND wm.user_id=$2 AND wm.role_id=r.id AND r.role_key<>'owner'`,[workspaceId,userId]);if(!result.rowCount)throw new DomainError('Acceso inexistente o propietario protegido',404)}
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,'organization.access_revoked',$3,$4::jsonb)`,[workspaceId,actor.id,projectId||null,JSON.stringify({userId,projectId:projectId||null})])
   await c.query('COMMIT');for(const x of affected.rows)projectEvents.revokeUser(x.project_id,userId)
   return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
}
