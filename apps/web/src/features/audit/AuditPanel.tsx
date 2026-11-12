import {useEffect,useState} from 'react'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {listAuditEvents} from './api'
import {listProjects} from '../projects/api'
import type {Project} from '@atlas/contracts'
import type {AuditEvent,AuditFilters} from './api'
const eventNames:Record<string,string>={
 'project.created':'Proyecto creado','project.renamed':'Proyecto renombrado','project.deleted':'Proyecto eliminado',
 'project.document_save':'Documento guardado','project.document_import':'Documento importado','project.document_restore':'Versión restaurada',
 'project.membership_changed':'Acceso al proyecto asignado','project.membership_removed':'Acceso al proyecto retirado',
 'workspace.created':'Espacio creado','workspace.renamed':'Espacio renombrado','workspace.deleted':'Espacio eliminado',
 'workspace.role_policy_changed':'Permisos modificados','workspace.membership_changed':'Miembro asignado','workspace.membership_removed':'Miembro retirado'
}
const formatDate=(value:string)=>new Date(value).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'})
const initial:AuditFilters={eventType:'',actor:'',projectId:'',from:'',to:''}
export default function AuditPanel({workspaceId,onClose}:{workspaceId:string;onClose:()=>void}){
 const [filters,setFilters]=useState<AuditFilters>(initial)
 const [applied,setApplied]=useState<AuditFilters>(initial)
 const [pageSize,setPageSize]=useState(25)
 const [cursors,setCursors]=useState<(string|undefined)[]>([undefined])
 const [page,setPage]=useState(0)
 const [items,setItems]=useState<AuditEvent[]>([])
 const [next,setNext]=useState<string|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [refresh,setRefresh]=useState(0)
 const [projects,setProjects]=useState<Project[]>([])
 useEffect(()=>{let active=true;listProjects(workspaceId).then(data=>{if(active)setProjects(data)}).catch(()=>{if(active)setProjects([])});return()=>{active=false}},[workspaceId])
 useEffect(()=>{
  let active=true
  setLoading(true);setError('')
  listAuditEvents(workspaceId,pageSize,cursors[page],applied)
   .then(result=>{if(active){setItems(result.items);setNext(result.nextCursor)}})
   .catch(e=>{if(active){setItems([]);setNext(null);setError(e instanceof Error?e.message:String(e))}})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[workspaceId,pageSize,page,cursors,applied,refresh])
 const reset=(values:AuditFilters,limit=pageSize)=>{setApplied(values);setPageSize(limit);setCursors([undefined]);setPage(0);setNext(null)}
 const nextPage=()=>{if(!next)return;setCursors(prev=>[...prev.slice(0,page+1),next]);setPage(n=>n+1)}
 const prevPage=()=>setPage(n=>Math.max(0,n-1))
 return <Overlay title="Actividad y auditoría" onClose={onClose} wide>
  <div className="modal-body audit-panel">
   <p className="dialog-description">Actividad registrada en este espacio. Los filtros se aplican en el servidor y respetan los permisos de los proyectos.</p>
   <form className="audit-filters" onSubmit={e=>{e.preventDefault();reset(filters)}}>
    <Field label="Acción"><select aria-label="Filtrar acción" value={filters.eventType||''} onChange={e=>setFilters(f=>({...f,eventType:e.target.value}))}>
     <option value="">Todas las acciones</option>{Object.entries(eventNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></Field>
    <Field label="Usuario"><input aria-label="Filtrar usuario" placeholder="Nombre o correo" value={filters.actor||''} maxLength={100} onChange={e=>setFilters(f=>({...f,actor:e.target.value}))}/></Field>
    <Field label="Proyecto"><select aria-label="Filtrar proyecto" value={filters.projectId||''} onChange={e=>setFilters(f=>({...f,projectId:e.target.value}))}><option value="">Todos los proyectos autorizados</option>{projects.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Desde"><input aria-label="Desde" type="date" value={filters.from||''} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/></Field>
    <Field label="Hasta"><input aria-label="Hasta" type="date" value={filters.to||''} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></Field>
    <div className="audit-filter-actions"><button type="submit" className="primary">Aplicar filtros</button><button type="button" className="ghost" onClick={()=>{setFilters(initial);reset(initial)}}>Limpiar</button></div>
   </form>
   <div className="audit-toolbar"><strong>Resultados · página {page+1}</strong><label>Filas por página <select aria-label="Filas por página" value={pageSize} onChange={e=>reset(applied,Number(e.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button type="button" className="ghost" onClick={()=>setRefresh(x=>x+1)}>Actualizar actividad</button></div>
   {error&&<p role="alert" className="sec-error">No se pudo cargar la auditoría: {error}</p>}
   <div className="audit-table-scroll"><table className="audit-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Proyecto / recurso</th><th>Detalle</th></tr></thead><tbody>
    {!loading&&!items.length&&<tr><td colSpan={5}>No hay eventos que coincidan con los filtros.</td></tr>}
    {items.map(item=><tr key={item.id}><td>{formatDate(item.created_at)}</td><td><strong>{item.actor_name}</strong><small>{item.actor_email}</small></td><td>{eventNames[item.event_type]||item.event_type}</td><td>{item.resource_name||item.resource_id||'Espacio de trabajo'}</td><td>{Object.keys(item.detail||{}).length?Object.entries(item.detail).map(([key,value])=>`${key}: ${String(value)}`).join(' · '):'—'}</td></tr>)}
   </tbody></table></div>
   {loading&&<p role="status">Cargando actividad...</p>}
   <div className="audit-pagination"><span>Mostrando {items.length} registros en esta página</span><button type="button" className="ghost" disabled={loading||page===0} onClick={prevPage}>Anterior</button><strong>{page+1}</strong><button type="button" className="ghost" disabled={loading||!next} onClick={nextPage}>Siguiente</button></div>
   <div className="modal-actions"><button className="ghost" onClick={onClose}>Cerrar</button></div>
  </div>
 </Overlay>
}
