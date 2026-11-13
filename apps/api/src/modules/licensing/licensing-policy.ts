/** Registro único de funciones: añadir futuras capacidades aquí. Nunca confiar en el frontend. */
export const FEATURES={
 'diagram.export.png':{free:true,licensed:true},
 'diagram.export.jpg':{free:true,licensed:true},
 'diagram.export.clean':{free:false,licensed:true},
 'diagram.export.advanced':{free:false,licensed:true},
} as const
export type FeatureCode=keyof typeof FEATURES
export const featureCodes=Object.keys(FEATURES) as FeatureCode[]
export type LicensePlan='free'|'pro'|'enterprise'
export type LicenseStatus='active'|'revoked'|'expired'
export type LicenseSnapshot={workspaceId:string;planCode:LicensePlan;licenseActive:boolean;status:'free'|LicenseStatus;features:Record<FeatureCode,boolean>;expiresAt:string|null}
export type LicenseRow={plan_code:LicensePlan;status:LicenseStatus;starts_at:Date;ends_at:Date|null;features:Record<string,unknown>}
/** Solo activa la licencia emitida por el backend y dentro del periodo. */
export function resolveEntitlements(workspaceId:string,row:LicenseRow|null,now=new Date()):LicenseSnapshot{
 const licenseActive=!!row&&row.status==='active'&&new Date(row.starts_at)<=now&&(!row.ends_at||new Date(row.ends_at)>now)&&row.plan_code!=='free'
 const features=Object.fromEntries(featureCodes.map(k=>{
  const fallback=licenseActive?FEATURES[k].licensed:FEATURES[k].free
  // Override administrativo únicamente sobre licencia activa; nunca elevamos Free.
  return [k,licenseActive&&typeof row?.features[k]==='boolean'?row.features[k]:fallback]
 })) as Record<FeatureCode,boolean>
 return {workspaceId,planCode:licenseActive?row!.plan_code:'free',licenseActive,status:row?.status||'free',features,expiresAt:row?.ends_at?.toISOString()||null}
}

/** La decisión de funcionalidad permitida es pura y no requiere configuración de API o PostgreSQL. */
export function featureAllowed(s:LicenseSnapshot,code:FeatureCode){return s.features[code]===true}
