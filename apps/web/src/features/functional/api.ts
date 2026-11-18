import {request} from '../../shared/api/http'
export type FunctionalKind='finding'|'rf'|'rnf'|'story'
export const FUNCTIONAL_KINDS:FunctionalKind[]=['finding','rf','rnf','story']
export const KIND_LABELS:Record<FunctionalKind,string>={finding:'Hallazgos',rf:'Requerimientos funcionales',rnf:'Requerimientos no funcionales',story:'Historias de usuario'}
export type FunctionalPayload={reviewDate?:string;module?:string;feature?:string;scenario?:string;steps?:string[];expected?:string;obtained?:string;functionalState?:string;findingType?:string;impact?:string;environment?:string;reviewerId?:string;findingStatus?:string;observations?:string;jira?:string;description?:string;priority?:string;acceptanceCriteria?:string[];businessValue?:string;role?:string;goal?:string;benefit?:string;status?:string;custom?:Record<string,unknown>;evidenceLinks?:EvidenceLink[]}
export type EvidenceLink={id:string;label:string;url:string}
export type FunctionalItem={id:string;projectId:string;kind:FunctionalKind;number:number;code:string;title:string;templateId:string|null;payload:FunctionalPayload;version:number;createdAt:string;updatedAt:string;createdBy:string;updatedBy:string}
export type FunctionalField={id:string;kind:FunctionalKind;name:string;fieldType:'text'|'long'|'number'|'currency'|'date'|'time'|'datetime'|'boolean'|'select'|'multi_select'|'checkbox_group'|'list'|'table'|'image'|'url'|'email';required:boolean;options:string[];scope?:'global'|'template'}
export type FunctionalLink={id:string;targetType:'record'|'diagram'|'node'|'edge';targetId:string;diagramId:string|null;label:string}
export type FunctionalAttachment={id:string;fileName:string;mimeType:string;size?:number;createdAt?:string}
export type Paper='A4'|'LETTER'
export type TemplateElement={name?:string;page?:number;rows?:number;cols?:number;cells?:string[][];ordered?:boolean;checked?:boolean;id:string;kind:'field'|'text'|'image'|'line'|'table'|'checkbox'|'list';field?:string;text?:string;image?:string;x:number;y:number;width:number;height:number;fontSize:number;fontFamily:'Arial'|'Helvetica'|'Times New Roman'|'Courier New';bold?:boolean;italic?:boolean;color?:string;align?:'left'|'center'|'right'}
export type FunctionalTemplate={id:string;kind:FunctionalKind;name:string;paper:Paper;orientation:'portrait'|'landscape';pageCount:number;layout:TemplateElement[];version:number;isDefault:boolean}
const root=(p:string)=>`/projects/${encodeURIComponent(p)}/functional`
const json=(payload:unknown)=>({method:'POST',body:JSON.stringify(payload)})
export const listReviewers=(p:string)=>request<{id:string;name:string;email:string}[]>(root(p)+'/reviewers')
export const listItems=(p:string,kind?:FunctionalKind)=>request<FunctionalItem[]>(root(p)+`/items${kind?'?kind='+encodeURIComponent(kind):''}`)
export const createItem=(p:string,kind:FunctionalKind,title:string,payload:FunctionalPayload,templateId:string|null)=>request<FunctionalItem>(root(p)+'/items',json({kind,title,payload,templateId}))
export const saveItem=(p:string,item:FunctionalItem)=>request<FunctionalItem>(root(p)+`/items/${encodeURIComponent(item.id)}`,{method:'PUT',body:JSON.stringify({title:item.title,payload:item.payload,templateId:item.templateId,expectedVersion:item.version})})
export const deleteItem=(p:string,item:FunctionalItem)=>request<{ok:boolean}>(root(p)+`/items/${encodeURIComponent(item.id)}`,{method:'DELETE',body:JSON.stringify({expectedVersion:item.version})})
export const listFields=(p:string,kind?:FunctionalKind)=>request<FunctionalField[]>(root(p)+`/fields${kind?'?kind='+encodeURIComponent(kind):''}`)
export const createField=(p:string,kind:FunctionalKind,name:string,fieldType:FunctionalField['fieldType'],required:boolean,options:string[])=>request<FunctionalField>(root(p)+'/fields',json({kind,name,fieldType,required,options}))
export const deleteField=(p:string,id:string)=>request<{ok:boolean}>(root(p)+`/fields/${encodeURIComponent(id)}`,{method:'DELETE'})
export const listLinks=(p:string,itemId:string)=>request<FunctionalLink[]>(root(p)+`/items/${encodeURIComponent(itemId)}/links`)
export const addLink=(p:string,itemId:string,data:Omit<FunctionalLink,'id'>)=>request<FunctionalLink>(root(p)+`/items/${encodeURIComponent(itemId)}/links`,json(data))
export const deleteLink=(p:string,itemId:string,id:string)=>request<{ok:boolean}>(root(p)+`/items/${encodeURIComponent(itemId)}/links/${encodeURIComponent(id)}`,{method:'DELETE'})
export const listAttachments=(p:string,itemId:string)=>request<FunctionalAttachment[]>(root(p)+`/items/${encodeURIComponent(itemId)}/attachments`)
export const uploadAttachment=(p:string,itemId:string,fileName:string,mimeType:string,base64:string)=>request<FunctionalAttachment>(root(p)+`/items/${encodeURIComponent(itemId)}/attachments`,json({fileName,mimeType,base64}))
export const getAttachment=(p:string,itemId:string,id:string)=>request<{fileName:string;mimeType:string;base64:string}>(root(p)+`/items/${encodeURIComponent(itemId)}/attachments/${encodeURIComponent(id)}`)
export const deleteAttachment=(p:string,itemId:string,id:string)=>request<{ok:boolean}>(root(p)+`/items/${encodeURIComponent(itemId)}/attachments/${encodeURIComponent(id)}`,{method:'DELETE'})
export const listTemplates=(p:string,kind?:FunctionalKind)=>request<FunctionalTemplate[]>(root(p)+`/templates${kind?'?kind='+encodeURIComponent(kind):''}`)
export type TemplateFieldDraft={clientId:string;name:string;fieldType:FunctionalField['fieldType'];required:boolean;options:string[];scope?:'global'|'template'}
export const createTemplate=(p:string,data:Omit<FunctionalTemplate,'id'|'version'>,newFields:TemplateFieldDraft[]=[] )=>request<FunctionalTemplate>(root(p)+'/templates',json({...data,newFields}))
export const saveTemplate=(p:string,data:FunctionalTemplate,newFields:TemplateFieldDraft[]=[] )=>request<FunctionalTemplate>(root(p)+`/templates/${encodeURIComponent(data.id)}`,{method:'PUT',body:JSON.stringify({...data,newFields,expectedVersion:data.version})})
export const deleteTemplate=(p:string,id:string)=>request<{ok:boolean}>(root(p)+`/templates/${encodeURIComponent(id)}`,{method:'DELETE'})
export type TransferScope='none'|'form'|'template'|'both'
export type TransferSelection=Record<FunctionalKind,TransferScope>
export const TRANSFER_FORMAT='ATLAS-FUNCTIONAL-SCHEMAS'
export type FunctionalSchemaBundle={format:string;version:number;exportedAt:string;selections:TransferSelection;kinds:Record<string,unknown>}
export const exportFunctionalSchemas=(p:string,selections:TransferSelection,templateIds?:Partial<Record<FunctionalKind,string[]>>)=>request<FunctionalSchemaBundle>(root(p)+'/transfer/export',json({selections,templateIds}))
export const importFunctionalSchemas=(p:string,bundle:unknown)=>request<{addedFields:number;reusedFields:number;addedTemplates:number}>(root(p)+'/transfer/import',json({bundle}))
export function downloadJSON(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
export const exportRecord=(p:string,itemId:string,format:'pdf'|'docx'|'html',templateId?:string)=>request<{fileName:string;mimeType:string;base64:string}>(root(p)+`/items/${encodeURIComponent(itemId)}/export?format=${format}${templateId?'&templateId='+encodeURIComponent(templateId):''}`)
export function downloadBase64(name:string,mime:string,base64:string){const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500)}
export const blankPayload=(kind:FunctionalKind,userId:string):FunctionalPayload=>kind==='finding'?{reviewDate:new Date().toISOString().slice(0,10),module:'General',feature:'',scenario:'',steps:[''],expected:'',obtained:'',functionalState:'No verificado',findingType:'Comportamiento por aclarar',impact:'',environment:'Web',reviewerId:userId,findingStatus:'Pendiente de validar',observations:'',jira:'',custom:{},evidenceLinks:[]}:{description:'',priority:'Media',status:'Borrador',acceptanceCriteria:[''],businessValue:'',role:'',goal:'',benefit:'',custom:{},evidenceLinks:[]}
export const builtinFields=(kind:FunctionalKind):{key:string;label:string}[]=>[
 {key:'code',label:'ID automático'},{key:'title',label:'Título'},{key:'createdAt',label:'Fecha de creación'},{key:'updatedAt',label:'Última actualización'},
 ...(kind==='finding'?[['reviewDate','Fecha de revisión'],['module','Módulo'],['feature','Funcionalidad evaluada'],['scenario','Escenario evaluado'],['steps','Pasos realizados'],['expected','Resultado esperado'],['obtained','Resultado obtenido'],['functionalState','Estado de funcionalidad'],['findingType','Tipo de hallazgo'],['impact','Impacto identificado'],['environment','Entorno y versión'],['reviewerId','Responsable'],['findingStatus','Estado del hallazgo'],['observations','Observaciones'],['jira','Referencia Jira']]:[['description','Descripción'],['priority','Prioridad'],['status','Estado'],['acceptanceCriteria','Criterios de aceptación'],['businessValue','Valor de negocio'],...(kind==='story'?[['role','Como'],['goal','Quiero'],['benefit','Para']]:[]) ]).map(([key,label])=>({key,label}))]
