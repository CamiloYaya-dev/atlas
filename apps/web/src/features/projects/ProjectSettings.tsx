import {useEffect,useState} from 'react'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {DeleteConfirmation} from '../../components/molecules/DeleteConfirmation'
import {renameProject,deleteProject} from './api'
import type {Project} from '@novzi/contracts'
import type {WorkspaceAccess} from '../security/types'
interface Props {project:Project;access:WorkspaceAccess|null;canEditNow:boolean;onClose:()=>void;onRenamed:(project:Project)=>void;onDeleted:(id:string)=>void}
export default function ProjectSettings({project,access,canEditNow,onClose,onRenamed,onDeleted}:Props){
 const [name,setName]=useState(project.name)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [confirmDelete,setConfirmDelete]=useState(false)
 const can=(key:string)=>access?.roleKey==='owner'||!!access?.permissions.includes(key)
 useEffect(()=>setName(project.name),[project.id,project.name])
 async function execute(action:()=>Promise<void>):Promise<boolean>{setBusy(true);setError('');setNotice('');try{await action();return true}catch(e){setError((e as Error).message||String(e));return false}finally{setBusy(false)}}
 async function removeProject(){await execute(async()=>{await deleteProject(project.id);onDeleted(project.id)})}
 return <>
  {!confirmDelete&&<Overlay title={`Administrar proyecto: ${project.name}`} onClose={onClose} wide><div className="modal-body">
   <p className="sec-help">El acceso a este proyecto es independiente del acceso al espacio. Solo lo ven los usuarios asignados y el propietario del espacio.</p>
   {error&&!confirmDelete&&<div className="sec-error" role="alert">{error}</div>}
   {notice&&<div className="sec-notice" role="status">{notice}</div>}
   {can('project.rename')&&<><Field label="Nombre del proyecto"><input value={name} disabled={busy||!canEditNow} onChange={e=>setName(e.target.value)}/></Field><div className="modal-actions"><button className="primary" disabled={busy||!canEditNow||name.trim().length<2||name.trim()===project.name} onClick={()=>void execute(async()=>{const updated=await renameProject(project.id,name.trim());onRenamed(updated);setNotice('Nombre del proyecto actualizado correctamente.')})}>Guardar nombre</button></div></>}
   <p className="sec-help">Para gestionar cuentas, roles y acceso a este proyecto, abre «Usuarios y accesos de la organización» desde el selector de organización.</p>
   {can('project.delete')&&<div className="sec-create-role"><h4>Eliminar proyecto</h4><p className="sec-help">Esta acción eliminará los diagramas, elementos y todas las versiones del proyecto. No afecta los demás proyectos.</p><button className="danger outlined" disabled={busy||!canEditNow} onClick={()=>{setError('');setConfirmDelete(true)}}>Eliminar proyecto definitivamente</button></div>}
   <div className="modal-actions"><button onClick={onClose}>Cerrar</button></div>
  </div></Overlay>}
  {confirmDelete&&<DeleteConfirmation title={`Eliminar proyecto: ${project.name}`} name={project.name} description="Esta acción es irreversible. Confirma el nombre exacto del proyecto para continuar." consequences="Se perderán todos los diagramas, elementos y revisiones históricas de este proyecto. Los demás proyectos conservarán su contenido." busy={busy} error={error} onCancel={()=>{setConfirmDelete(false);setError('')}} onConfirm={removeProject}/>}
 </>
}
