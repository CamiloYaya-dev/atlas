import {useEffect,useMemo,useState} from 'react'
import {PERMISSIONS,permissionLabel} from '@atlas/contracts'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {workspaceRoles,workspaceMembers,usersList,createUser,createRole,updateRole,assignMember,removeMember,setUserActive} from './api'
import type {RoleDetails,UserAccount,Member} from './api'
import type {WorkspaceAccess} from './types'
import {UserPlus,ShieldCheck,Users,Save,Plus,UserX,RefreshCw} from 'lucide-react'
type Props={workspaceId:string;access:WorkspaceAccess|null;platformAdmin:boolean;onClose:()=>void}
const keyOf=(p:string)=>p.startsWith('diagram.')?'Diagramas':p.startsWith('element.')?'Elementos':p.startsWith('relation.')?'Relaciones':'Operaciones generales'
export default function SecurityPanel({workspaceId,access,platformAdmin,onClose}:Props){
 const canRoles=access?.roleKey==='owner'||access?.permissions.includes('workspace.roles.manage')
 const canMembers=access?.roleKey==='owner'||access?.permissions.includes('workspace.members.manage')
 const [tab,setTab]=useState<'roles'|'members'|'users'>(canRoles?'roles':canMembers?'members':'users')
 const [roles,setRoles]=useState<RoleDetails[]>([]),[members,setMembers]=useState<Member[]>([]),[users,setUsers]=useState<UserAccount[]>([])
 const [picked,setPicked]=useState(''),[selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState('')
 const [newRole,setNewRole]=useState(''),[newRoleKey,setNewRoleKey]=useState('')
 const [newEmail,setNewEmail]=useState(''),[newName,setNewName]=useState(''),[newPass,setNewPass]=useState('')
 const [memberId,setMemberId]=useState(''),[assignRole,setAssignRole]=useState('')
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[err,setErr]=useState('')
 const activeRole=roles.find(x=>x.id===picked)
 const refresh=async()=>{
  const [r,m,u]=await Promise.all([canRoles||canMembers?workspaceRoles(workspaceId).catch(()=>[]):Promise.resolve([]),canMembers?workspaceMembers(workspaceId):Promise.resolve([]),platformAdmin?usersList():Promise.resolve([])])
  setRoles(r);setMembers(m);setUsers(u)
  setPicked(old=>r.some(x=>x.id===old)?old:r.find(x=>x.role_key==='functional')?.id||r[0]?.id||'')
 }
 useEffect(()=>{refresh().catch(e=>setErr(String(e.message)))},[workspaceId])
 useEffect(()=>{setSelected(activeRole?.permissions||[])},[activeRole?.id,roles])
 async function act(action:()=>Promise<unknown>,msg:string){setBusy(true);setErr('');setNotice('');try{await action();setNotice(msg);await refresh()}catch(e){setErr(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const filtered=useMemo(()=>PERMISSIONS.filter(x=>permissionLabel(x).toLowerCase().includes(query.toLowerCase())||x.includes(query.toLowerCase())),[query])
 const sections=['Operaciones generales','Diagramas','Elementos','Relaciones']
 return <Overlay title="Usuarios y políticas de acceso" onClose={onClose} wide>
  <div className="security-console">
   <p className="sec-help">Administración de acciones atómicas. Los permisos se aplican en la API y en el editor; ocultar un botón no autoriza una operación.</p>
   <div className="sec-tabs">
    {canRoles&&<button className={tab==='roles'?'on':''} onClick={()=>setTab('roles')}><ShieldCheck size={15}/> Roles y comportamientos</button>}
    {canMembers&&<button className={tab==='members'?'on':''} onClick={()=>setTab('members')}><Users size={15}/> Miembros</button>}
    {platformAdmin&&<button className={tab==='users'?'on':''} onClick={()=>setTab('users')}><UserPlus size={15}/> Cuentas</button>}
    <button onClick={()=>refresh().catch(e=>setErr(e.message))}><RefreshCw size={14}/> Recargar</button>
   </div>
   {notice&&<div className="sec-notice">{notice}</div>}{err&&<div className="sec-error">{err}</div>}
   {tab==='roles'&&canRoles&&<>
    <div className="sec-role-line"><Field label="Rol a configurar"><select value={picked} onChange={e=>setPicked(e.target.value)}>{roles.map(r=><option key={r.id} value={r.id}>{r.name} ({r.role_key})</option>)}</select></Field><Field label="Filtrar permisos"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="C1, container, relation..."/></Field></div>
    {activeRole&&<p className="sec-help">{activeRole.role_key==='owner'?'Propietario tiene todos los permisos y su política no es modificable.':`Editando ${activeRole.name}: ${selected.length} capacidades concedidas de ${PERMISSIONS.length}.`}</p>}
    <div className="sec-permission-scroll">{sections.map(section=><div className="sec-permission-section" key={section}><h4>{section}</h4><div className="sec-check-grid">{filtered.filter(p=>keyOf(p)===section).map(p=><label className="sec-check" key={p} title={p}><input type="checkbox" disabled={activeRole?.role_key==='owner'} checked={activeRole?.role_key==='owner'||selected.includes(p)} onChange={e=>setSelected(old=>e.target.checked?[...old,p]:old.filter(x=>x!==p))}/><span>{permissionLabel(p)}<small>{p}</small></span></label>)}</div></div>)}</div>
    <div className="sec-actions"><button className="primary" disabled={busy||!activeRole||activeRole.role_key==='owner'} onClick={()=>act(()=>updateRole(workspaceId,picked,selected),'Permisos guardados correctamente')}><Save size={15}/> Guardar política</button></div>
    <div className="sec-create-role"><h4>Nuevo rol personalizado</h4><div className="sec-inputs"><input placeholder="Nombre (ej. QA funcional)" value={newRole} onChange={e=>setNewRole(e.target.value)}/><input placeholder="Clave (ej. qa_funcional)" value={newRoleKey} onChange={e=>setNewRoleKey(e.target.value)}/><button className="ghost" disabled={busy||newRole.length<2||newRoleKey.length<2} onClick={()=>act(()=>createRole(workspaceId,{name:newRole,roleKey:newRoleKey,permissions:selected}), 'Rol creado')}><Plus size={14}/> Crear</button></div></div>
   </>}
   {tab==='members'&&canMembers&&<>
    <h4>Miembros del espacio</h4>
    <div className="sec-rows">{members.map(m=><div className="sec-user-row" key={m.id}><div><strong>{m.name}</strong><small>{m.email} · {m.role_name}</small></div>{m.role_key!=='owner'&&<button className="ghost" disabled={busy} onClick={()=>act(()=>removeMember(workspaceId,m.id),'Acceso retirado')}><UserX size={14}/> Quitar</button>}</div>)}</div>
    <h4>Asignar un usuario existente</h4>
    <div className="sec-inputs"><select value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Seleccionar usuario</option>{users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</select><select value={assignRole} onChange={e=>setAssignRole(e.target.value)}><option value="">Seleccionar rol</option>{roles.filter(x=>x.role_key!=='owner').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="primary" disabled={!memberId||!assignRole||busy} onClick={()=>act(()=>assignMember(workspaceId,memberId,assignRole),'Miembro asignado')}><Plus size={14}/> Asignar</button></div>
    {!platformAdmin&&<p className="sec-help">Para crear cuentas nuevas, solicita al administrador principal que las aprovisione.</p>}
   </>}
   {tab==='users'&&platformAdmin&&<>
    <h4>Alta de usuarios — acceso cerrado</h4><p className="sec-help">Solo un administrador principal crea cuentas. No existe registro público.</p>
    <div className="sec-create-user"><Field label="Nombre"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre completo"/></Field><Field label="Email"><input value={newEmail} type="email" onChange={e=>setNewEmail(e.target.value)} placeholder="usuario@empresa.com"/></Field><Field label="Contraseña inicial"><input value={newPass} type="password" minLength={12} autoComplete="new-password" onChange={e=>setNewPass(e.target.value)} placeholder="Mínimo 12 caracteres"/></Field><button className="primary" disabled={busy||newPass.length<12||!newEmail||!newName} onClick={()=>act(async()=>{await createUser({name:newName,email:newEmail,password:newPass});setNewPass('');setNewEmail('');setNewName('')},'Cuenta creada. Asígnale un rol en Miembros.')}><UserPlus size={15}/> Crear cuenta</button></div>
    <h4>Cuentas existentes</h4><div className="sec-rows">{users.map(u=><div className="sec-user-row" key={u.id}><div><strong>{u.name}</strong><small>{u.email} · {u.platform_admin?'Admin principal':u.active?'Activo':'Suspendido'}</small></div>{!u.platform_admin&&<button className="ghost" disabled={busy} onClick={()=>act(()=>setUserActive(u.id,!u.active),u.active?'Cuenta suspendida':'Cuenta reactivada')}>{u.active?'Suspender':'Activar'}</button>}</div>)}</div>
   </>}
  </div>
 </Overlay>
}
