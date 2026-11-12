import {useCallback,useEffect,useState} from 'react'
import {Overlay} from '../../components/molecules/Overlay'
import {listAuditEvents} from './api'
import type {AuditEvent} from './api'
const eventNames:Record<string,string>={
 'project.created':'Proyecto creado','project.renamed':'Proyecto renombrado',
 'project.document_save':'Documento guardado','project.document_import':'Documento importado',
 'project.document_restore':'Versión restaurada','workspace.role_policy_changed':'Permisos modificados',
 'workspace.membership_changed':'Miembro asignado','workspace.membership_removed':'Miembro retirado'
}
export default function AuditPanel({workspaceId,onClose}:{workspaceId:string;onClose:()=>void}){
 const [items,setItems]=useState<AuditEvent[]>([])
 const [cursor,setCursor]=useState<string|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const load=useCallback(async(next?:string)=>{
  setLoading(true);setError('')
  try{const page=await listAuditEvents(workspaceId,30,next);setItems(old=>next?[...old,...page.items]:page.items);setCursor(page.nextCursor)}
  catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[workspaceId])
 useEffect(()=>{void load()},[load])
 return <Overlay title="Actividad y auditoría" onClose={onClose} wide>
  <div className="modal-body audit-panel">
   <p className="dialog-description">Registro de acciones de este espacio de trabajo, ordenado del evento más reciente al más antiguo. Solo usuarios autorizados pueden consultarlo.</p>
   <div className="history-summary"><strong>{items.length} eventos cargados</strong><button className="ghost" onClick={()=>void load()}>Actualizar actividad</button></div>
   {error&&<p role="alert">No se pudo cargar la auditoría: {error}</p>}
   {!loading&&!items.length&&!error&&<p>No existen eventos en este espacio.</p>}
   <ol className="audit-list">{items.map(item=><li key={item.id} className="audit-row">
    <strong>{eventNames[item.event_type]||item.event_type}</strong>
    <small>{item.actor_name}{item.actor_email?` · ${item.actor_email}`:''} · {new Date(item.created_at).toLocaleString('es-CO')}</small>
    {item.resource_id&&<small>Proyecto / recurso: {item.resource_name||item.resource_id}</small>}
    {Object.keys(item.detail).length>0&&<small>Detalles: {Object.entries(item.detail).map(([key,value])=>`${key}: ${String(value)}`).join(' · ')}</small>}
   </li>)}</ol>
   {loading&&<p role="status">Cargando actividad...</p>}
   {cursor&&!loading&&<button className="ghost" onClick={()=>void load(cursor)}>Cargar eventos anteriores</button>}
   <div className="modal-actions"><button className="ghost" onClick={onClose}>Cerrar</button></div>
  </div>
 </Overlay>
}
