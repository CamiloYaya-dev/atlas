import type {PoolClient} from 'pg'
import {pool} from '../../db/pool'
import {DomainError} from '../../domain/errors'

/** Las altas y modificaciones de membresía se administran exclusivamente desde la organización.
 * Espacios legados sin organization_id continúan con el esquema de permisos original.
 */
export async function requireOrganizationManagerForWorkspace(workspaceId:string,userId:string,db:PoolClient|typeof pool=pool){
 const {rows}=await db.query<{organization_id:string|null;role:string|null}>(`SELECT w.organization_id,m.role FROM workspaces w
  LEFT JOIN organization_members m ON m.organization_id=w.organization_id AND m.user_id=$2
  WHERE w.id=$1`,[workspaceId,userId])
 if(!rows[0])throw new DomainError('Espacio no encontrado',404)
 if(rows[0].organization_id&&rows[0].role!=='owner'&&rows[0].role!=='admin')throw new DomainError('Solo administradores de organización pueden asignar cuentas y permisos',403)
}
export async function requireOrganizationManagerForProject(projectId:string,userId:string,db:PoolClient|typeof pool=pool){
 const {rows}=await db.query<{workspace_id:string}>(`SELECT workspace_id FROM projects WHERE id=$1`,[projectId])
 if(!rows[0])throw new DomainError('Proyecto no encontrado',404)
 await requireOrganizationManagerForWorkspace(rows[0].workspace_id,userId,db)
}
