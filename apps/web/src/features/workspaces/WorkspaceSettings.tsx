import {useState} from 'react'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {renameWorkspace,deleteWorkspace} from './api'
import type {Workspace} from '@atlas/contracts'
import type {WorkspaceAccess} from '../security/types'
interface Props {workspace:Workspace;access:WorkspaceAccess|null;onClose:()=>void;onRenamed:(id:string,name:string)=>void;onDeleted:(id:string)=>void}
export default function WorkspaceSettings({workspace,access,onClose,onRenamed,onDeleted}:Props){
 const [name,setName]=useState(workspace.name),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const can=(key:string)=>access?.roleKey==='owner'||!!access?.permissions.includes(key)
 async function rename(){if(name.trim().length<2)return;setBusy(true);setError('');try{const result=await renameWorkspace(workspace.id,name.trim());onRenamed(result.id,result.name)}catch(e){setError(String((e as Error).message))}finally{setBusy(false)}}
 async function remove(){if(!can('workspace.delete'))return
  const typed=window.prompt(`Escribe exactamente «${workspace.name}» para eliminar este espacio. Debe estar vacío de proyectos.`)
  if(typed!==workspace.name)return
  setBusy(true);setError('');try{await deleteWorkspace(workspace.id);onDeleted(workspace.id)}catch(e){setError(String((e as Error).message))}finally{setBusy(false)}
 }
 return <Overlay title={`Administrar espacio: ${workspace.name}`} onClose={onClose} wide>
  <div className="modal-body">
   <p className="sec-help">Los permisos de este espacio determinan quién puede crear proyectos, administrar miembros y modificar el espacio. Los proyectos tienen accesos independientes.</p>
   {error&&<div role="alert" className="sec-error">{error}</div>}
   <Field label="Nombre del espacio"><input value={name} disabled={!can('workspace.rename')||busy} onChange={e=>setName(e.target.value)}/></Field>
   <div className="modal-actions"><button onClick={onClose}>Cerrar</button>{can('workspace.rename')&&<button className="primary" disabled={busy||name.trim().length<2} onClick={()=>void rename()}>Guardar nombre</button>}</div>
   {can('workspace.delete')&&<div className="sec-create-role"><h4>Eliminar espacio</h4><p className="sec-help">Por seguridad solo se puede eliminar un espacio sin proyectos. Elimina o traslada manualmente sus proyectos primero.</p><button className="danger outlined" disabled={busy} onClick={()=>void remove()}>Eliminar espacio vacío</button></div>}
  </div>
 </Overlay>
}
