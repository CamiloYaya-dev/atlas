import {useEffect,useState} from 'react'
import {Overlay} from '../../components/molecules/Overlay'
import {listDocumentVersions,loadDocumentVersion} from './api'
import type {DocumentVersion,DocumentVersionSnapshot} from './api'

const asDate=(date:string)=>{const value=new Date(date);return Number.isNaN(value.getTime())?date:value.toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}

/** Historial de lectura: ninguna acción de este componente modifica un documento. */
export default function VersionHistory({projectId,currentVersion,onClose}:{projectId:string;currentVersion:number;onClose:()=>void}){
 const [versions,setVersions]=useState<DocumentVersion[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [selected,setSelected]=useState<DocumentVersionSnapshot|null>(null)
 const [detailLoading,setDetailLoading]=useState(false)
 const [detailError,setDetailError]=useState('')
 const [reloadIndex,setReloadIndex]=useState(0)
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setSelected(null)
  listDocumentVersions(projectId).then(data=>{if(active)setVersions(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[projectId,currentVersion,reloadIndex])
 const inspect=async(version:number)=>{
  setDetailLoading(true);setDetailError('');setSelected(null)
  try{const info=await loadDocumentVersion(projectId,version);setSelected(info)}
  catch(e){setDetailError(e instanceof Error?e.message:String(e))}
  finally{setDetailLoading(false)}
 }
 const diagramElements=(snapshot:DocumentVersionSnapshot)=>snapshot.document.diagrams.reduce((count,d)=>count+d.nodes.length,0)
 return <Overlay title="Historial de versiones" onClose={onClose} wide>
  <div className="modal-body history-panel">
   <p className="dialog-description">Versiones guardadas del <strong>proyecto completo</strong>, no de cada diagrama por separado. Se muestran los últimos 50 registros. Las versiones antiguas se consultan en modo lectura y con tus permisos actuales.</p>
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
    <strong>Versión {selected.version} · Solo lectura</strong>
    <p>Guardada {asDate(selected.created_at)} por {selected.editor_name||'Usuario no disponible'}.</p>
    <p>{selected.document.diagrams.length} diagramas visibles · {Object.keys(selected.document.elements).length} elementos visibles · {diagramElements(selected)} cajas distribuidas en vistas visibles.</p>
    <ul>{selected.document.diagrams.map(diagram=><li key={diagram.id}>{diagram.name} · {diagram.nodes.length} cajas</li>)}</ul>
    <p className="history-note">Esta vista no restaura ni sobrescribe información. Los diagramas y elementos ocultos por permisos tampoco se muestran aquí.</p>
   </section>}
   <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cerrar historial</button></div>
  </div>
 </Overlay>
}
