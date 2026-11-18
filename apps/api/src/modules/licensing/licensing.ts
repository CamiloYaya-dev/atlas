import {pool} from '../../db/pool'
import {DomainError,notFound} from '../../domain/errors'
import {access} from '../../security/roles'
import {resolveEntitlements,featureCodes,featureAllowed} from './licensing-policy'
import type {LicenseRow,LicenseSnapshot,FeatureCode} from './licensing-policy'
// Mantener exports públicos para compatibilidad con controladores y módulos existentes.
export {FEATURES,featureCodes,resolveEntitlements,featureAllowed} from './licensing-policy'
export type {FeatureCode,LicensePlan,LicenseStatus,LicenseSnapshot,LicenseRow} from './licensing-policy'

export async function getEntitlements(workspaceId:string):Promise<LicenseSnapshot>{
 const {rows}=await pool.query<LicenseRow>('SELECT plan_code,status,starts_at,ends_at,features FROM workspace_licenses WHERE workspace_id=$1',[workspaceId])
 return resolveEntitlements(workspaceId,rows[0]||null)
}
export async function getEntitlementsForMember(workspaceId:string,userId:string){await access(workspaceId,userId);return getEntitlements(workspaceId)}
export function requireFeature(s:LicenseSnapshot,code:FeatureCode){if(!featureAllowed(s,code))throw new DomainError('Funcionalidad no habilitada en tu licencia',403)}
/** Concesión o revocación exclusiva de administración; fecha y features comprobados. */
export async function setLicense(workspaceId:string,actorId:string,value:unknown):Promise<LicenseSnapshot>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new DomainError('Licencia inválida',400)
 const b=value as Record<string,unknown>
 const plan=b.planCode,status=b.status,starts=b.startsAt,ends=b.expiresAt
 if(!['free','pro','enterprise'].includes(String(plan))||!['active','revoked','expired'].includes(String(status)))throw new DomainError('Plan o estado inválido',400)
 const parseDate=(d:unknown):Date=>{if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(d))throw new DomainError('Fecha de licencia inválida',400);const v=new Date(d);if(Number.isNaN(v.getTime()))throw new DomainError('Fecha de licencia inválida',400);return v}
 const start=starts===undefined?new Date():parseDate(starts),end=ends===null||ends===undefined?null:parseDate(ends)
 if(end&&end<=start)throw new DomainError('La caducidad debe ser posterior al inicio',400)
 const features=b.features===undefined?{}:b.features
 if(!features||typeof features!=='object'||Array.isArray(features)||Object.entries(features).some(([k,v])=>!featureCodes.includes(k as FeatureCode)||typeof v!=='boolean'))throw new DomainError('Funcionalidad no reconocida o valor incorrecto',400)
 if(plan==='free'&&Object.values(features).some(v=>v===true))throw new DomainError('El plan gratuito no puede habilitar funciones de licencia',400)
 const c=await pool.connect()
 try{
  await c.query('BEGIN')
  const existing=await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);if(!existing.rows[0])throw notFound()
  await c.query(`INSERT INTO workspace_licenses(workspace_id,plan_code,status,starts_at,ends_at,features,updated_by)
   VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(workspace_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,features=EXCLUDED.features,updated_by=EXCLUDED.updated_by,updated_at=now()`,[workspaceId,plan,status,start,end,JSON.stringify(features),actorId])
  await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[workspaceId,actorId,'license.changed',workspaceId,JSON.stringify({plan,status,startsAt:start.toISOString(),expiresAt:end?.toISOString()||null,features})])
  await c.query('COMMIT')
 }catch(err){await c.query('ROLLBACK');throw err}finally{c.release()}
 return getEntitlements(workspaceId)
}
