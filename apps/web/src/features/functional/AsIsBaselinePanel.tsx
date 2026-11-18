import {useEffect,useState} from 'react'
import {Archive,Check,Download,GitCompareArrows,LockKeyhole,Workflow,X} from 'lucide-react'
import type {ProjectDocument} from '@novzi/contracts'
import VersionDiagramPreview from '../projects/VersionDiagramPreview'
import {closeAsIs,downloadBase64,getAsIsBaseline,getBaselineAttachment,listAsIsBaselines} from './api'
import type {AsIsBaseline,AsIsBaselineSummary,FunctionalItem,FunctionalLink} from './api'

type Props={projectId:string;item:FunctionalItem;doc:ProjectDocument|null;links:FunctionalLink[];canClose:boolean;dirty:boolean;onClosed:(version:number,closedAt:string)=>Promise<void>;onDiagram:(id:string)=>void;onCreateDiagram?:()=>void}
export default function AsIsBaselinePanel({projectId,item,doc,links,canClose,dirty,onClosed,onDiagram,onCreateDiagram}:Props){
 const [summaries,setSummaries]=useState<AsIsBaselineSummary[]>([])
 const [baseline,setBaseline]=useState<AsIsBaseline|null>(null)
 const [activeDiagram,setActiveDiagram]=useState('')
 const [compare,setCompare]=useState(false)
 const [confirm,setConfirm]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 useEffect(()=>{let alive=true;setSummaries([]);setBaseline(null);setActiveDiagram('');setCompare(false)
  if(!item.id||!item.closedAt)return
  setLoading(true)
  void listAsIsBaselines(projectId,item.id).then(async list=>{
   if(!alive)return
   setSummaries(list)
   if(list[0]){const record=await getAsIsBaseline(projectId,item.id,list[0].id);if(alive){setBaseline(record);setActiveDiagram(record.document.diagrams[0]?.id||'')}}
  }).catch(e=>{if(alive)setError((e as Error).message)}).finally(()=>{if(alive)setLoading(false)})
  return()=>{alive=false}
 },[projectId,item.id,item.closedAt])
 const finalize=async()=>{setBusy(true);setError('');try{const saved=await closeAsIs(projectId,item.id,item.version);setConfirm(false);await onClosed(saved.version,saved.closedAt)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const diagram=baseline?.document.diagrams.find(d=>d.id===activeDiagram)
 const current=doc?.diagrams.find(d=>d.id===activeDiagram)
 const changed=diagram&&current?(JSON.stringify(diagram)!==JSON.stringify(current)||diagram.nodes.some(n=>JSON.stringify(baseline?.document.elements[n.elementId])!==JSON.stringify(doc?.elements[n.elementId]))):true
 const diagramLinks=links.filter(l=>l.targetType!=='record')
 return <section className="functional-subpanel asis-baseline" aria-label="Línea base AS-IS">
  <h3><Archive size={17}/> Línea base histórica AS-IS</h3>
  {!item.closedAt?<>
   <p>Mientras este diagnóstico esté en borrador, puedes editarlo, vincular diagramas y adjuntar evidencias. Al cerrarlo NOVZI guardará copias históricas independientes del proceso y de los hallazgos vinculados. Los diagramas activos podrán seguir cambiando.</p>
   <p><strong>Diagramas vinculados:</strong> {new Set(diagramLinks.map(l=>l.targetType==='diagram'?l.targetId:l.diagramId).filter(Boolean)).size} · <strong>Registros vinculados:</strong> {links.filter(l=>l.targetType==='record').length}</p>
   {diagramLinks.length===0&&<p className="asis-tip">Crea un diagrama desde aquí o vincula uno existente en «Vínculos y trazabilidad». Guarda los cambios del diagrama antes de regresar al diagnóstico. También puedes vincular hallazgos y HU.</p>}
   {dirty&&<p className="asis-tip">Guarda los cambios del formulario antes de cerrar.</p>}
   {onCreateDiagram&&<button className="ghost" disabled={busy||dirty} onClick={onCreateDiagram}><Workflow size={16}/> Crear diagrama del proceso</button>}
   {canClose&&<button className="primary" disabled={busy||dirty||diagramLinks.length===0} onClick={()=>setConfirm(true)}><LockKeyhole size={16}/> Cerrar diagnóstico y generar línea base</button>}
  </>:<>
   <div className="asis-locked"><LockKeyhole size={17}/><div><strong>Diagnóstico cerrado · solo lectura</strong><small>La información original y sus diagramas no se actualizan al modificar los diagramas del proyecto.</small></div></div>
   {loading&&<p>Cargando línea base histórica…</p>}
   {!!summaries.length&&<p><strong>Línea base {summaries[0].number}</strong> · {new Date(summaries[0].createdAt).toLocaleString('es-CO')} · Documento del proyecto V{summaries[0].projectDocumentVersion}</p>}
   {baseline&&<>
    <div className="asis-baseline-metadata"><strong>{baseline.item.code} · {baseline.item.title}</strong><span>Proceso: {baseline.item.payload.processName}</span><span>Comportamiento original: {baseline.item.payload.observedBehavior}</span><span>Evaluación: {baseline.item.payload.assessmentResult}</span></div>
    <div className="asis-history-toolbar"><label>Diagrama histórico <select value={activeDiagram} onChange={e=>setActiveDiagram(e.target.value)}>{baseline.document.diagrams.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className="ghost" disabled={!doc} onClick={()=>setCompare(x=>!x)}><GitCompareArrows size={15}/>{compare?'Ocultar comparación':'Comparar con actual'}</button></div>
    {diagram&&<div className={'asis-diagrams '+(compare?'asis-diagrams-compare':'')}>
     <div><h4><LockKeyhole size={14}/> AS-IS original · {diagram.name}</h4><VersionDiagramPreview diagram={diagram} document={baseline.document}/><small>{diagram.nodes.length} cajas · {diagram.edges.length} relaciones</small></div>
     {compare&&<div><h4><Workflow size={14}/> Diagrama actual</h4>{current&&doc?<><VersionDiagramPreview diagram={current} document={doc}/><small>{current.nodes.length} cajas · {current.edges.length} relaciones · <strong>{changed?'Hay cambios respecto al AS-IS':'Sin cambios detectados'}</strong></small><button className="ghost" onClick={()=>onDiagram(current.id)}>Abrir editor actual</button></>:<p>Este diagrama ya no existe en la versión activa del proyecto. El original sigue disponible.</p>}</div>}
    </div>}
    <h4>Campos personalizados preservados</h4>{Object.entries(baseline.item.payload.custom||{}).length?<div className="asis-snapshots">{Object.entries(baseline.item.payload.custom||{}).map(([fieldId,value])=><div key={fieldId}><strong>{baseline.fields.find(f=>f.id===fieldId)?.name||'Campo histórico'}</strong><p>{typeof value==='string'&&value.startsWith('data:image/')?'[Imagen histórica en el registro]':typeof value==='object'?JSON.stringify(value,null,2):String(value)}</p></div>)}</div>:<p>Este diagnóstico no contiene campos personalizados adicionales.</p>}
    <h4>Registros y hallazgos conservados</h4>{baseline.records.length?<div className="asis-snapshots">{baseline.records.map(record=><div key={record.id}><strong>{record.code} · {record.title}</strong><small>{record.kind} · V{record.version} · {record.payload.findingStatus||record.payload.status||'Estado original'}</small><p>{record.payload.obtained||record.payload.description||record.payload.observedBehavior||''}</p>{Object.entries(record.payload.custom||{}).map(([fieldId,value])=><p key={fieldId}><strong>{baseline.fields.find(f=>f.id===fieldId)?.name||'Campo histórico'}:</strong> {typeof value==='string'&&value.startsWith('data:image/')?'[Imagen en la ficha original]':typeof value==='object'?JSON.stringify(value):String(value)}</p>)}</div>)}</div>:<p>No se vincularon registros adicionales al cerrar.</p>}
    <h4>Evidencias preservadas</h4>{baseline.attachments.length?<div className="functional-evidence-list">{baseline.attachments.map(file=><div key={file.id}><button className="ghost" onClick={async()=>{try{const data=await getBaselineAttachment(projectId,item.id,baseline.id,file.id);downloadBase64(data.fileName,data.mimeType,data.base64)}catch(e){setError((e as Error).message)}}}><Download size={14}/> {file.fileName}</button><small>{baseline.item.id===file.sourceItemId?'Diagnóstico':baseline.records.find(r=>r.id===file.sourceItemId)?.code||'Registro vinculado'}</small></div>)}</div>:<p>No se adjuntaron archivos. Los enlaces de evidencia quedan guardados en los registros originales.</p>}
   </>}
  </>}
  {error&&<p className="functional-error" role="alert">{error}</p>}
  {confirm&&<div className="functional-modal-backdrop"><div className="functional-confirm" role="dialog" aria-modal="true" aria-label="Cerrar diagnóstico AS-IS"><h3>Confirmar línea base AS-IS</h3><p>Se guardarán copias de los diagramas vinculados, datos y evidencias actuales. Este diagnóstico ya no podrá modificarse ni eliminarse individualmente. Para una evaluación futura crea otro diagnóstico.</p><div><button className="ghost" disabled={busy} onClick={()=>setConfirm(false)}><X size={14}/> Cancelar</button><button className="primary" disabled={busy} onClick={()=>void finalize()}><Check size={14}/> Confirmar cierre</button></div></div></div>}
 </section>
}
