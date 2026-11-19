import {DomainError} from '../../domain/errors'

export type FunctionalKind='finding'|'rf'|'rnf'|'story'|'asis'
export const FUNCTIONAL_KINDS=['finding','rf','rnf','story','asis'] as const
export const FUNCTIONAL_PREFIX:Record<FunctionalKind,string>={finding:'HAL',rf:'RF',rnf:'RNF',story:'HU',asis:'ASIS'}
export type FunctionalFieldType='text'|'long'|'number'|'currency'|'date'|'time'|'datetime'|'boolean'|'select'|'multi_select'|'checkbox_group'|'list'|'table'|'image'|'url'|'email'
export const FIELD_TYPES=['text','long','number','currency','date','time','datetime','boolean','select','multi_select','checkbox_group','list','table','image','url','email'] as const
export type FunctionalPayload={reviewDate?:string;module?:string;feature?:string;scenario?:string;steps?:string[];expected?:string;obtained?:string;functionalState?:string;findingType?:string;impact?:string;environment?:string;reviewerId?:string;findingStatus?:string;observations?:string;jira?:string;description?:string;priority?:string;acceptanceCriteria?:string[];businessValue?:string;role?:string;goal?:string;benefit?:string;status?:string;processName?:string;observedBehavior?:string;scope?:string;assessmentDate?:string;assessmentResult?:string;custom?:Record<string,unknown>;evidenceLinks?:{id:string;label:string;url:string}[]}
export interface TemplateElement {name?:string;page?:number;rows?:number;cols?:number;cells?:string[][];ordered?:boolean;checked?:boolean;id:string;kind:'field'|'text'|'image'|'line'|'table'|'checkbox'|'list';field?:string;text?:string;image?:string;x:number;y:number;width:number;height:number;fontSize:number;fontFamily:'Arial'|'Helvetica'|'Times New Roman'|'Courier New';bold?:boolean;italic?:boolean;color?:string;align?:'left'|'center'|'right'}
export type FunctionalFieldDefinition={id:string;name:string;field_type:FunctionalFieldType;required:boolean;options:string[]}
const isObject=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
const string=(x:unknown,label:string,max=12000,required=false)=>{if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw new DomainError(`Campo inválido: ${label}`,400);return x.trim()}
export function functionalKind(value:unknown):FunctionalKind{if(!FUNCTIONAL_KINDS.includes(value as FunctionalKind))throw new DomainError('Tipo de registro funcional inválido',400);return value as FunctionalKind}
const date=(x:unknown,label:string)=>{const s=string(x,label,10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z')))throw new DomainError(`Fecha inválida: ${label}`,400);return s}
const steps=(x:unknown,label:string)=>{if(!Array.isArray(x)||x.length>80||!x.every(y=>typeof y==='string'&&y.length<=2000))throw new DomainError(`Lista inválida: ${label}`,400);return x.map(y=>String(y).trim()).filter(Boolean)}
const selection=(x:unknown,label:string,values:readonly string[])=>{const s=string(x,label,100,true);if(!values.includes(s))throw new DomainError(`Opción inválida: ${label}`,400);return s}
const findingStates=['Funciona','Funciona parcialmente','No funciona','No verificado'] as const
const findingTypes=['Error funcional','Comportamiento por aclarar','Oportunidad de mejora'] as const
const findingStatuses=['Pendiente de validar','Confirmado','En seguimiento','Resuelto','Validado'] as const
const asisResults=['Funciona','Funciona parcialmente','No funciona','No verificado'] as const
const genericStatuses=['Borrador','En análisis','Aprobado','En desarrollo','En QA','Finalizado'] as const
export const FUNCTIONAL_OPTIONS={findingStates,findingTypes,findingStatuses,genericStatuses}
export function validateFunctionalPayload(kind:FunctionalKind,input:unknown,fields:FunctionalFieldDefinition[]=[]):FunctionalPayload{
 if(!isObject(input))throw new DomainError('Formulario requerido',400)
 const p:FunctionalPayload={custom:{}}
 if(kind==='finding'){
  p.reviewDate=date(input.reviewDate,'fecha de revisión')
  p.module=string(input.module,'módulo / componente',160,true)
  p.feature=string(input.feature,'funcionalidad evaluada',240,true)
  p.scenario=string(input.scenario,'escenario evaluado',8000,true)
  p.steps=steps(input.steps,'pasos realizados');if(!p.steps.length)throw new DomainError('Agrega al menos un paso realizado',400)
  p.functionalState=selection(input.functionalState,'estado de funcionalidad',findingStates)
  p.findingType=selection(input.findingType,'tipo de hallazgo',findingTypes)
  p.expected=string(input.expected??'','resultado esperado',8000)
  p.obtained=string(input.obtained,'resultado obtenido',8000,true)
  p.impact=string(input.impact,'impacto',8000,true)
  p.environment=string(input.environment,'entorno y versión',500,true)
  p.reviewerId=string(input.reviewerId,'responsable de revisión',120,true)
  p.findingStatus=selection(input.findingStatus,'estado del hallazgo',findingStatuses)
  if(['Confirmado','Resuelto','Validado'].includes(p.findingStatus)&&!p.expected)throw new DomainError('Confirma el resultado esperado antes de confirmar el hallazgo',400)
  p.observations=string(input.observations??'','observaciones',8000)
  p.jira=string(input.jira??'','referencia Jira',500)
 }else if(kind==='asis'){
  p.processName=string(input.processName,'proceso o funcionalidad',240,true)
  p.assessmentDate=date(input.assessmentDate,'fecha del diagnóstico')
  p.scope=string(input.scope??'','alcance',4000)
  p.observedBehavior=string(input.observedBehavior,'comportamiento actual',12000,true)
  p.assessmentResult=selection(input.assessmentResult??'No verificado','resultado del diagnóstico',asisResults)
  p.observations=string(input.observations??'','observaciones',8000)
  p.environment=string(input.environment??'','entorno y versión',500)
 }else{
  p.description=string(input.description,'descripción',12000,true)
  p.priority=selection(input.priority??'Media','prioridad',['Baja','Media','Alta','Crítica'])
  p.status=selection(input.status??'Borrador','estado',genericStatuses)
  p.acceptanceCriteria=steps(input.acceptanceCriteria??[],'criterios de aceptación')
  p.businessValue=string(input.businessValue??'','valor de negocio',8000)
  if(kind==='story'){
   p.role=string(input.role,'como',500,true);p.goal=string(input.goal,'quiero',2000,true);p.benefit=string(input.benefit,'para',2000,true)
  }
 }
 const custom=isObject(input.custom)?input.custom:{}
 for(const field of fields){
  let value=custom[field.id]
  const missing=value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length)
  if(missing){if(field.required)throw new DomainError(`Campo personalizado requerido: ${field.name}`,400);continue}
  const k=field.field_type
  if(k==='boolean'){
   if(typeof value!=='boolean')throw new DomainError(`Tipo inválido: ${field.name}`,400)
  }else if(k==='number'||k==='currency'){
   if(typeof value!=='number'||!Number.isFinite(value))throw new DomainError(`Número inválido: ${field.name}`,400)
  }else if(k==='multi_select'||k==='checkbox_group'||k==='list'){
   if(!Array.isArray(value)||value.length>80||!value.every(x=>typeof x==='string'&&x.length<=1000))throw new DomainError(`Lista inválida: ${field.name}`,400)
   if(k!=='list'&&value.some(x=>!field.options.includes(x)))throw new DomainError(`Opción inválida: ${field.name}`,400)
   value=[...new Set(value.map(x=>x.trim()).filter(Boolean))]
   if(k==='list'&&(value as string[]).length>60)throw new DomainError('Máximo 60 entradas',400)
   if(field.required&&!(value as string[]).length)throw new DomainError(`Campo personalizado requerido: ${field.name}`,400)
  }else if(k==='table'){
   if(!Array.isArray(value)||value.length>20||!value.every(row=>Array.isArray(row)&&row.length<=12&&row.every(cell=>typeof cell==='string'&&cell.length<=1000)))throw new DomainError(`Tabla inválida: ${field.name}`,400)
   if(field.required&&!value.some(row=>(row as string[]).some(cell=>cell.trim())))throw new DomainError(`Campo personalizado requerido: ${field.name}`,400)
  }else if(k==='image'){
   if(typeof value!=='string'||value.length>400000||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new DomainError(`Imagen inválida: ${field.name}`,400)
  }else{
   if(typeof value!=='string'||value.length>8000)throw new DomainError(`Texto inválido: ${field.name}`,400)
   value=value.trim()
   const textValue=value as string
   if(k==='select'&&!field.options.includes(textValue))throw new DomainError(`Selección inválida: ${field.name}`,400)
   if(k==='date')date(textValue,field.name)
   if(k==='url')safeUrl(textValue)
   if(k==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue))throw new DomainError(`Email inválido: ${field.name}`,400)
   if(k==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(textValue))throw new DomainError(`Hora inválida: ${field.name}`,400)
   if(k==='datetime'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(textValue)||!Number.isFinite(Date.parse(textValue))))throw new DomainError(`Fecha y hora inválidas: ${field.name}`,400)
  }
  p.custom![field.id]=value
 }
 if(input.evidenceLinks!==undefined){if(!Array.isArray(input.evidenceLinks)||input.evidenceLinks.length>100)throw new DomainError('Demasiados vínculos de evidencia',400)
  p.evidenceLinks=input.evidenceLinks.map((v:unknown)=>{if(!isObject(v))throw new DomainError('Evidencia inválida',400);return {id:string(v.id,'id evidencia',100,true),label:string(v.label,'nombre evidencia',200,true),url:safeUrl(v.url)}})
 }
 return p
}
export function safeUrl(value:unknown){const url=string(value,'enlace URL',2048,true);try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error();return parsed.toString()}catch{throw new DomainError('La evidencia debe utilizar una URL HTTPS o HTTP',400)}}
export function validateField(input:unknown){if(!isObject(input))throw new DomainError('Campo personalizado inválido',400);const name=string(input.name,'nombre de campo',100,true);if(name.length<2)throw new DomainError('Nombre demasiado corto',400);if(!FIELD_TYPES.includes(input.fieldType as FunctionalFieldType))throw new DomainError('Tipo de campo inválido',400);const fieldType=input.fieldType as FunctionalFieldType;const options=['select','multi_select','checkbox_group'].includes(fieldType)?steps(input.options??[],'opciones'):[];if(['select','multi_select','checkbox_group'].includes(fieldType)&&!options.length)throw new DomainError('Una lista requiere opciones',400);return {name,fieldType,required:input.required===true,options}}
export function validateTemplate(input:unknown){
 if(!isObject(input))throw new DomainError('Plantilla inválida',400)
 const name=string(input.name,'nombre de plantilla',120,true),kind=functionalKind(input.kind)
 const paper:'A4'|'LETTER'=input.paper==='LETTER'?'LETTER':'A4',orientation:'portrait'|'landscape'=input.orientation==='landscape'?'landscape':'portrait'
 const pageCount=input.pageCount===undefined?1:input.pageCount
 if(!Number.isInteger(pageCount)||Number(pageCount)<1||Number(pageCount)>20)throw new DomainError('Una plantilla admite entre 1 y 20 páginas',400)
 const layout=input.layout
 if(!Array.isArray(layout)||layout.length>300)throw new DomainError('Máximo 300 componentes por plantilla',400)
 const elements:TemplateElement[]=layout.map((v:unknown)=>{
  if(!isObject(v)||!['field','text','image','line','table','checkbox','list'].includes(String(v.kind)))throw new DomainError('Elemento de plantilla inválido',400)
  const page=v.page===undefined?0:v.page
  if(!Number.isInteger(page)||Number(page)<0||Number(page)>=Number(pageCount))throw new DomainError('Página de componente inválida',400)
  for(const d of ['x','y','width','height','fontSize'] as const){if(typeof v[d]!=='number'||!Number.isFinite(v[d])||v[d]<0||v[d]>1000)throw new DomainError(`Dimensión inválida: ${d}`,400)}
  if(Number(v.width)<1||Number(v.height)<.5||Number(v.fontSize)<5||Number(v.fontSize)>64)throw new DomainError('Dimensiones fuera del rango permitido',400)
  if(v.kind==='image'&&typeof v.image==='string'&&(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image)||v.image.length>400000))throw new DomainError('Solo imágenes PNG/JPG/WebP de hasta 300 KB',400)
  const rows=v.kind==='table'?v.rows??3:undefined,cols=v.kind==='table'?v.cols??3:undefined
  if(v.kind==='table'&&(!Number.isInteger(rows)||!Number.isInteger(cols)||Number(rows)<1||Number(rows)>20||Number(cols)<1||Number(cols)>12))throw new DomainError('La tabla admite 1–20 filas y 1–12 columnas',400)
  const rawCells=v.cells
  if(v.kind==='table'&&rawCells!==undefined&&(!Array.isArray(rawCells)||rawCells.length>20||!rawCells.every(row=>Array.isArray(row)&&row.length<=12&&row.every(cell=>typeof cell==='string'&&cell.length<=1000))))throw new DomainError('Celdas de tabla inválidas',400)
  const cells=v.kind==='table'?Array.from({length:Number(rows)},(_,r)=>Array.from({length:Number(cols)},(_,c)=>typeof (rawCells as string[][]|undefined)?.[r]?.[c]==='string'?(rawCells as string[][])[r][c]:'')):undefined
  return {id:string(v.id,'identificador',100,true),name:typeof v.name==='string'?string(v.name,'nombre de componente',100):undefined,kind:v.kind as TemplateElement['kind'],page:Number(page),rows:rows as number|undefined,cols:cols as number|undefined,cells,checked:v.checked===true,ordered:v.ordered===true,field:typeof v.field==='string'?v.field.slice(0,160):undefined,text:typeof v.text==='string'?v.text.slice(0,4000):undefined,image:typeof v.image==='string'?v.image:undefined,x:v.x as number,y:v.y as number,width:v.width as number,height:v.height as number,fontSize:v.fontSize as number,fontFamily:['Arial','Helvetica','Times New Roman','Courier New'].includes(String(v.fontFamily))?v.fontFamily as TemplateElement['fontFamily']:'Arial',bold:v.bold===true,italic:v.italic===true,color:typeof v.color==='string'&&/^#[0-9A-Fa-f]{6}$/.test(v.color)?v.color:'#1f2937',align:['left','center','right'].includes(String(v.align))?v.align as TemplateElement['align']:'left'}
 })
 if(new Set(elements.map(x=>x.id)).size!==elements.length)throw new DomainError('Elementos duplicados en plantilla',400)
 const w=paper==='A4'?210:215.9,h=paper==='A4'?297:279.4,pageW=orientation==='portrait'?w:h,pageH=orientation==='portrait'?h:w
 if(elements.some(x=>x.x+x.width>pageW+.2||x.y+x.height>pageH+.2))throw new DomainError('Un componente queda fuera de la página',400)
 return {name,kind,paper,orientation,pageCount:Number(pageCount),layout:elements,isDefault:input.isDefault===true}
}
export function defaultFunctionalPayload(kind:FunctionalKind,reviewerId:string):FunctionalPayload{if(kind==='finding')return {reviewDate:new Date().toISOString().slice(0,10),module:'General',feature:'',scenario:'',steps:[''],expected:'',obtained:'',functionalState:'No verificado',findingType:'Comportamiento por aclarar',impact:'',environment:'Web / versión por confirmar',reviewerId,findingStatus:'Pendiente de validar',observations:'',jira:'',custom:{},evidenceLinks:[]};if(kind==='asis')return {processName:'',assessmentDate:new Date().toISOString().slice(0,10),scope:'',observedBehavior:'',assessmentResult:'No verificado',environment:'',observations:'',custom:{},evidenceLinks:[]};return {description:'',priority:'Media',status:'Borrador',acceptanceCriteria:[],businessValue:'',role:'',goal:'',benefit:'',custom:{},evidenceLinks:[]}}
export function defaultTemplateLayout(kind:FunctionalKind='finding'):TemplateElement[]{const base:TemplateElement[]=[
 {id:'logo',kind:'image',x:12,y:12,width:34,height:22,fontSize:10,fontFamily:'Arial'},
 {id:'title',kind:'text',text:'INFORME DE REVISIÓN FUNCIONAL',x:54,y:14,width:145,height:15,fontSize:16,fontFamily:'Arial',bold:true,color:'#17305a'},
 {id:'code',kind:'field',field:'code',x:152,y:32,width:46,height:11,fontSize:10,fontFamily:'Arial',bold:true,align:'right'},
 {id:'rule',kind:'line',x:12,y:47,width:185,height:1,fontSize:10,fontFamily:'Arial',color:'#3174e5'},
 {id:'name',kind:'field',field:'title',x:12,y:57,width:185,height:17,fontSize:16,fontFamily:'Arial',bold:true},
 {id:'date',kind:'field',field:'reviewDate',x:12,y:77,width:80,height:12,fontSize:10,fontFamily:'Arial'},
 {id:'feature',kind:'field',field:'feature',x:105,y:77,width:93,height:12,fontSize:10,fontFamily:'Arial'},
 {id:'scenario',kind:'field',field:'scenario',x:12,y:100,width:185,height:40,fontSize:11,fontFamily:'Arial'},
 {id:'expected',kind:'field',field:'expected',x:12,y:148,width:185,height:32,fontSize:11,fontFamily:'Arial'},
 {id:'obtained',kind:'field',field:'obtained',x:12,y:186,width:185,height:40,fontSize:11,fontFamily:'Arial'},
 {id:'impact',kind:'field',field:'impact',x:12,y:233,width:185,height:37,fontSize:11,fontFamily:'Arial'},
 ];if(kind==='finding')return base
 if(kind==='asis')return [...base.slice(0,5),...([['processName',79,15],['assessmentDate',98,12],['scope',116,35],['observedBehavior',158,73],['assessmentResult',241,15],['observations',260,24]] as const).map(([field,y,height])=>({id:field,kind:'field' as const,field,x:12,y,width:185,height,fontSize:11,fontFamily:'Arial' as const}))]
 const alternate=kind==='story'?[['role',94,12],['goal',114,20],['benefit',143,20],['description',174,40],['acceptanceCriteria',224,48]] as const:[['description',94,72],['priority',176,12],['status',195,12],['acceptanceCriteria',214,44],['businessValue',263,16]] as const
 return [...base.slice(0,5),...alternate.map(([field,y,height])=>({id:field,kind:'field' as const,field,x:12,y,width:185,height,fontSize:11,fontFamily:'Arial' as const}))]
}
