/** Atomically materialize fields created inside a template and resolve their bindings.
 * A template can reuse existing form fields; it cannot create an orphan input.
 */
import type {PoolClient} from 'pg'
import {DomainError} from '../../domain/errors'
import {validateField} from './functional.policy'
import type {FunctionalKind,TemplateElement} from './functional.policy'

const builtinKeys=new Set(['code','title','createdAt','updatedAt','reviewDate','module','feature','scenario','steps','expected','obtained','functionalState','findingType','impact','environment','reviewerId','findingStatus','observations','jira','description','priority','status','acceptanceCriteria','businessValue','role','goal','benefit','processName','assessmentDate','scope','observedBehavior','assessmentResult'])
export const BOUND_KINDS=new Set(['field','image','table','list','checkbox','text'])
export type NewTemplateField={clientId:string;name:string;fieldType:string;required?:boolean;options?:string[]}
export function templateFieldsPayload(value:unknown):NewTemplateField[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>100)throw new DomainError('Máximo 100 campos nuevos por plantilla',400)
 const ids=new Set<string>()
 return value.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw new DomainError('Campo de plantilla inválido',400)
  const x=item as Record<string,unknown>
  if(typeof x.clientId!=='string'||!/^pending:[0-9a-f-]{36}$/i.test(x.clientId)||ids.has(x.clientId))throw new DomainError('Identificador provisional de campo inválido o duplicado',400)
  ids.add(x.clientId)
  const f=validateField(x)
  return {clientId:x.clientId,...f}
 })
}
export async function resolveTemplateFields(c:PoolClient,projectId:string,kind:FunctionalKind,layout:TemplateElement[],newFields:NewTemplateField[]):Promise<TemplateElement[]>{
 const mapping=new Map<string,string>()
 const references=new Set(layout.map(e=>e.field).filter((v):v is string=>!!v))
 if(newFields.some(f=>!references.has(f.clientId)))throw new DomainError('Hay campos nuevos que no aparecen en la plantilla',400)
 for(const f of newFields){
  const row=await c.query<{id:string}>("INSERT INTO functional_fields(project_id,kind,name,field_type,required,options,scope) VALUES($1,$2,$3,$4,$5,$6::jsonb,'template') RETURNING id",[projectId,kind,f.name,f.fieldType,f.required,JSON.stringify(f.options)])
  mapping.set(f.clientId,`custom:${row.rows[0].id}`)
 }
 const resolved=layout.map(element=>({...element,...(element.field?{field:mapping.get(element.field)||element.field}:{})}))
 const found=await c.query<{id:string;field_type:string}>('SELECT id,field_type FROM functional_fields WHERE project_id=$1 AND kind=$2',[projectId,kind])
 const types=new Map(found.rows.map(f=>[f.id,f.field_type]))
 const requiredType:Record<string,string[]>={image:['image'],table:['table'],checkbox:['boolean'],list:['list','multi_select','checkbox_group']}
 for(const element of resolved){
  if(!element.field)continue // legacy static decorations remain valid
  if(builtinKeys.has(element.field)){
   // Compatibilidad: los diseños anteriores podían vincular casillas a campos fijos.
   continue
  }
  if(!element.field.startsWith('custom:')||!types.has(element.field.slice(7)))throw new DomainError('La plantilla hace referencia a un campo que no existe en el formulario',400)
  if(requiredType[element.kind]&&!requiredType[element.kind].includes(types.get(element.field.slice(7))!))throw new DomainError(`El componente ${element.kind} requiere un tipo de campo compatible`,400)
 }
 return resolved
}
