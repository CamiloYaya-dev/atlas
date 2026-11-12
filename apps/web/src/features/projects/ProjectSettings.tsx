import {useEffect,useState} from 'react'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {DeleteConfirmation} from '../../components/molecules/DeleteConfirmation'
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
 const [confirmDelete,setConfirmDelete]=useState(false),[memberToRemove,setMemberToRemove]=useState<ProjectMember|null>(null)
 const can=(key:string)=>access?.roleKey==='owner'||!!access?.permissions.includes(key)
 useEffect(()=>setName(project.name),[project.id,project.name])
 async function reload(){if(!can('project.members.manage'))return
  const [m,c]=await Promise.all([projectMembers(project.id),projectCandidates(project.id)])
  setMembers(m);setCandidates(c.users);setRoles(c.roles)
 }
 useEffect(()=>{void reload().catch(e=>setError(String((e as Error).message)))},[project.id,access?.roleId])
 async function execute(action:()=>Promise<void>):Promise<boolean>{setBusy(true);setError('');setNotice('');try{await action();return true}catch(e){setError((e as Error).message||String(e));return false}finally{setBusy(false)}}
 async function removeMember(){if(!memberToRemove)return;const member=memberToRemove
  const ok=await execute(async()=>{await removeProjectMember(project.id,member.id);await reload()})
  if(ok){setMemberToRemove(null);setNotice(`Acceso retirado a ${member.name}.`)}
 }
 async function removeProject(){await execute(async()=>{await deleteProject(project.id);onDeleted(project.id)})}
 return <>
  {!confirmDelete&&!memberToRemove&&<Overlay title={`Administrar proyecto: ${project.name}`} onClose={onClose} wide><div className="modal-body">
   <p className="sec-help">El acceso a este proyecto es independiente del acceso al espacio. Solo lo ven los usuarios asignados y el propietario del espacio.</p>
   {error&&!confirmDelete&&!memberToRemove&&<div className="sec-error" role="alert">{error}</div>}
   {notice&&<div className="sec-notice" role="status">{notice}</div>}
   {can('project.rename')&&<><Field label="Nombre del proyecto"><input value={name} disabled={busy||!canEditNow} onChange={e=>setName(e.target.value)}/></Field><div className="modal-actions"><button className="primary" disabled={busy||!canEditNow||name.trim().length<2||name.trim()===project.name} onClick={()=>void execute(async()=>{const updated=await renameProject(project.id,name.trim());onRenamed(updated);setNotice('Nombre del proyecto actualizado correctamente.')})}>Guardar nombre</button></div></>}
   {can('project.members.manage')&&<><h4>Personas con acceso a este proyecto</h4><div className="sec-rows">{members.map(m=><div className="sec-user-row" key={m.id}><div><strong>{m.name}</strong><small>{m.email} · {m.role_name}</small></div>{m.role_key!=='owner'&&<button disabled={busy} aria-label={`Quitar acceso a ${m.name}`} onClick={()=>{setError('');setMemberToRemove(m)}}>Quitar</button>}</div>)}</div>
    <h4>Conceder o cambiar acceso</h4><div className="sec-inputs"><select aria-label="Usuario del espacio" value={userId} onChange={e=>setUserId(e.target.value)}><option value="">Selecciona una persona del espacio</option>{candidates.map(u=><option value={u.id} key={u.id}>{u.name} · {u.email}</option>)}</select><select aria-label="Rol para el proyecto" value={roleId} onChange={e=>setRoleId(e.target.value)}><option value="">Selecciona un rol</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="primary" disabled={busy||!userId||!roleId} onClick={()=>void execute(async()=>{await assignProjectMember(project.id,userId,roleId);await reload();setUserId('');setRoleId('');setNotice('Acceso al proyecto actualizado correctamente.')})}>Asignar</button></div>
    <p className="sec-help">¿No aparece la persona? Primero asígnala al espacio desde «Accesos → Miembros». El rol se concede de forma independiente para cada proyecto.</p></>}
   {can('project.delete')&&<div className="sec-create-role"><h4>Eliminar proyecto</h4><p className="sec-help">Esta acción eliminará los diagramas, elementos y todas las versiones del proyecto. No afecta los demás proyectos.</p><button className="danger outlined" disabled={busy||!canEditNow} onClick={()=>{setError('');setConfirmDelete(true)}}>Eliminar proyecto definitivamente</button></div>}
   <div className="modal-actions"><button onClick={onClose}>Cerrar</button></div>
  </div></Overlay>}
  {confirmDelete&&<DeleteConfirmation title={`Eliminar proyecto: ${project.name}`} name={project.name} description="Esta acción es irreversible. Confirma el nombre exacto del proyecto para continuar." consequences="Se perderán todos los diagramas, elementos y revisiones históricas de este proyecto. Los demás proyectos conservarán su contenido." busy={busy} error={error} onCancel={()=>{setConfirmDelete(false);setError('')}} onConfirm={removeProject}/>}
  {memberToRemove&&<Overlay title="Quitar acceso al proyecto" onClose={()=>{if(!busy){setMemberToRemove(null);setError('')}}}>
   <div className="modal-body"><p className="sec-help">¿Retirar a <strong>{memberToRemove.name}</strong> ({memberToRemove.email}) de «{project.name}»? Esta acción no eliminará su cuenta ni su acceso a otros proyectos.</p>{error&&<div className="sec-error" role="alert">{error}</div>}<div className="modal-actions"><button className="ghost" disabled={busy} onClick={()=>{setMemberToRemove(null);setError('')}}>Cancelar</button><button className="danger outlined" disabled={busy} onClick={()=>void removeMember()}>{busy?'Retirando…':'Quitar acceso'}</button></div></div>
  </Overlay>}
 </>
}
