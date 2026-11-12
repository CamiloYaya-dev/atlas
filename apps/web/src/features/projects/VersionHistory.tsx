import {useEffect,useState} from 'react'
import {Overlay} from '../../components/molecules/Overlay'
import {listDocumentVersions,loadDocumentVersion,restoreDocumentVersion} from './api'
import type {DocumentVersion,DocumentVersionSnapshot} from './api'
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
 const [reloadIndex,setReloadIndex]=useState(0)
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setSelected(null);setReference(null);setReferenceVersion(currentVersion)
  listDocumentVersions(projectId).then(data=>{if(active)setVersions(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[projectId,currentVersion,reloadIndex])
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
  if(!canRestore||!selected||restoring||selected.version===currentVersion)return
  if(!window.confirm(`¿Restaurar la revisión v${selected.version}? Se creará una versión NUEVA y se conservará todo el historial. Si otra persona guardó antes, se bloqueará la operación.`))return
  setRestoring(true);setDetailError('')
  try{
   const saved=await restoreDocumentVersion(projectId,selected.version,currentVersion)
   await onRestored?.(saved.version)
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
    {canRestore&&selected.version!==currentVersion&&<button type="button" className="danger outlined" disabled={restoring} onClick={()=>void restore()}>{restoring?'Restaurando...':`Restaurar v${selected.version} como nueva versión`}</button>}
    <p className="history-note">Las versiones antiguas nunca se editan. Si existe otra actualización más reciente, la restauración se rechazará con conflicto 409.</p>
   </section>}
   <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cerrar historial</button></div>
  </div>
 </Overlay>
}
