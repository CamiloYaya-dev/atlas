import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {ChangeEvent,PointerEvent} from 'react'
import {ArrowLeft,Check,CheckSquare,Copy,Download,FilePlus2,Grip,ImagePlus,List,Plus,Save,Table2,Trash2,Type,FileJson,Upload} from 'lucide-react'
import {builtinFields,createTemplate,deleteTemplate,downloadBase64,exportRecord,listTemplates,saveTemplate,exportFunctionalSchemas,importFunctionalSchemas,downloadJSON} from './api'
import type {FunctionalKind,FunctionalTemplate,FunctionalItem,FunctionalField,TemplateElement,TemplateFieldDraft,TransferSelection} from './api'

type Props={projectId:string;kind:FunctionalKind;items:FunctionalItem[];fields:FunctionalField[];canManage:boolean;canExport:boolean;onClose:()=>void;onFieldsChanged?:()=>Promise<void>;onDirtyChange?:(dirty:boolean)=>void}
const defaults:TemplateElement[]=[
 {id:'logo',kind:'image',x:12,y:12,width:36,height:22,fontSize:10,fontFamily:'Arial'},
 {id:'header',kind:'text',text:'INFORME DE GESTIÓN FUNCIONAL',x:54,y:14,width:140,height:17,fontSize:16,fontFamily:'Arial',bold:true,color:'#17305a'},
 {id:'code',kind:'field',field:'code',x:150,y:32,width:47,height:11,fontSize:11,fontFamily:'Arial',bold:true,align:'right'},
 {id:'line',kind:'line',x:12,y:47,width:185,height:1,fontSize:10,fontFamily:'Arial',color:'#3975e2'},
 {id:'title',kind:'field',field:'title',x:12,y:58,width:186,height:18,fontSize:16,fontFamily:'Arial',bold:true},
 {id:'date',kind:'field',field:'reviewDate',x:12,y:81,width:80,height:11,fontSize:10,fontFamily:'Arial'},
 {id:'feature',kind:'field',field:'feature',x:106,y:81,width:89,height:11,fontSize:10,fontFamily:'Arial'},
 {id:'scenario',kind:'field',field:'scenario',x:12,y:107,width:185,height:34,fontSize:11,fontFamily:'Arial'},
 {id:'expected',kind:'field',field:'expected',x:12,y:151,width:185,height:30,fontSize:11,fontFamily:'Arial'},
 {id:'obtained',kind:'field',field:'obtained',x:12,y:192,width:185,height:32,fontSize:11,fontFamily:'Arial'},
 {id:'impact',kind:'field',field:'impact',x:12,y:237,width:185,height:38,fontSize:11,fontFamily:'Arial'}
]
const blankTemplate=(kind:FunctionalKind):Omit<FunctionalTemplate,'id'|'version'>=>({
 kind,name:`Formato ${kind==='finding'?'de hallazgo':kind==='story'?'de historia de usuario':kind.toUpperCase()}`,paper:'A4',orientation:'portrait',pageCount:1,
 layout:(kind==='finding'?defaults:[...defaults.slice(0,5),...(kind==='story'?([['role',95,12],['goal',113,19],['benefit',140,19],['description',166,42],['acceptanceCriteria',218,51]] as const):([['description',95,72],['priority',176,12],['status',193,12],['acceptanceCriteria',213,43],['businessValue',261,15]] as const)).map(([field,y,height])=>({id:field,kind:'field' as const,field,x:12,y,width:185,height,fontSize:11,fontFamily:'Arial' as const}))]).map(e=>({...e,page:0,id:crypto.randomUUID()})),isDefault:true
})
const pageSize=(t:FunctionalTemplate)=>{const w=t.paper==='A4'?210:215.9,h=t.paper==='A4'?297:279.4;return t.orientation==='portrait'?{w,h}:{w:h,h:w}}
const mm=(v:number)=>`${Math.round(v*10)/10}`
const fieldText=(item:FunctionalItem|undefined,key:string)=>{
 if(!item)return ''
 const p=item.payload as Record<string,unknown>,v=key==='code'?item.code:key==='title'?item.title:key==='createdAt'?item.createdAt:key==='updatedAt'?item.updatedAt:key.startsWith('custom:')?item.payload.custom?.[key.slice(7)]:p[key]
 return Array.isArray(v)?v.map((x,i)=>`${i+1}. ${String(x)}`).join('\n'):v==null?'':typeof v==='boolean'?(v?'Sí':'No'):String(v)
}
const labelFor=(element:TemplateElement,fields:{key:string;label:string}[])=>element.name||fields.find(f=>f.key===element.field)?.label||(element.kind==='field'?`Campo: ${element.field||'sin asignar'}`:{text:'Texto',image:'Imagen',line:'Línea',table:'Tabla',checkbox:'Casilla',list:'Lista'}[element.kind])
const minGeometry=(node:TemplateElement)=>({w:node.kind==='line'?2:8,h:node.kind==='line'?.5:6})
const round=(value:number)=>Math.round(value*10)/10
const resizeDirections=['nw','n','ne','e','se','s','sw','w'] as const
const tableCells=(rows:number,cols:number,old?:string[][])=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>old?.[r]?.[c]||''))
type Drag={id:string;direction:'move'|typeof resizeDirections[number];x:number;y:number;width:number;height:number;px:number;py:number;pixelWidth:number}
export default function TemplateDesigner({projectId,kind,items,fields,canManage,canExport,onClose,onFieldsChanged,onDirtyChange}:Props){
 const [templates,setTemplates]=useState<FunctionalTemplate[]>([]),[draft,setDraft]=useState<FunctionalTemplate|null>(null)
 const [selected,setSelected]=useState<string|null>(null),[pageIndex,setPageIndex]=useState(0),[showValues,setShowValues]=useState(false)
 const [previewId,setPreviewId]=useState(items[0]?.id||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false)
 const [draftNewFields,setDraftNewFields]=useState<TemplateFieldDraft[]>([])
 const importInput=useRef<HTMLInputElement>(null)
 const pageRef=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null)
 const item=items.find(x=>x.id===previewId),node=draft?.layout.find(x=>x.id===selected)
 const page=draft?pageSize(draft):{w:210,h:297},count=draft?.pageCount||1
 const allFields=useMemo(()=>[...builtinFields(kind),...fields.map(f=>({key:'custom:'+f.id,label:f.name})),...draftNewFields.map(f=>({key:f.clientId,label:f.name}))],[kind,fields,draftNewFields])
 const pendingField=draftNewFields.find(f=>f.clientId===node?.field)
 const load=useCallback(()=>listTemplates(projectId,kind).then(x=>{const records=x.map(t=>({...t,pageCount:t.pageCount||1}));setTemplates(records);setDraft(old=>records.find(t=>t.id===old?.id)||records[0]||null);setDirty(false);setDraftNewFields([])}).catch(e=>setError(e.message)),[projectId,kind])
 useEffect(()=>{setError('');void load()},[load])
 useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange])
 useEffect(()=>{if(node&&node.page!==undefined&&node.page!==pageIndex)setSelected(null)},[pageIndex,node?.id,node?.page])
 const update=(patch:Partial<FunctionalTemplate>)=>{setDraft(old=>old?{...old,...patch}:old);setDirty(true);setNotice('')}
 const clampNode=(e:TemplateElement,next:Partial<TemplateElement>):TemplateElement=>{
  const merged={...e,...next},min=minGeometry(merged)
  const width=round(Math.max(min.w,Math.min(page.w,merged.width))),height=round(Math.max(min.h,Math.min(page.h,merged.height)))
  const x=round(Math.max(0,Math.min(page.w-width,merged.x))),y=round(Math.max(0,Math.min(page.h-height,merged.y)))
  return {...merged,x,y,width,height}
 }
 const updateNode=(id:string,patch:Partial<TemplateElement>)=>{
  setDraft(old=>old?{...old,layout:old.layout.map(e=>e.id===id?clampNode(e,patch):e)}:old)
  setDirty(true);setNotice('')
 }
 const changePaper=(next:Pick<FunctionalTemplate,'paper'|'orientation'>)=>{
  if(!draft||!canManage)return
  const target=pageSize({...draft,...next})
  update({...next,layout:draft.layout.map(e=>({...e,x:round(e.x*target.w/page.w),y:round(e.y*target.h/page.h),width:round(e.width*target.w/page.w),height:round(e.height*target.h/page.h)}))})
 }
 const newTemplate=()=>{if(dirty){setError('Guarda o descarta los cambios antes de crear otra plantilla');return}const d=blankTemplate(kind);setDraft({...d,id:'',version:0});setDraftNewFields([]);setSelected(null);setPageIndex(0);setDirty(true);setError('')}
 const newNode=(k:TemplateElement['kind'])=>{
  if(!draft||!canManage)return
  if(draft.layout.length>=300){setError('Máximo 300 componentes por plantilla');return}
  const id=crypto.randomUUID(),baseName=({field:'Título',text:'Texto para diligenciar',image:'Imagen del formulario',line:'Línea decorativa',table:'Tabla de información',checkbox:'Casilla de verificación',list:'Lista de elementos'} as const)[k]
  const usedNames=new Set([...fields.map(f=>f.name),...draftNewFields.map(f=>f.name),...draft.layout.map(e=>e.name||'')]);let name:string=baseName,sequence=1;while(usedNames.has(name))name=`${baseName} ${++sequence}`
  const fieldType=({text:'long',image:'image',table:'table',checkbox:'boolean',list:'list'} as Partial<Record<TemplateElement['kind'],FunctionalField['fieldType']>>)[k]
  const clientId=fieldType?'pending:'+crypto.randomUUID():undefined
  if(clientId)setDraftNewFields(old=>[...old,{clientId,name,fieldType:fieldType!,required:false,options:[]}])
  const e:TemplateElement={id,kind:k,name,page:pageIndex,x:18,y:85,width:k==='line'?160:k==='image'?48:k==='table'?155:105,height:k==='line'?1:k==='image'?35:k==='table'?52:23,fontSize:11,fontFamily:'Arial',color:'#203858',
   ...(k==='field'?{field:'title'}:{}),...(clientId?{field:clientId}:{}),...(k==='text'?{text:''}:{}),...(k==='table'?{rows:3,cols:3,cells:[['Columna 1','Columna 2','Columna 3'],['','',''],['','','']]}:{}),...(k==='checkbox'?{text:name,checked:false}:{}),...(k==='list'?{text:'',ordered:false}:{})}
  update({layout:[...draft.layout,e]});setSelected(id)
 }
 const addPage=(clone:boolean)=>{
  if(!draft||!canManage)return
  if(count>=20){setError('Máximo 20 páginas por plantilla');return}
  const current=clone?draft.layout.filter(e=>(e.page??0)===pageIndex):[]
  if(draft.layout.length+current.length>300){setError('La copia excedería el máximo de 300 componentes');return}
  const layout=[...draft.layout,...current.map(e=>({...e,id:crypto.randomUUID(),page:count}))]
  update({pageCount:count+1,layout});setPageIndex(count);setSelected(null)
 }
 const removePage=()=>{
  if(!draft||!canManage||count<=1)return
  update({pageCount:count-1,layout:draft.layout.filter(e=>(e.page??0)!==pageIndex).map(e=>({...e,page:(e.page??0)>pageIndex?(e.page??0)-1:e.page??0}))})
  setPageIndex(Math.max(0,pageIndex-1));setSelected(null)
 }
 const save=async()=>{if(!draft||!canManage)return;setBusy(true);setError('');try{
  const referenced=new Set(draft.layout.map(e=>e.field).filter(Boolean))
  const newFields=draftNewFields.filter(f=>referenced.has(f.clientId))
  const next=draft.id?await saveTemplate(projectId,draft,newFields):await createTemplate(projectId,draft,newFields)
  await onFieldsChanged?.();await load();setDraft({...next,pageCount:next.pageCount||1});setDraftNewFields([]);setDirty(false);setSelected(null);setNotice(`Plantilla guardada. ${newFields.length} campos añadidos al formulario.`)
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const remove=async()=>{if(!draft?.id||!canManage||busy)return;setBusy(true);try{await deleteTemplate(projectId,draft.id);await load();setDraft(null);setSelected(null);setNotice('Plantilla eliminada')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const download=async(format:'pdf'|'docx'|'html')=>{if(!item||!canExport){setError('Selecciona un documento primero');return}if(dirty){setError('Guarda la plantilla antes de exportar');return}setBusy(true);setError('');try{const out=await exportRecord(projectId,item.id,format,draft?.id||undefined);downloadBase64(out.fileName,out.mimeType,out.base64);setNotice('Documento descargado')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const exportTemplateJSON=async()=>{if(!draft?.id||dirty||!canExport)return;setBusy(true);setError('');try{
  const selection={finding:'none',rf:'none',rnf:'none',story:'none',[kind]:'template'} as TransferSelection
  const payload=await exportFunctionalSchemas(projectId,selection,{[kind]:[draft.id]})
  downloadJSON(`ATLAS_plantilla_${draft.name.replace(/[^a-zA-Z0-9_-]+/g,'_')}.json`,payload)
  setNotice('Plantilla exportada con sus campos dependientes')
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const importTemplateJSON=async(file:File)=>{if(dirty){setError('Guarda o descarta los cambios antes de importar');return}if(file.size>10000000){setError('El JSON no puede superar 10 MB');return}setBusy(true);setError('');try{
  const bundle:unknown=JSON.parse(await file.text())
  const result=await importFunctionalSchemas(projectId,bundle)
  await onFieldsChanged?.();await load()
  setNotice(`${result.addedTemplates} plantilla(s) importadas y ${result.addedFields} campo(s) de formulario creados`)
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const updatePending=(patch:Partial<TemplateFieldDraft>)=>{if(!pendingField)return;setDraftNewFields(old=>old.map(f=>f.clientId===pendingField.clientId?{...f,...patch}:f));setDirty(true)}
 const compatible=(f:FunctionalField)=>node?.kind==='image'?f.fieldType==='image':node?.kind==='table'?f.fieldType==='table':node?.kind==='checkbox'?f.fieldType==='boolean':node?.kind==='list'?['list','multi_select','checkbox_group'].includes(f.fieldType):true
 const pendingChoices=([['text','Texto corto'],['long','Texto largo'],['number','Número'],['currency','Moneda'],['date','Fecha'],['time','Hora'],['datetime','Fecha y hora'],['boolean','Casilla'],['select','Lista desplegable'],['multi_select','Selección múltiple'],['checkbox_group','Grupo de casillas'],['list','Lista editable'],['table','Tabla'],['image','Imagen'],['url','Enlace'],['email','Correo electrónico']] as const)
 const newBoundField=()=>{if(!node||!canManage)return;const fieldType=({image:'image',table:'table',checkbox:'boolean',list:'list',text:'long'} as Partial<Record<TemplateElement['kind'],FunctionalField['fieldType']>>)[node.kind]||'text';const clientId='pending:'+crypto.randomUUID(),name=node.name||'Campo del documento';setDraftNewFields(old=>[...old,{clientId,name,fieldType,required:false,options:[]}]);updateNode(node.id,{field:clientId})}
 const pointerStart=(ev:PointerEvent<HTMLDivElement>,e:TemplateElement)=>{
  if(!draft||!canManage)return
  const rect=pageRef.current?.getBoundingClientRect();if(!rect)return
  const direction=(ev.target as HTMLElement).closest<HTMLElement>('[data-resize]')?.dataset.resize as Drag['direction']|undefined
  drag.current={id:e.id,direction:direction||'move',x:e.x,y:e.y,width:e.width,height:e.height,px:ev.clientX,py:ev.clientY,pixelWidth:rect.width}
  ev.currentTarget.setPointerCapture(ev.pointerId);ev.preventDefault();setSelected(e.id)
 }
 const pointerMove=(ev:PointerEvent<HTMLDivElement>)=>{
  const d=drag.current;if(!d)return
  if(![ev.clientX,ev.clientY,d.px,d.py,d.pixelWidth].every(Number.isFinite)||d.pixelWidth<=0)return
  const scale=page.w/d.pixelWidth,dx=(ev.clientX-d.px)*scale,dy=(ev.clientY-d.py)*scale,min=minGeometry(draft?.layout.find(e=>e.id===d.id)||{kind:'field'} as TemplateElement)
  let x=d.x,y=d.y,w=d.width,h=d.height
  if(d.direction==='move'){x=Math.max(0,Math.min(page.w-w,d.x+dx));y=Math.max(0,Math.min(page.h-h,d.y+dy))}
  else{
   if(d.direction.includes('e'))w=Math.max(min.w,Math.min(page.w-d.x,d.width+dx))
   if(d.direction.includes('s'))h=Math.max(min.h,Math.min(page.h-d.y,d.height+dy))
   if(d.direction.includes('w')){x=Math.max(0,Math.min(d.x+d.width-min.w,d.x+dx));w=d.width+d.x-x}
   if(d.direction.includes('n')){y=Math.max(0,Math.min(d.y+d.height-min.h,d.y+dy));h=d.height+d.y-y}
  }
  updateNode(d.id,{x:round(x),y:round(y),width:round(w),height:round(h)})
 }
 const addImage=(ev:ChangeEvent<HTMLInputElement>)=>{
  const file=ev.target.files?.[0];if(!file||!node)return
  if(file.size>260000||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Imagen: máximo 250 KB en PNG, JPG o WebP');ev.target.value='';return}
  const reader=new FileReader();reader.onload=()=>updateNode(node.id,{image:String(reader.result)});reader.readAsDataURL(file);ev.target.value=''
 }
 const editTableSize=(rows:number,cols:number)=>{if(!node||node.kind!=='table')return;const rr=Math.max(1,Math.min(20,rows)),cc=Math.max(1,Math.min(12,cols));updateNode(node.id,{rows:rr,cols:cc,cells:tableCells(rr,cc,node.cells)})}
 const cellEdit=(r:number,c:number,text:string)=>{if(!node||node.kind!=='table')return;const cells=tableCells(node.rows||3,node.cols||3,node.cells);cells[r][c]=text.slice(0,1000);updateNode(node.id,{cells})}
 const display=(e:TemplateElement)=>{
  if(e.kind==='field')return showValues&&item?fieldText(item,e.field||''):labelFor(e,allFields)
  if(e.kind==='image'){const value=e.field&&showValues&&item?fieldText(item,e.field):e.image;return value?.startsWith('data:image/')?<img src={value} alt={labelFor(e,allFields)}/>:<span className="functional-logo-placeholder">{labelFor(e,allFields).toUpperCase()}</span>}
  if(e.kind==='line')return null
  if(e.kind==='table')return <table className="functional-paper-table"><tbody>{Array.from({length:e.rows||3},(_,r)=><tr key={r}>{Array.from({length:e.cols||3},(_,c)=><td key={c}>{showValues&&item&&e.field?.startsWith('custom:')?(Array.isArray(item.payload.custom?.[e.field.slice(7)])?(item.payload.custom?.[e.field.slice(7)] as string[][])?.[r]?.[c]||'':e.cells?.[r]?.[c]||''):(e.cells?.[r]?.[c]||'')}</td>)}</tr>)}</tbody></table>
  if(e.kind==='checkbox'){const checked=e.field&&showValues&&item?['Sí','true','1'].includes(fieldText(item,e.field)):!!e.checked;return <span className="functional-paper-checkbox"><span>{checked?'☑':'☐'}</span> {e.text||'Casilla'}</span>}
  if(e.kind==='list')return ((e.field&&showValues&&item?fieldText(item,e.field):e.text)||labelFor(e,allFields)).split('\n').filter(Boolean).map((s,i)=><div key={i}>{e.ordered?`${i+1}.`:'•'} {s}</div>)
  return (e.field&&showValues&&item?fieldText(item,e.field):e.text)||labelFor(e,allFields)
 }
 return <section className="functional-designer">
  <header className="functional-header"><button className="ghost" onClick={()=>dirty?setError('Guarda los cambios de la plantilla o descártalos antes de volver'):onClose()}><ArrowLeft size={16}/> Volver a Gestión funcional</button>{dirty&&<button className="ghost" onClick={()=>{setDirty(false);onClose()}}>Descartar y volver</button>}<div><span className="eyebrow">DOCUMENTOS FORMALES</span><h2>Diseñador de plantillas</h2><p>Arrastra y redimensiona componentes. Cada hoja se imprime y exporta como una página independiente.</p></div></header>
  <div className="functional-design-toolbar"><label>Plantilla<select value={draft?.id||''} onChange={e=>{if(dirty){setError('Guarda los cambios antes de cambiar de plantilla');return}setDraft(templates.find(t=>t.id===e.target.value)||null);setSelected(null);setPageIndex(0)}}><option value="">Nueva plantilla</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button className="ghost" disabled={!canManage} onClick={newTemplate}><Plus size={14}/> Nueva</button><label>Vista previa<select value={previewId} onChange={e=>setPreviewId(e.target.value)}><option value="">Sin datos</option>{items.map(i=><option key={i.id} value={i.id}>{i.code} · {i.title}</option>)}</select></label><label className="functional-check"><input type="checkbox" checked={showValues} onChange={e=>setShowValues(e.target.checked)}/> Mostrar datos reales</label><button className="primary" onClick={save} disabled={!canManage||!draft||!dirty||busy}><Save size={15}/> Guardar</button><button className="ghost" disabled={!draft?.id||!canManage||busy} onClick={remove}><Trash2 size={14}/> Eliminar</button><button className="ghost" disabled={!draft?.id||dirty||!canExport||busy} onClick={()=>void exportTemplateJSON()}><FileJson size={14}/> Exportar JSON</button><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importTemplateJSON(file)}}/><button className="ghost" disabled={!canManage||busy||dirty} onClick={()=>importInput.current?.click()}><Upload size={14}/> Importar JSON</button></div>
  {error&&<p role="alert" className="functional-error">{error}</p>}{notice&&<p role="status" className="functional-success">{notice}</p>}
  <div className="functional-design-layout">
   <aside className="functional-design-side"><h3>Componentes</h3><div className="functional-add-grid">
    <button disabled={!draft||!canManage} onClick={()=>newNode('field')}><Plus size={14}/> Campo</button>
    <button disabled={!draft||!canManage} onClick={()=>newNode('text')}><Type size={14}/> Texto</button>
    <button disabled={!draft||!canManage} onClick={()=>newNode('image')}><ImagePlus size={14}/> Imagen</button>
    <button disabled={!draft||!canManage} onClick={()=>newNode('line')}><Grip size={14}/> Línea</button>
    <button disabled={!draft||!canManage} onClick={()=>newNode('table')}><Table2 size={14}/> Tabla</button>
    <button disabled={!draft||!canManage} onClick={()=>newNode('checkbox')}><CheckSquare size={14}/> Casilla</button>
    <button disabled={!draft||!canManage} onClick={()=>newNode('list')}><List size={14}/> Lista</button>
   </div>
   {draft&&<><label>Nombre<input value={draft.name} disabled={!canManage} onChange={e=>update({name:e.target.value})}/></label><div className="functional-split"><label>Tamaño<select value={draft.paper} disabled={!canManage} onChange={e=>changePaper({paper:e.target.value as 'A4'|'LETTER',orientation:draft.orientation})}><option value="A4">A4</option><option value="LETTER">Carta</option></select></label><label>Orientación<select value={draft.orientation} disabled={!canManage} onChange={e=>changePaper({paper:draft.paper,orientation:e.target.value as FunctionalTemplate['orientation']})}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label></div><label className="functional-check"><input type="checkbox" disabled={!canManage} checked={draft.isDefault} onChange={e=>update({isDefault:e.target.checked})}/> Plantilla predeterminada</label></>}
   {node&&<div className="functional-element-inspector"><h3>Editar: {labelFor(node,allFields)}</h3>
    <label>Nombre del componente<input aria-label="Nombre del componente" disabled={!canManage} value={node.name||''} onChange={e=>{updateNode(node.id,{name:e.target.value});if(pendingField)updatePending({name:e.target.value})}} placeholder="Nombre del campo en el formulario"/></label>
    {node.kind!=='line'&&<div className="functional-binding-box"><strong>Datos del formulario</strong><p>La plantilla utiliza campos del formulario. Los componentes de datos nuevos crean su campo al guardar.</p>
      <label>Vincular con campo<select aria-label="Vincular con campo de formulario" value={node.field||''} disabled={!canManage} onChange={e=>updateNode(node.id,{field:e.target.value||undefined,name:allFields.find(f=>f.key===e.target.value)?.label||node.name})}>
       {['text','image'].includes(node.kind)&&<option value="">Decoración fija (sin dato del registro)</option>}
       {!node.field&&node.kind!=='text'&&node.kind!=='image'&&<option value="">Selecciona un campo</option>}
       {['field','text'].includes(node.kind)&&builtinFields(kind).map(f=><option value={f.key} key={f.key}>{f.label} · predeterminado</option>)}
       {fields.filter(compatible).map(f=><option key={f.id} value={'custom:'+f.id}>{f.name} · {f.fieldType}</option>)}
       {draftNewFields.filter(f=>node.kind==='field'||node.kind==='text'||node.kind==='image'&&f.fieldType==='image'||node.kind==='table'&&f.fieldType==='table'||node.kind==='checkbox'&&f.fieldType==='boolean'||node.kind==='list'&&['list','multi_select','checkbox_group'].includes(f.fieldType)).map(f=><option value={f.clientId} key={f.clientId}>{f.name} · campo nuevo</option>)}
      </select></label>
      <button className="ghost" disabled={!canManage} onClick={newBoundField}><Plus size={14}/> Crear nuevo campo en el formulario</button>
      {pendingField&&<div className="functional-new-field-editor"><label>Tipo del campo<select aria-label="Tipo de campo del componente" disabled={!canManage} value={pendingField.fieldType} onChange={e=>updatePending({fieldType:e.target.value as FunctionalField['fieldType'],options:[]})}>
       {pendingChoices.filter(([t])=>node.kind==='field'||node.kind==='text'||node.kind==='image'&&t==='image'||node.kind==='table'&&t==='table'||node.kind==='checkbox'&&t==='boolean'||node.kind==='list'&&['list','multi_select','checkbox_group'].includes(t)).map(([value,label])=><option value={value} key={value}>{label}</option>)}
      </select></label><label className="functional-check"><input type="checkbox" disabled={!canManage} checked={pendingField.required} onChange={e=>updatePending({required:e.target.checked})}/> Obligatorio al diligenciar</label>
      {['select','multi_select','checkbox_group'].includes(pendingField.fieldType)&&<label>Opciones (una por línea)<textarea rows={4} aria-label="Opciones del campo" disabled={!canManage} value={pendingField.options.join('\n')} onChange={e=>updatePending({options:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})}/></label>}
      </div>}
    </div>}
    {['text','list'].includes(node.kind)&&<label>{node.kind==='list'?'Elementos (uno por línea)':'Texto fijo'}<textarea rows={node.kind==='list'?5:3} value={node.text||''} disabled={!canManage} onChange={e=>updateNode(node.id,{text:e.target.value.slice(0,4000)})}/></label>}
    {node.kind==='list'&&<label className="functional-check"><input type="checkbox" checked={!!node.ordered} disabled={!canManage} onChange={e=>updateNode(node.id,{ordered:e.target.checked})}/> Lista numerada</label>}
    {node.kind==='checkbox'&&<><label>Etiqueta<input value={node.text||''} disabled={!canManage} onChange={e=>updateNode(node.id,{text:e.target.value})}/></label>{!node.field&&<label className="functional-check"><input type="checkbox" checked={!!node.checked} disabled={!canManage} onChange={e=>updateNode(node.id,{checked:e.target.checked})}/> Marcada (decoración)</label>}</>}
    {node.kind==='image'&&<label>Imagen (logo, fotografía o captura)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!canManage} onChange={addImage}/>{node.image&&<button className="ghost" type="button" onClick={()=>updateNode(node.id,{image:undefined})}>Quitar imagen</button>}</label>}
    {node.kind==='table'&&<><div className="functional-split"><label>Filas<input type="number" min="1" max="20" value={node.rows||3} disabled={!canManage} onChange={e=>editTableSize(Number(e.target.value),node.cols||3)}/></label><label>Columnas<input type="number" min="1" max="12" value={node.cols||3} disabled={!canManage} onChange={e=>editTableSize(node.rows||3,Number(e.target.value))}/></label></div><div className="functional-table-editor" aria-label="Editar celdas de tabla" style={{gridTemplateColumns:`repeat(${node.cols||3},minmax(80px,1fr))`}}>{Array.from({length:node.rows||3},(_,r)=>Array.from({length:node.cols||3},(_,c)=><input key={`${r}:${c}`} aria-label={`Celda ${r+1}, ${c+1}`} value={node.cells?.[r]?.[c]||''} onChange={e=>cellEdit(r,c,e.target.value)} disabled={!canManage}/>))}</div></>}
    <div className="functional-four-fields">{(['x','y','width','height'] as const).map(key=><label key={key}>{({x:'X (mm)',y:'Y (mm)',width:'Ancho (mm)',height:'Alto (mm)'})[key]}<input type="number" min="0" step="0.5" value={node[key]} disabled={!canManage} onChange={e=>updateNode(node.id,{[key]:Number(e.target.value)})}/></label>)}</div>
    {node.kind!=='image'&&node.kind!=='line'&&<><div className="functional-split"><label>Fuente<select value={node.fontFamily} disabled={!canManage} onChange={e=>updateNode(node.id,{fontFamily:e.target.value as TemplateElement['fontFamily']})}>{['Arial','Helvetica','Times New Roman','Courier New'].map(f=><option key={f}>{f}</option>)}</select></label><label>Puntos<input type="number" min="5" max="64" disabled={!canManage} value={node.fontSize} onChange={e=>updateNode(node.id,{fontSize:Math.max(5,Math.min(64,Number(e.target.value)))})}/></label></div><label>Alineación<select value={node.align||'left'} disabled={!canManage} onChange={e=>updateNode(node.id,{align:e.target.value as TemplateElement['align']})}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label><label className="functional-check"><input type="checkbox" checked={!!node.bold} disabled={!canManage} onChange={e=>updateNode(node.id,{bold:e.target.checked})}/> Negrita</label><label className="functional-check"><input type="checkbox" checked={!!node.italic} disabled={!canManage} onChange={e=>updateNode(node.id,{italic:e.target.checked})}/> Cursiva</label></>}
    <label>Color<input type="color" value={node.color||'#203858'} disabled={!canManage} onChange={e=>updateNode(node.id,{color:e.target.value})}/></label><button className="ghost" disabled={!canManage} onClick={()=>{update({layout:draft!.layout.filter(e=>e.id!==node.id)});setSelected(null)}}><Trash2 size={14}/> Quitar elemento</button>
   </div>}
   </aside>
   <div className="functional-page-column">
    {draft&&<div className="functional-page-toolbar"><strong>Hojas del documento</strong><div className="functional-page-tabs">{Array.from({length:count},(_,i)=><button key={i} type="button" className={pageIndex===i?'active':''} aria-current={pageIndex===i?'page':undefined} onClick={()=>{setPageIndex(i);setSelected(null)}}>Hoja {i+1}</button>)}</div><button className="ghost" disabled={!canManage||count>=20} title="Copia el formato de la hoja actual; después podrás editar cada copia por separado" onClick={()=>addPage(true)}><Copy size={14}/> Duplicar hoja</button><button className="ghost" disabled={!canManage||count>=20} onClick={()=>addPage(false)}><FilePlus2 size={14}/> Hoja vacía</button>{count>1&&<button className="danger outlined" disabled={!canManage} onClick={removePage}><Trash2 size={14}/> Quitar hoja</button>}</div>}
    <div className="functional-page-region">{draft?<div className="functional-paper" ref={pageRef} style={{width:`${page.w*2.5}px`,height:`${page.h*2.5}px`}} aria-label={`Lienzo de la hoja ${pageIndex+1}`}>
     {draft.layout.filter(e=>(e.page??0)===pageIndex).map(e=><div key={e.id} role="button" tabIndex={0} aria-label={`${labelFor(e,allFields)}, ${mm(e.width)} por ${mm(e.height)} milímetros`} className={'functional-paper-element '+(selected===e.id?'selected':'')} onPointerDown={ev=>pointerStart(ev,e)} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} onKeyDown={ev=>{if(ev.key==='Enter')setSelected(e.id)}} onClick={()=>setSelected(e.id)} style={{left:`${e.x/page.w*100}%`,top:`${e.y/page.h*100}%`,width:`${e.width/page.w*100}%`,height:`${e.height/page.h*100}%`,fontFamily:e.fontFamily,fontSize:`${e.fontSize*.89}px`,fontWeight:e.bold?700:400,fontStyle:e.italic?'italic':'normal',color:e.color||'#203858',textAlign:e.align||'left',...(e.kind==='line'?{background:e.color||'#3975e2'}:{})}}>
      <div className="functional-component-content">{display(e)}</div><span className="functional-component-badge">{labelFor(e,allFields)} · {mm(e.width)} × {mm(e.height)} mm</span>
      {selected===e.id&&canManage&&resizeDirections.map(direction=><span key={direction} className={`functional-resize-grip grip-${direction}`} data-resize={direction} title={`Redimensionar ${direction}`}/>)}
     </div>)}
    </div>:<div className="functional-empty">Crea una plantilla para empezar.</div>}</div>
    {draft&&<div className="functional-page-caption">Hoja {pageIndex+1} de {count} · {draft.paper} {draft.orientation==='portrait'?'vertical':'horizontal'} · {mm(page.w)} × {mm(page.h)} mm</div>}
   </div>
   <aside className="functional-export-side"><h3>Exportación</h3><p>Exporta todas las hojas con el formato guardado, manteniendo los datos originales.</p>{(['pdf','docx','html'] as const).map(fmt=><button key={fmt} className="ghost functional-export-btn" disabled={!canExport||!item||busy||dirty} onClick={()=>void download(fmt)}><Download size={14}/> {fmt==='docx'?'Word (.docx)':fmt==='html'?'HTML':'PDF'}</button>)}<p className="functional-hint"><Check size={13}/> La plantilla comparte sus hojas dentro del proyecto según sus permisos.</p></aside>
  </div>
 </section>
}
