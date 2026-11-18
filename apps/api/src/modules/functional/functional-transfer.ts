/** Portable, project-scoped form/template schema bundles. Never export actual records. */
import type {PoolClient} from 'pg'
import {DomainError} from '../../domain/errors'
import {FUNCTIONAL_KINDS,validateField,validateTemplate} from './functional.policy'
import {resolveTemplateFields} from './functional-template-fields'
import type {FunctionalKind,TemplateElement} from './functional.policy'

export const TRANSFER_FORMAT='ATLAS-FUNCTIONAL-SCHEMAS'
export type Scope='none'|'form'|'template'|'both'
export type TransferSelection=Record<FunctionalKind,Scope>
export type PortableField={id:string;name:string;fieldType:string;required:boolean;options:string[];scope:'global'|'template'}
export type PortableTemplate={name:string;paper:string;orientation:string;pageCount:number;isDefault:boolean;layout:TemplateElement[]}
export type PortableSegment={form?:{fields:PortableField[]};templates?:PortableTemplate[];fieldDependencies?:PortableField[]}
export type FunctionalBundle={format:typeof TRANSFER_FORMAT;version:1;exportedAt:string;selections:TransferSelection;kinds:Partial<Record<FunctionalKind,PortableSegment>>}
const scopes=['none','form','template','both']
const fieldsRow=(r:Record<string,unknown>):PortableField=>({id:String(r.id),name:String(r.name),fieldType:String(r.field_type),required:r.required===true,options:Array.isArray(r.options)?r.options as string[]:[],scope:r.scope==='template'?'template':'global'})
export function validateTransferSelection(value:unknown):TransferSelection{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new DomainError('Selecciona qué exportar para cada tipo documental',400)
 const data=value as Record<string,unknown>,out={} as TransferSelection
 for(const kind of FUNCTIONAL_KINDS){const choice=data[kind]??'none';if(!scopes.includes(String(choice)))throw new DomainError('Opción de transferencia inválida',400);out[kind]=choice as Scope}
 if(Object.values(out).every(x=>x==='none'))throw new DomainError('Selecciona al menos un formulario o plantilla',400)
 return out
}
export async function exportFunctionalBundle(c:PoolClient,projectId:string,selections:TransferSelection,templateIds?:Record<string,string[]>):Promise<FunctionalBundle>{
 if(templateIds!==undefined){
  if(!templateIds||typeof templateIds!=='object'||Array.isArray(templateIds)||Object.keys(templateIds).some(k=>!FUNCTIONAL_KINDS.includes(k as FunctionalKind)))throw new DomainError('Selección de plantillas inválida',400)
  for(const value of Object.values(templateIds))if(!Array.isArray(value)||value.length>80||value.some(id=>typeof id!=='string'||!uuid.test(id)))throw new DomainError('Los IDs de plantillas deben ser UUID válidos',400)
 }
 const result:FunctionalBundle={format:TRANSFER_FORMAT,version:1,exportedAt:new Date().toISOString(),selections,kinds:{}}
 for(const kind of FUNCTIONAL_KINDS){const scope=selections[kind];if(scope==='none')continue
  const all=(await c.query<Record<string,unknown>>('SELECT id,name,field_type,required,options,scope FROM functional_fields WHERE project_id=$1 AND kind=$2 ORDER BY name',[projectId,kind])).rows.map(fieldsRow)
  const section:PortableSegment={}
  if(scope==='form'||scope==='both')section.form={fields:all}
  if(scope==='template'||scope==='both'){
   const templates=(await c.query<Record<string,unknown>>('SELECT id,name,paper,orientation,page_count,is_default,layout FROM functional_templates WHERE project_id=$1 AND kind=$2 ORDER BY name',[projectId,kind])).rows
   const allowedIds=templateIds?.[kind]
   const chosen=allowedIds&&allowedIds.length?templates.filter(t=>allowedIds.includes(String(t.id))):templates
   if(allowedIds&&allowedIds.some(id=>!chosen.some(t=>t.id===id)))throw new DomainError('La plantilla seleccionada no pertenece al proyecto',400)
   section.templates=chosen.map(t=>({name:String(t.name),paper:String(t.paper),orientation:String(t.orientation),pageCount:Number(t.page_count||1),isDefault:t.is_default===true,layout:t.layout as TemplateElement[]}))
   const needed=new Set(chosen.flatMap(t=>(t.layout as TemplateElement[]).map(x=>x.field?.startsWith('custom:')?x.field.slice(7):'').filter(Boolean)))
   section.fieldDependencies=all.filter(f=>needed.has(f.id))
  }
  result.kinds[kind]=section
 }
 return result
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseFunctionalBundle(data:unknown):FunctionalBundle{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new DomainError('Paquete JSON inválido',400)
 const obj=data as Record<string,unknown>
 if(obj.format!==TRANSFER_FORMAT||obj.version!==1||!obj.kinds||typeof obj.kinds!=='object'||Array.isArray(obj.kinds))throw new DomainError('Formato o versión de paquete funcional incompatible',400)
 const selections=validateTransferSelection(obj.selections),kinds=obj.kinds as Record<string,unknown>
 if(Object.keys(kinds).some(k=>!FUNCTIONAL_KINDS.includes(k as FunctionalKind)))throw new DomainError('El paquete incluye tipos desconocidos',400)
 const result:FunctionalBundle={format:TRANSFER_FORMAT,version:1,exportedAt:typeof obj.exportedAt==='string'?obj.exportedAt:'',selections,kinds:{}}
 for(const kind of FUNCTIONAL_KINDS){const scope=selections[kind];if(scope==='none')continue
  const raw=kinds[kind];if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new DomainError(`Falta la información de ${kind}`,400)
  const section=raw as Record<string,unknown>
  const parseFields=(value:unknown)=>{if(!Array.isArray(value)||value.length>200)throw new DomainError('Lista de campos inválida',400)
   return value.map((v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new DomainError('Campo de transferencia inválido',400);const x=v as Record<string,unknown>;if(typeof x.id!=='string'||!uuid.test(x.id))throw new DomainError('ID de campo de origen inválido',400);const validated=validateField(x);return {id:x.id,...validated,scope:x.scope==='template'?'template' as const:'global' as const}})
  }
  const next:PortableSegment={}
  if(scope==='form'||scope==='both'){
   if(!section.form||typeof section.form!=='object'||Array.isArray(section.form))throw new DomainError('Falta el formulario',400)
   next.form={fields:parseFields((section.form as Record<string,unknown>).fields)}
  }
  if(scope==='template'||scope==='both'){
   if(!Array.isArray(section.templates)||section.templates.length>80)throw new DomainError('Lista de plantillas inválida',400)
   next.templates=section.templates.map(t=>validateTemplate({...t as object,kind}))
   next.fieldDependencies=parseFields(section.fieldDependencies||[])
  }
  result.kinds[kind]=next
 }
 return result
}
export async function importFunctionalBundle(c:PoolClient,projectId:string,userId:string,bundle:FunctionalBundle){
 let addedFields=0,reusedFields=0,addedTemplates=0
 for(const kind of FUNCTIONAL_KINDS){const section=bundle.kinds[kind];if(!section)continue
  const incoming=[...(section.form?.fields||[]),...(section.fieldDependencies||[])]
  const idMap=new Map<string,string>()
  for(const original of incoming){
   const f=section.templates?.length?original:{...original,scope:'global' as const}
   if(idMap.has(f.id))continue
   const used=await c.query<{id:string;name:string;field_type:string;required:boolean;options:string[];scope:'global'|'template'}>('SELECT id,name,field_type,required,options,scope FROM functional_fields WHERE project_id=$1 AND kind=$2',[projectId,kind])
   const same=used.rows.find(x=>x.name===f.name&&x.field_type===f.fieldType&&x.required===f.required&&x.scope===f.scope&&JSON.stringify(x.options)===JSON.stringify(f.options))
   if(same){idMap.set(f.id,same.id);reusedFields++;continue}
   let name=f.name,index=1
   while(used.rows.some(x=>x.name===name)){index++;name=`${f.name.slice(0,75)} (importado ${index})`}
   const inserted=await c.query<{id:string}>('INSERT INTO functional_fields(project_id,kind,name,field_type,required,options,scope) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id',[projectId,kind,name,f.fieldType,f.required,JSON.stringify(f.options),f.scope])
   idMap.set(f.id,inserted.rows[0].id);addedFields++
  }
  for(const t of section.templates||[]){
   const layout=t.layout.map(e=>{
    if(!e.field?.startsWith('custom:'))return e
    const mapped=idMap.get(e.field.slice(7))
    if(!mapped)throw new DomainError(`Campo ${e.field} no incluido en el paquete de plantilla`,400)
    return {...e,field:'custom:'+mapped}
   })
   const verifiedLayout=await resolveTemplateFields(c,projectId,kind,layout,[])
   const existing=await c.query<{name:string}>('SELECT name FROM functional_templates WHERE project_id=$1 AND kind=$2',[projectId,kind])
   let name=t.name,index=1
   while(existing.rows.some(x=>x.name===name)){index++;name=`${t.name.slice(0,95)} (${index})`}
   const currentDefault=await c.query('SELECT id FROM functional_templates WHERE project_id=$1 AND kind=$2 AND is_default=true',[projectId,kind])
   const isDefault=t.isDefault&&!currentDefault.rowCount
   await c.query('INSERT INTO functional_templates(project_id,kind,name,paper,orientation,page_count,layout,is_default,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$9)',[projectId,kind,name,t.paper,t.orientation,t.pageCount,JSON.stringify(verifiedLayout),isDefault,userId])
   addedTemplates++
  }
 }
 return {addedFields,reusedFields,addedTemplates}
}
