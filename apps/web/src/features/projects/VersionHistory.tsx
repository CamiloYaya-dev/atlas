import {useEffect,useState} from 'react'
import {Overlay} from '../../components/molecules/Overlay'
import {listDocumentVersions,loadDocumentVersion,restoreDocumentVersion,listRestoreBranches,createRestoreBranch,previewRestoreBranch,applyRestoreBranch,discardRestoreBranch} from './api'
import type {DocumentVersion,DocumentVersionSnapshot,RestoreBranch,RestoreBranchPreview} from './api'
import VersionDiagramPreview from './VersionDiagramPreview'
import {compareVersions} from './version-diff'

const asDate=(date:string)=>{const value=new Date(date);return Number.isNaN(value.getTime())?date:value.toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}
type Props={projectId:string;currentVersion:number;onClose:()=>void;canRestore?:boolean;onRestored?:(newVersion:number)=>Promise<void>|void}
/** History is always read-only until an OWNER explicitly requests a CAS-protected restoration. */
export default function VersionHistory({projectId,currentVersion,onClose,canRestore=false,onRestored}:Props){
 const [versions,setVersions]=useState<DocumentVersion[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [selected,setSelected]=useState<DocumentVersionSnapshot|null>(null)
 const [diagramId,setDiagramId]=useState('')
 const [referenceVersion,setReferenceVersion]=useState(currentVersion)
 const [reference,setReference]=useState<DocumentVersionSnapshot|null>(null)
 const [detailLoading,setDetailLoading]=useState(false)
 const [detailError,setDetailError]=useState('')
 const [restoring,setRestoring]=useState(false)
 const [restoreCandidate,setRestoreCandidate]=useState<number|null>(null)
 const [restoreConfirmation,setRestoreConfirmation]=useState('')
 const [reloadIndex,setReloadIndex]=useState(0)
 const [branches,setBranches]=useState<RestoreBranch[]>([])
 const [branchPreview,setBranchPreview]=useState<RestoreBranchPreview|null>(null)
 const [branchChoices,setBranchChoices]=useState<Record<string,'current'|'historical'>>({})
 const [branchMode,setBranchMode]=useState<'merge'|'replace'>('merge')
 const [replaceConfirm,setReplaceConfirm]=useState('')
 const [branchBusy,setBranchBusy]=useState(false)
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setSelected(null);setReference(null);setReferenceVersion(currentVersion)
  listDocumentVersions(projectId).then(data=>{if(active)setVersions(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[projectId,currentVersion,reloadIndex])
 useEffect(()=>{
  if(!canRestore){setBranches([]);return}
  let active=true
  listRestoreBranches(projectId).then(data=>{if(active)setBranches(data)}).catch(e=>{if(active)setDetailError(e instanceof Error?e.message:String(e))})
  return()=>{active=false}
 },[projectId,canRestore,reloadIndex])
 const createBranch=async(version:number)=>{
  setBranchBusy(true);setDetailError('')
  try{await createRestoreBranch(projectId,version);setRestoreCandidate(null);setRestoreConfirmation('');setReloadIndex(n=>n+1)}
  catch(e){setDetailError(e instanceof Error?e.message:String(e))}
  finally{setBranchBusy(false)}
 }
 const reviewBranch=async(id:string)=>{
  setBranchBusy(true);setDetailError('')
  try{const plan=await previewRestoreBranch(projectId,id);setBranchPreview(plan);setBranchMode('merge');setBranchChoices({});setReplaceConfirm('')}
  catch(e){setDetailError(e instanceof Error?e.message:String(e))}
  finally{setBranchBusy(false)}
 }
 const applyBranch=async()=>{
  if(!branchPreview||branchBusy||branchPreview.status!=='open')return
  if(branchMode==='replace'&&replaceConfirm!=='REEMPLAZAR')return
  if(branchMode==='merge'&&branchPreview.conflicts.some(path=>!branchChoices[path]))return
  setBranchBusy(true);setDetailError('')
  try{
   const result=await applyRestoreBranch(projectId,branchPreview.id,branchPreview.currentVersion,branchMode,branchChoices)
   await onRestored?.(result.version)
   setBranchPreview(null);onClose()
  }catch(e){setDetailError(e instanceof Error?e.message:String(e));setBranchPreview(null);setReloadIndex(n=>n+1)}
  finally{setBranchBusy(false)}
 }
 const discardBranch=async(id:string)=>{
  setBranchBusy(true);setDetailError('')
  try{await discardRestoreBranch(projectId,id);setBranchPreview(null);setReloadIndex(n=>n+1)}
  catch(e){setDetailError(e instanceof Error?e.message:String(e))}
  finally{setBranchBusy(false)}
 }
 const inspect=async(version:number)=>{
  setDetailLoading(true);setDetailError('');setSelected(null);setReference(null)
  try{const info=await loadDocumentVersion(projectId,version);setSelected(info);setDiagramId(info.document.diagrams[0]?.id||'')}
  catch(e){setDetailError(e instanceof Error?e.message:String(e))}
  finally{setDetailLoading(false)}
 }
 useEffect(()=>{
  if(!selected){setReference(null);return}
  let active=true
  setReference(null)
  loadDocumentVersion(projectId,referenceVersion).then(snapshot=>{if(active)setReference(snapshot)})
   .catch(e=>{if(active)setDetailError('Comparación: '+(e instanceof Error?e.message:String(e)))})
  return()=>{active=false}
 },[projectId,selected?.version,referenceVersion])
 const restore=async()=>{
  if(!canRestore||!selected||restoring||selected.version===currentVersion||restoreCandidate!==selected.version||restoreConfirmation.trim()!==`v${selected.version}`)return
  setRestoring(true);setDetailError('')
  try{
   const saved=await restoreDocumentVersion(projectId,selected.version,currentVersion)
   setRestoreCandidate(null);setRestoreConfirmation('')
   try{await onRestored?.(saved.version)}
   catch(e){setDetailError(`Versión v${saved.version} creada en el servidor, pero esta pestaña no logró actualizarse: ${e instanceof Error?e.message:String(e)}. Recarga el proyecto antes de continuar editando.`);return}
   onClose()
  }catch(e){setDetailError(e instanceof Error?e.message:String(e))}
  finally{setRestoring(false)}
 }
 const diagram=selected?.document.diagrams.find(d=>d.id===diagramId)
 const differences=selected&&reference?compareVersions(selected.document,reference.document):null
 return <Overlay title="Historial de versiones" onClose={onClose} wide>
  <div className="modal-body history-panel">
   <p className="dialog-description">Versionado del <strong>proyecto completo</strong>. Hasta 50 revisiones. El contenido histórico se filtra mediante tus permisos actuales. Restaurar crea una versión nueva, sin borrar las anteriores.</p>
   <div className="history-summary"><strong>Versión cargada: v{currentVersion}</strong><button type="button" className="ghost" onClick={()=>setReloadIndex(x=>x+1)}>Actualizar historial</button></div>
   {loading&&<p role="status">Cargando historial...</p>}
   {error&&<p role="alert">No se pudo cargar el historial: {error}</p>}
   {!loading&&!error&&!versions.length&&<p>No hay versiones registradas.</p>}
   {!loading&&!error&&<div className="history-list">{versions.map(item=><div key={item.version} className="history-row">
    <div><strong>v{item.version}{item.version===currentVersion?' · Cargada':''}</strong><small>{asDate(item.created_at)} · {item.editor_name||'Usuario no disponible'}</small></div>
    <button type="button" className="ghost" onClick={()=>void inspect(item.version)}>Consultar v{item.version}</button>
   </div>)}</div>}
   {detailLoading&&<p role="status">Cargando versión seleccionada...</p>}
   {detailError&&<p role="alert">No se pudo consultar la versión: {detailError}</p>}
   {selected&&<section className="history-detail" aria-label={`Detalle de versión ${selected.version}`}>
    <strong>Versión {selected.version} · Consulta visual</strong>
    <p>Guardada {asDate(selected.created_at)} por {selected.editor_name||'Usuario no disponible'}.</p>
    <p>{selected.document.diagrams.length} diagramas visibles · {Object.keys(selected.document.elements).length} elementos visibles.</p>
    {selected.document.diagrams.length>0&&<label className="revision-select">Diagrama histórico <select aria-label="Diagrama histórico" value={diagramId} onChange={e=>setDiagramId(e.target.value)}>{selected.document.diagrams.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    {diagram&&<VersionDiagramPreview diagram={diagram} document={selected.document}/>}
    <label className="revision-select">Comparar con versión <select aria-label="Versión para comparar" value={referenceVersion} onChange={e=>setReferenceVersion(Number(e.target.value))}>{versions.map(item=><option key={item.version} value={item.version}>v{item.version}</option>)}</select></label>
    {differences&&<section aria-label="Cambios entre versiones"><strong>{differences.length} cambios entre v{selected.version} y v{referenceVersion}</strong><ul className="revision-diff">{differences.slice(0,100).map((change,i)=><li key={i}>{change.action} · {change.kind}: {change.name}{change.fields?.length?` · ${change.fields.join(', ')}`:''}</li>)}</ul>{differences.length>100&&<p>Se muestran los primeros 100 cambios.</p>}</section>}
    {canRestore&&selected.version!==currentVersion&&<div className="history-restore-actions"><button type="button" className="danger outlined" disabled={restoring} onClick={()=>{setRestoreCandidate(selected.version);setRestoreConfirmation('');setDetailError('')}}>{`Restaurar v${selected.version} como nueva versión`}</button><button type="button" className="ghost" disabled={branchBusy} onClick={()=>void createBranch(selected.version)}>{`Preparar rama desde v${selected.version}`}</button></div>}
   {!canRestore&&<p className="history-note">Solo el propietario del proyecto puede restaurar el documento completo. Puedes consultar y comparar revisiones.</p>}
    <p className="history-note">Las versiones antiguas nunca se editan. Si existe otra actualización más reciente, la restauración se rechazará con conflicto 409.</p>
   </section>}
   {canRestore&&<section className="history-branches" aria-label="Ramas de restauración">
    <h3>Ramas de restauración</h3><p className="dialog-description">Una rama guarda la propuesta sin alterar el proyecto. Puedes revisar los conflictos y elegir el valor actual o histórico para cada uno. La aplicación final crea otra versión.</p>
    {!branches.some(b=>b.status==='open')&&<p className="history-note">No hay propuestas abiertas.</p>}
    {branches.filter(b=>b.status==='open').map(b=><div className="history-row" key={b.id}><div><strong>Propuesta desde v{b.source_version}</strong><small>Base v{b.base_version} · {asDate(b.created_at)} · {b.creator_name||'Propietario'}</small></div><button type="button" className="ghost" disabled={branchBusy} onClick={()=>void reviewBranch(b.id)}>Revisar rama</button><button type="button" className="danger outlined" disabled={branchBusy} onClick={()=>void discardBranch(b.id)}>Descartar</button></div>)}
   </section>}
   <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cerrar historial</button></div>
  </div>
  {branchPreview&&<Overlay title={`Revisar rama desde v${branchPreview.sourceVersion}`} onClose={()=>{if(!branchBusy){setBranchPreview(null);setDetailError('')}}} wide>
   <div className="modal-body">
    <p className="dialog-description">Rama creada desde la versión histórica v{branchPreview.sourceVersion} sobre la base v{branchPreview.baseVersion}. El proyecto está en v{branchPreview.currentVersion}. Ningún cambio se aplicará sin tu confirmación.</p>
    <label className="form-field"><span>Cómo aplicar la rama</span><select aria-label="Modo de aplicación" value={branchMode} onChange={e=>setBranchMode(e.target.value as 'merge'|'replace')}><option value="merge">Fusionar cambios independientes (recomendado)</option><option value="replace">Reemplazar el proyecto con la instantánea histórica</option></select></label>
    {branchMode==='merge'?<><strong>Conflictos detectados: {branchPreview.conflicts.length}</strong>{branchPreview.conflicts.length===0&&<p className="history-note">No hay colisiones. Los cambios independientes se conservarán.</p>}{branchPreview.conflicts.map(path=><label className="form-field" key={path}><span>Conflicto: <code>{path}</code></span><select aria-label={`Resolver ${path}`} value={branchChoices[path]||''} onChange={e=>setBranchChoices(old=>({...old,[path]:e.target.value as 'current'|'historical'}))}><option value="">Elige qué cambio conservar</option><option value="current">Conservar valor actual</option><option value="historical">Aplicar valor histórico</option></select></label>)}</>:<><p role="note" className="history-note">Reemplazar creará una versión nueva con todo el contenido histórico. El trabajo actual seguirá disponible en el historial, pero los colaboradores con borradores sin guardar deberán revisar sus cambios.</p><label className="form-field"><span>Para reemplazar todo, escribe <strong>REEMPLAZAR</strong></span><input aria-label="Confirmar reemplazo total" autoComplete="off" value={replaceConfirm} onChange={e=>setReplaceConfirm(e.target.value)}/></label></>}
    {detailError&&<p role="alert">{detailError}</p>}
    <div className="modal-actions"><button type="button" className="ghost" disabled={branchBusy} onClick={()=>setBranchPreview(null)}>Volver</button><button type="button" className="primary" disabled={branchBusy||(branchMode==='replace'?replaceConfirm!=='REEMPLAZAR':branchPreview.conflicts.some(path=>!branchChoices[path]))} onClick={()=>void applyBranch()}>{branchBusy?'Aplicando…':'Aplicar rama como nueva versión'}</button></div>
   </div>
  </Overlay>}
  {restoreCandidate!==null&&<Overlay title={`Confirmar restauración v${restoreCandidate}`} onClose={()=>{if(!restoring){setRestoreCandidate(null);setRestoreConfirmation('')}}}>
   <div className="modal-body">
    <p className="dialog-description">Se creará una <strong>nueva revisión del proyecto completo</strong> a partir de la v{restoreCandidate}. Las versiones anteriores no se eliminarán. Si otra persona ha guardado cambios, ATLAS rechazará la restauración y conservará su trabajo.</p>
    <label className="form-field"><span>Para confirmar, escribe <strong>v{restoreCandidate}</strong></span><input autoFocus aria-label="Confirmación de versión" value={restoreConfirmation} onChange={e=>setRestoreConfirmation(e.target.value)} placeholder={`v${restoreCandidate}`} autoComplete="off"/></label>
    {detailError&&<p role="alert">{detailError}</p>}
    <button type="button" className="ghost" disabled={branchBusy} onClick={()=>void createBranch(restoreCandidate)}>Preparar rama para revisar sin restaurar</button>
    <div className="modal-actions"><button type="button" className="ghost" disabled={restoring} onClick={()=>{setRestoreCandidate(null);setRestoreConfirmation('')}}>Cancelar</button><button type="button" className="danger outlined" disabled={restoring||restoreConfirmation.trim()!==`v${restoreCandidate}`} onClick={()=>void restore()}>{restoring?'Restaurando…':'Crear versión restaurada'}</button></div>
   </div>
  </Overlay>}
 </Overlay>
}
