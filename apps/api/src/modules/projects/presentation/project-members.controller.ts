import type {FastifyInstance} from 'fastify'
import {pool} from '../../../db/pool'
import {identity} from '../../../security/identity'
import {assertUUID,DomainError,notFound} from '../../../domain/errors'
import {projectAccess,requirePermission,allowed} from '../../../security/roles'
import {projectEvents} from '../realtime/project-events'
import {requireOrganizationManagerForProject} from '../../organizations/organization-access-policy'

export async function registerProjectMembersController(app:FastifyInstance){
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/members',async req=>{
  assertUUID(req.params.projectId);const actor=await identity(req)
  const me=await projectAccess(req.params.projectId,actor.id);requirePermission(me,'project.members.manage')
  const {rows}=await pool.query(`SELECT u.id,u.email,u.display_name AS name,r.id AS role_id,r.role_key,r.name AS role_name
    FROM project_members m JOIN novzi_users u ON u.id=m.user_id JOIN workspace_roles r ON r.id=m.role_id
    WHERE m.project_id=$1 ORDER BY u.email`,[req.params.projectId]);return rows
 })
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/candidates',async req=>{
  assertUUID(req.params.projectId);const actor=await identity(req)
  const me=await projectAccess(req.params.projectId,actor.id);requirePermission(me,'project.members.manage')
  const {rows}=await pool.query<{workspace_id:string;organization_id:string|null}>(`SELECT p.workspace_id,w.organization_id FROM projects p JOIN workspaces w ON w.id=p.workspace_id WHERE p.id=$1`,[req.params.projectId]);if(!rows[0])throw notFound()
  const q=String((req.query as {q?:string})?.q??'').trim();if(q.length>100)throw new DomainError('Búsqueda demasiado larga',400)
  const [users,roles]=await Promise.all([
   rows[0].organization_id?
    pool.query(`SELECT u.id,u.email,u.display_name AS name FROM organization_members om JOIN novzi_users u ON u.id=om.user_id AND u.active=true
     WHERE om.organization_id=$1 AND ($2='' OR u.email ILIKE '%'||$2||'%' OR u.display_name ILIKE '%'||$2||'%')
     ORDER BY u.display_name,u.email LIMIT 50`,[rows[0].organization_id,q]):
    pool.query(`SELECT u.id,u.email,u.display_name AS name FROM workspace_members wm JOIN novzi_users u ON u.id=wm.user_id AND u.active=true WHERE wm.workspace_id=$1 AND ($2='' OR u.email ILIKE '%'||$2||'%' OR u.display_name ILIKE '%'||$2||'%') ORDER BY u.email LIMIT 50`,[rows[0].workspace_id,q]),
   pool.query(`SELECT r.id,r.name,r.role_key,COALESCE(array_agg(rp.permission) FILTER(WHERE rp.permission IS NOT NULL),'{}') AS permissions FROM workspace_roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id WHERE r.workspace_id=$1 AND r.role_key<>'owner' GROUP BY r.id ORDER BY r.name`,[rows[0].workspace_id])
  ]);return {users:users.rows,roles:roles.rows.filter((r:any)=>me.roleKey==='owner'||(r.permissions as string[]).every(key=>allowed(me,key)))}
 })
 app.put<{Params:{projectId:string;userId:string}}>('/api/v1/projects/:projectId/members/:userId',async req=>{
  assertUUID(req.params.projectId);assertUUID(req.params.userId)
  const body=req.body as {roleId?:unknown}|null
  if(!body||typeof body.roleId!=='string')throw new DomainError('Rol del proyecto requerido',400)
  assertUUID(body.roleId);const actor=await identity(req),c=await pool.connect()
  try{await c.query('BEGIN')
   const locked=await c.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1 FOR UPDATE',[req.params.projectId]);if(!locked.rows[0])throw notFound()
   const ac=await projectAccess(req.params.projectId,actor.id,c);requirePermission(ac,'project.members.manage')
   await requireOrganizationManagerForProject(req.params.projectId,actor.id,c)
   const ws=locked.rows[0].workspace_id
   const organization=await c.query<{organization_id:string|null}>('SELECT organization_id FROM workspaces WHERE id=$1',[ws])
   const orgId=organization.rows[0]?.organization_id
   if(orgId){
    const belongs=await c.query(`SELECT om.user_id FROM organization_members om JOIN novzi_users u ON u.id=om.user_id AND u.active=true WHERE om.organization_id=$1 AND om.user_id=$2`,[orgId,req.params.userId])
    if(!belongs.rows[0])throw new DomainError('Usuario no pertenece a esta organización',403)
    // Acceso mínimo al espacio para poder asignar el proyecto, sin otros proyectos.
    const wsMember=await c.query('SELECT user_id FROM workspace_members WHERE workspace_id=$1 AND user_id=$2',[ws,req.params.userId])
    if(!wsMember.rows[0]){
     const viewer=await c.query<{id:string}>(`SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'`,[ws])
     if(!viewer.rows[0])throw new DomainError('El espacio no tiene política de lector',409)
     await c.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'viewer',$3)`,[ws,req.params.userId,viewer.rows[0].id])
    }
   }else{
    const candidate=await c.query('SELECT wm.user_id FROM workspace_members wm JOIN novzi_users u ON u.id=wm.user_id AND u.active=true WHERE wm.workspace_id=$1 AND wm.user_id=$2',[ws,req.params.userId])
    if(!candidate.rows[0])throw new DomainError('El usuario debe estar activo y ser miembro del espacio',400)
   }
   const role=await c.query<{role_key:string}>(`SELECT role_key FROM workspace_roles WHERE workspace_id=$1 AND id=$2`,[ws,body.roleId]);if(!role.rows[0]||role.rows[0].role_key==='owner')throw new DomainError('No se puede asignar la política de propietario',403)
   const original=await c.query<{role_key:string}>(`SELECT r.role_key FROM project_members m JOIN workspace_roles r ON r.id=m.role_id WHERE m.project_id=$1 AND m.user_id=$2`,[req.params.projectId,req.params.userId]);if(original.rows[0]?.role_key==='owner')throw new DomainError('El propietario del proyecto está protegido',403)
   if(ac.roleKey!=='owner'){
    const granted=await c.query<{permission:string}>('SELECT permission FROM role_permissions WHERE role_id=$1',[body.roleId]);if(!granted.rows.every(p=>allowed(ac,p.permission)))throw new DomainError('No puedes conceder permisos que no tienes',403)
   }
   await c.query(`INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(project_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id`,[req.params.projectId,ws,req.params.userId,body.roleId])
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,'project.membership_changed',$3,$4::jsonb)`,[ws,actor.id,req.params.projectId,JSON.stringify({userId:req.params.userId,roleId:body.roleId})])
   await c.query('COMMIT');projectEvents.revokeUser(req.params.projectId,req.params.userId);return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.delete<{Params:{projectId:string;userId:string}}>('/api/v1/projects/:projectId/members/:userId',async req=>{
  assertUUID(req.params.projectId);assertUUID(req.params.userId);const actor=await identity(req),c=await pool.connect()
  try{await c.query('BEGIN')
   const locked=await c.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1 FOR UPDATE',[req.params.projectId]);if(!locked.rows[0])throw notFound()
   const me=await projectAccess(req.params.projectId,actor.id,c);requirePermission(me,'project.members.manage')
   await requireOrganizationManagerForProject(req.params.projectId,actor.id,c)
   const {rowCount}=await c.query(`DELETE FROM project_members pm USING workspace_roles r WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.role_id=r.id AND r.role_key<>'owner'`,[req.params.projectId,req.params.userId]);if(!rowCount)throw new DomainError('Miembro no encontrado o propietario protegido',404)
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,'project.membership_removed',$3,$4::jsonb)`,[locked.rows[0].workspace_id,actor.id,req.params.projectId,JSON.stringify({userId:req.params.userId})])
   await c.query('COMMIT');projectEvents.revokeUser(req.params.projectId,req.params.userId);return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
}
