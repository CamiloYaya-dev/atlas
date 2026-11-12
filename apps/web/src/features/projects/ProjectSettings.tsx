import {useEffect,useState} from 'react'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {renameProject,deleteProject,projectMembers,projectCandidates,assignProjectMember,removeProjectMember} from './api'
import type {ProjectMember,ProjectCandidate,ProjectRole} from './api'
import type {Project} from '@atlas/contracts'
import type {WorkspaceAccess} from '../security/types'
interface Props {project:Project;access:WorkspaceAccess|null;canEditNow:boolean;onClose:()=>void;onRenamed:(project:Project)=>void;onDeleted:(id:string)=>void}
export default function ProjectSettings({project,access,canEditNow,onClose,onRenamed,onDeleted}:Props){
 const [name,setName]=useState(project.name),[members,setMembers]=useState<ProjectMember[]>([])
 const [candidates,setCandidates]=useState<ProjectCandidate[]>([]),[roles,setRoles]=useState<ProjectRole[]>([])
 const [userId,setUserId]=useState(''),[roleId,setRoleId]=useState('')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const can=(key:string)=>access?.roleKey==='owner'||!!access?.permissions.includes(key)
 async function reload(){if(!can('project.members.manage'))return
  const [m,c]=await Promise.all([projectMembers(project.id),projectCandidates(project.id)])
  setMembers(m);setCandidates(c.users);setRoles(c.roles)
 }
 useEffect(()=>{void reload().catch(e=>setError(String((e as Error).message)))},[project.id,access?.roleId])
 async function execute(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await action()}catch(e){setError((e as Error).message||String(e))}finally{setBusy(false)}}
 return <Overlay title={`Administrar proyecto: ${project.name}`} onClose={onClose} wide><div className="modal-body">
  <p className="sec-help">El acceso a este proyecto es independiente del acceso al espacio. Solo ven el proyecto los usuarios asignados y el propietario del espacio.</p>
  {error&&<div className="sec-error" role="alert">{error}</div>}{notice&&<div className="sec-notice">{notice}</div>}
  {can('project.rename')&&<><Field label="Nombre del proyecto"><input value={name} disabled={busy||!canEditNow} onChange={e=>setName(e.target.value)}/></Field><div className="modal-actions"><button className="primary" disabled={busy||!canEditNow||name.trim().length<2} onClick={()=>void execute(async()=>{const updated=await renameProject(project.id,name.trim());onRenamed(updated);setNotice('Nombre actualizado')})}>Guardar nombre</button></div></>}
  {can('project.members.manage')&&<><h4>Personas con acceso a este proyecto</h4><div className="sec-rows">{members.map(m=><div className="sec-user-row" key={m.id}><div><strong>{m.name}</strong><small>{m.email} · {m.role_name}</small></div>{m.role_key!=='owner'&&<button disabled={busy} onClick={()=>void execute(async()=>{await removeProjectMember(project.id,m.id);await reload();setNotice('Acceso retirado')})}>Quitar</button>}</div>)}</div>
  <h4>Conceder o cambiar acceso</h4><div className="sec-inputs"><select aria-label="Usuario del espacio" value={userId} onChange={e=>setUserId(e.target.value)}><option value="">Selecciona una persona del espacio</option>{candidates.map(u=><option value={u.id} key={u.id}>{u.name} · {u.email}</option>)}</select><select aria-label="Rol para el proyecto" value={roleId} onChange={e=>setRoleId(e.target.value)}><option value="">Selecciona un rol</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="primary" disabled={busy||!userId||!roleId} onClick={()=>void execute(async()=>{await assignProjectMember(project.id,userId,roleId);await reload();setNotice('Acceso actualizado')})}>Asignar</button></div>
  <p className="sec-help">¿No aparece la persona? Primero asígnala al espacio desde «Accesos → Miembros». Los roles personalizados se configuran allí, pero se conceden individualmente por proyecto.</p></>}
  {can('project.delete')&&<div className="sec-create-role"><h4>Eliminar proyecto</h4><p className="sec-help">Esta acción elimina los diagramas y todas las versiones del proyecto. No afecta los demás proyectos.</p><button className="danger outlined" disabled={busy||!canEditNow} onClick={()=>{const typed=window.prompt(`Para eliminar el proyecto, escribe exactamente «${project.name}»`);if(typed!==project.name)return;void execute(async()=>{await deleteProject(project.id);onDeleted(project.id)})}}>Eliminar proyecto definitivamente</button></div>}
  <div className="modal-actions"><button onClick={onClose}>Cerrar</button></div>
 </div></Overlay>
}
