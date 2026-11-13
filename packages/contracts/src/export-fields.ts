/** Campos exportables del inspector; catálogo compartido entre frontend y servidor. */
import type {Diagram,FieldDefinition,ModelElement,ProjectDocument} from './index'

export type ExportPlacement='omit'|'embed'|'dictionary'
export type AdvancedExportMode='simple'|'embedded'|'dictionary'|'both'
export type ExportFieldChoices=Record<string,Record<string,ExportPlacement>>
export interface AdvancedExportRequest {mode:AdvancedExportMode;fields:ExportFieldChoices}
export interface ExportField {key:string;label:string;value:string}
export const EXPORT_BASE_FIELDS:ReadonlyArray<readonly [string,string]>=[
 ['summary','Resumen'],['description','Descripción'],['technical','Detalle técnico'],
 ['owner','Responsable'],['status','Estado'],['author','Autor'],
 ['createdAt','Creación'],['updatedAt','Actualización'],
 ['@links','Enlaces externos'],['@linked','Vista vinculada'],['@relations','Relaciones']
]
const stringify=(value:unknown):string=>{
 if(value===null||value===undefined)return ''
 if(typeof value==='boolean')return value?'Sí':'No'
 if(typeof value==='string'||typeof value==='number')return String(value)
 if(Array.isArray(value))return value.map(stringify).filter(Boolean).join(', ')
 return ''
}
export function availableExportFields(doc:ProjectDocument,diagram:Diagram,elementId:string):ExportField[]{
 const element=doc.elements[elementId]
 if(!element||!diagram.nodes.some(node=>node.elementId===elementId))return []
 const linked=doc.diagrams.find(v=>v.id===element.childDiagramId)
 const target=linked?.nodes.find(n=>n.id===element.childNodeId)
 const linkedName=linked?`${linked.name}${target&&doc.elements[target.elementId]?` → ${doc.elements[target.elementId].name}`:''}`:''
 const incident=diagram.edges.flatMap(edge=>{
  const source=diagram.nodes.find(n=>n.id===edge.source),target=diagram.nodes.find(n=>n.id===edge.target)
  const from=source&&doc.elements[source.elementId],to=target&&doc.elements[target.elementId]
  if(!from||!to||from.id!==elementId&&to.id!==elementId)return []
  const direction=edge.direction||'forward'
  const symbol=direction==='both'?'↔':direction==='none'?'—':direction==='reverse'?'←':'→'
  return [`${from.name} ${symbol} ${to.name}${edge.label?` (${edge.label})`:''}`]
 }).join(' | ')
 const vals:Record<string,string>={
  summary:element.summary,description:element.description,technical:element.technical||'',
  owner:element.owner,status:element.status,author:element.author,createdAt:element.createdAt,
  updatedAt:element.updatedAt,'@links':element.links.map(link=>`${link.label}: ${link.url}`).join(' | '),
  '@linked':linkedName,'@relations':incident
 }
 const standard=EXPORT_BASE_FIELDS.map(([key,label])=>({key,label,value:vals[key]||''}))
 const custom=doc.fieldDefinitions.filter((definition:FieldDefinition)=>definition.forType==='all'||definition.forType===element.type)
  .map(definition=>({key:`custom:${definition.id}`,label:definition.label,value:stringify(element.fields[definition.id])}))
 return [...standard,...custom]
}
/** El servidor reconstruye todos los campos desde el documento autorizado, nunca desde texto del cliente. */
export function validateAdvancedExport(doc:ProjectDocument,diagram:Diagram,value:unknown):AdvancedExportRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Configuración de exportación inválida')
 const input=value as Record<string,unknown>,mode=input.mode
 if(!['simple','embedded','dictionary','both'].includes(String(mode)))throw Error('Modalidad de exportación inválida')
 if(!input.fields||typeof input.fields!=='object'||Array.isArray(input.fields))throw Error('Selección de campos inválida')
 const fields=input.fields as Record<string,unknown>
 if(Object.keys(fields).length>diagram.nodes.length)throw Error('Demasiadas cajas en la selección')
 const nodesById=new Map(diagram.nodes.map(n=>[n.id,n.elementId]))
 for(const [id,selection] of Object.entries(fields)){
  if(!nodesById.has(id)||!selection||typeof selection!=='object'||Array.isArray(selection))throw Error('Caja ajena a este diagrama')
  const possible=new Set(availableExportFields(doc,diagram,nodesById.get(id)!).map(x=>x.key))
  if(Object.keys(selection).length>possible.size)throw Error('Demasiados campos para la caja')
  for(const [key,placement] of Object.entries(selection)){
   if(!possible.has(key)||!['omit','embed','dictionary'].includes(String(placement)))throw Error('Campo o destino de exportación no autorizado')
   if(placement==='embed'&&!['embedded','both'].includes(String(mode)))throw Error('Modo no permite campos embebidos')
   if(placement==='dictionary'&&!['dictionary','both'].includes(String(mode)))throw Error('Modo no permite diccionario')
  }
 }
 return {mode:mode as AdvancedExportMode,fields:fields as ExportFieldChoices}
}
export function exportFieldsFor(doc:ProjectDocument,diagram:Diagram,element:ModelElement,nodeId:string,request:AdvancedExportRequest,placement:Exclude<ExportPlacement,'omit'>):ExportField[]{
 const selected=request.fields[nodeId]||{}
 return availableExportFields(doc,diagram,element.id).filter(field=>selected[field.key]===placement&&field.value.trim())
}
