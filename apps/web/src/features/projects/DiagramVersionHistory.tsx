import {useCallback,useEffect,useState} from 'react'
import {Overlay} from '../../components/molecules/Overlay'
import {loadDiagramState,listDiagramCheckpoints,loadDiagramCheckpoint,createDiagramCheckpoint,restoreDiagramCheckpoint} from './api'
import type {DiagramState,DiagramCheckpoint,DiagramCheckpointSnapshot} from './api'
import type {ProjectDocument} from '@novzi/contracts'
import VersionDiagramPreview from './VersionDiagramPreview'

type Props={projectId:string;diagramId:string;diagramName:string;canCheckpoint:boolean;canRestore:boolean;onClose:()=>void;onRestored:(projectVersion:number)=>Promise<void>|void;onOpenProjectHistory:()=>void}
const formatDate=(str:string)=>{const date=new Date(str);return isNaN(date.getTime())?str:date.toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}
export default function DiagramVersionHistory({projectId,diagramId,diagramName,canCheckpoint,canRestore,onClose,onRestored,onOpenProjectHistory}:Props){
 const [state,setState]=useState<DiagramState|null>(null)
 const [checkpoints,setCheckpoints]=useState<DiagramCheckpoint[]>([])
 const [selected,setSelected]=useState<(DiagramCheckpoint&{snapshot:DiagramCheckpointSnapshot})|null>(null)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [confirmation,setConfirmation]=useState('')
 const [confirming,setConfirming]=useState(false)
 const refresh=useCallback(async()=>{
  const [status,items]=await Promise.all([loadDiagramState(projectId,diagramId),listDiagramCheckpoints(projectId,diagramId)])
  setState(status);setCheckpoints(items)
 },[projectId,diagramId])
 useEffect(()=>{let active=true;setLoading(true);setSelected(null);setError('');setState(null)
  void Promise.all([loadDiagramState(projectId,diagramId),listDiagramCheckpoints(projectId,diagramId)]).then(([status,items])=>{if(active){setState(status);setCheckpoints(items)}}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[projectId,diagramId])
 const open=async(version:number)=>{setBusy(true);setError('');try{setSelected(await loadDiagramCheckpoint(projectId,diagramId,version))}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const checkpoint=async()=>{setBusy(true);setError('');try{const result=await createDiagramCheckpoint(projectId,diagramId);await refresh();if(!result.created)setError('No hay cambios nuevos respecto al último punto de control.')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const restore=async()=>{
  if(!selected||!state||confirmation!==`v${selected.version}`||busy)return
  setBusy(true);setError('')
  try{const result=await restoreDiagramCheckpoint(projectId,diagramId,selected.version,state.revision);await onRestored(result.version);setConfirming(false);onClose()}
  catch(e){setError(e instanceof Error?e.message:String(e));setConfirming(false);await refresh().catch(()=>{})}
  finally{setBusy(false)}
 }
 const historicalDoc:ProjectDocument|null=selected?{schema:1,diagrams:[selected.snapshot.diagram],elements:selected.snapshot.elements,fieldDefinitions:[]}:null
 return <Overlay title={`Historial · ${diagramName}`} onClose={onClose} wide>
  <div className="modal-body history-panel">
   <p className="dialog-description">Cada diagrama tiene su historial independiente. NOVZI guarda borradores automáticamente, pero crea puntos de control agrupados (cada 10 minutos de edición o manualmente). Las revisiones antiguas del proyecto se conservan aparte.</p>
   <div className="history-summary"><strong>Versión de {diagramName}: v{state?.version??'…'}</strong><button type="button" className="ghost" disabled={loading||busy} onClick={()=>{setLoading(true);void refresh().catch(e=>setError(String(e))).finally(()=>setLoading(false))}}>Actualizar</button></div>
   {canCheckpoint&&<button type="button" className="primary" disabled={busy||loading} onClick={()=>void checkpoint()}>{busy?'Guardando…':'Crear punto de control ahora'}</button>}
   {loading&&<p role="status">Cargando versiones del diagrama…</p>}
   {error&&<p role="alert">{error}</p>}
   {!loading&&!checkpoints.length&&<p>No existen puntos de control para este diagrama.</p>}
   <div className="history-list">{checkpoints.map(item=><div key={item.version} className="history-row"><div><strong>v{item.version} · {item.reason==='baseline'?'Versión inicial':item.reason==='automatic'?'Automática':item.reason==='restore'?'Restauración':'Punto manual'}</strong><small>{formatDate(item.created_at)} · {item.editor_name||'Usuario no disponible'}</small></div><button type="button" className="ghost" disabled={busy} onClick={()=>void open(item.version)}>Consultar v{item.version}</button></div>)}</div>
   {selected&&historicalDoc&&<section className="history-detail" aria-label={`Detalle de diagrama v${selected.version}`}>
     <strong>Diagrama · v{selected.version}</strong><p>{formatDate(selected.created_at)} · {selected.snapshot.diagram.nodes.length} cajas · {selected.snapshot.diagram.edges.length} relaciones</p>
     <VersionDiagramPreview diagram={selected.snapshot.diagram} document={historicalDoc}/>
     {canRestore&&<button type="button" className="danger outlined" disabled={busy} onClick={()=>{setConfirmation('');setConfirming(true)}}>Restaurar solo este diagrama</button>}
     {!canRestore&&<p className="history-note">Solo el propietario del proyecto puede restaurar diagramas; la consulta no altera contenido.</p>}
   </section>}
   <div className="modal-actions"><button type="button" className="ghost" onClick={onOpenProjectHistory}>Historial técnico anterior del proyecto</button><button type="button" className="ghost" onClick={onClose}>Cerrar</button></div>
  </div>
  {confirming&&selected&&<Overlay title={`Restaurar diagrama desde v${selected.version}`} onClose={()=>!busy&&setConfirming(false)}>
   <div className="modal-body"><p>Restaurarás <strong>únicamente {diagramName}</strong>. Los otros diagramas conservarán sus cambios. Si una ficha compartida cambió en otra vista, el servidor bloqueará la restauración antes de sobrescribirla.</p>
    <label className="form-field"><span>Escribe <strong>v{selected.version}</strong> para confirmar</span><input aria-label="Confirmar restauración de diagrama" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="ghost" disabled={busy} onClick={()=>setConfirming(false)}>Cancelar</button><button type="button" className="danger outlined" disabled={busy||confirmation!==`v${selected.version}`} onClick={()=>void restore()}>{busy?'Restaurando…':'Restaurar diagrama'}</button></div>
   </div>
  </Overlay>}
 </Overlay>
}
