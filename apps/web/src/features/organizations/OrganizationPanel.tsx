import {useCallback,useEffect,useMemo,useState} from 'react'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {PERMISSIONS,permissionLabel} from '@novzi/contracts'
import AccessCombobox from './AccessCombobox'
import {createOrganizationUser,organizationMembers,inviteToOrganization,myOrganizationInvitations,acceptOrganizationInvitation,declineOrganizationInvitation,updateOrganizationMember,removeOrganizationMember,organizationAccessTree,organizationMemberGrants,assignOrganizationGrants,removeOrganizationGrant,organizationRoles,organizationCreateRole,organizationUpdateRole,listOrganizationInvitations,cancelOrganizationInvitation} from './api'
import type {Organization,OrganizationInvitation,OrganizationMember,AccessSpace,OrgGrant,OrganizationAccessRole,OrganizationOutgoingInvitation} from './api'

type Props={organization:Organization|null;onClose:()=>void;onChanged:()=>void}
export default function OrganizationPanel({organization,onClose,onChanged}:Props){
 const [tab,setTab]=useState<'accounts'|'access'|'roles'|'invitations'>('accounts')
 const [members,setMembers]=useState<OrganizationMember[]>([])
 const [invites,setInvites]=useState<OrganizationInvitation[]>([])
 const [sentInvites,setSentInvites]=useState<OrganizationOutgoingInvitation[]>([])
 const [accountMode,setAccountMode]=useState<'existing'|'new'>('existing')
 const [spaces,setSpaces]=useState<AccessSpace[]>([])
 const [directoryQuery,setDirectoryQuery]=useState('')
 const [email,setEmail]=useState(''),[invitedRole,setInvitedRole]=useState<'member'|'admin'>('member')
 const [newUser,setNewUser]=useState({name:'',email:'',password:'',role:'member' as 'member'|'admin'})
 const [userId,setUserId]=useState(''),[spaceId,setSpaceId]=useState(''),[projectId,setProjectId]=useState('')
 const [spaceRoleId,setSpaceRoleId]=useState(''),[projectRoleId,setProjectRoleId]=useState('')
 const [limited,setLimited]=useState(false),[selectedDiagrams,setSelectedDiagrams]=useState<string[]>([])
 const [policySpaceId,setPolicySpaceId]=useState(''),[policyRoleId,setPolicyRoleId]=useState('')
 const [policyRoles,setPolicyRoles]=useState<OrganizationAccessRole[]>([])
 const [policyPermissions,setPolicyPermissions]=useState<string[]>([])
 const [newRoleName,setNewRoleName]=useState(''),[newRoleKey,setNewRoleKey]=useState(''),[policySearch,setPolicySearch]=useState('')
 const [grants,setGrants]=useState<{workspaces:OrgGrant[];projects:OrgGrant[]}>({workspaces:[],projects:[]})
 const [pendingRemove,setPendingRemove]=useState<{kind:'organization'|'access';userId:string;workspaceId?:string;projectId?:string;label:string}|null>(null)
 const [pendingInviteCancel,setPendingInviteCancel]=useState<OrganizationOutgoingInvitation|null>(null)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const canManage=organization?.role==='owner'||organization?.role==='admin'
 const selectedSpace=spaces.find(s=>s.id===spaceId)
 const selectedProject=selectedSpace?.projects.find(p=>p.id===projectId)
 const selectedUser=members.find(m=>m.id===userId)
 const reload=useCallback(async()=>{
  const [m,i,s,sent]=await Promise.all([
   organization?organizationMembers(organization.id,directoryQuery):Promise.resolve([]),
   myOrganizationInvitations(),
   organization&&canManage?organizationAccessTree(organization.id):Promise.resolve([]),
   organization&&canManage?listOrganizationInvitations(organization.id):Promise.resolve([])
  ])
  setMembers(m);setInvites(i);setSpaces(s);setSentInvites(sent)
 },[organization?.id,canManage,directoryQuery])
 useEffect(()=>{void reload().catch(e=>setError((e as Error).message))},[reload])
 useEffect(()=>{if(!organization||!userId){setGrants({workspaces:[],projects:[]});return}let alive=true;void organizationMemberGrants(organization.id,userId).then(v=>{if(alive)setGrants(v)}).catch(e=>{if(alive)setError((e as Error).message)});return()=>{alive=false}},[organization?.id,userId])
 useEffect(()=>{setPolicyRoleId('');if(!organization||!policySpaceId){setPolicyRoles([]);return}let alive=true;void organizationRoles(organization.id,policySpaceId).then(r=>{if(alive)setPolicyRoles(r)}).catch(e=>{if(alive)setError((e as Error).message)});return()=>{alive=false}},[organization?.id,policySpaceId])
 useEffect(()=>{setPolicyPermissions(policyRoles.find(r=>r.id===policyRoleId)?.permissions||[])},[policyRoleId,policyRoles])
 useEffect(()=>{setProjectId('');setSelectedDiagrams([]);setLimited(false);setSpaceRoleId('');setProjectRoleId('')},[spaceId])
 useEffect(()=>{setSelectedDiagrams([]);setLimited(false);setProjectRoleId('')},[projectId])
 const run=async(action:()=>Promise<unknown>,message:string)=>{
  setBusy(true);setError('');setNotice('')
  try{await action();setNotice(message);await reload();if(organization&&userId)setGrants(await organizationMemberGrants(organization.id,userId));onChanged()}catch(e){setError((e as Error).message||String(e))}finally{setBusy(false)}
 }
 const currentSpaceName=(wid:string)=>spaces.find(s=>s.id===wid)?.name||'Espacio'
 const currentProjectName=(wid:string,pid:string)=>spaces.find(s=>s.id===wid)?.projects.find(p=>p.id===pid)?.name||'Proyecto'
 const canAssign=!!(organization&&canManage&&userId&&spaceId&&(!projectId||!limited||selectedDiagrams.length>0))
 const availableRoles=useMemo(()=>selectedSpace?.roles||[],[selectedSpace])
 return <>
 <Overlay title="Usuarios y accesos de la organización" onClose={onClose} wide><div className="modal-body security-console novzi-org-access">
  <p className="sec-help">Administra miembros y permisos en un solo lugar. Puedes vincular una cuenta de NOVZI que ya existe en otra organización: no es necesario crearla de nuevo.</p>
  {error&&<div className="sec-error" role="alert">{error}</div>}{notice&&<div className="sec-notice" role="status">{notice}</div>}
  <div className="sec-tabs" role="group" aria-label="Gestión organizacional">
   <button className={tab==='accounts'?'active':''} onClick={()=>setTab('accounts')}>Cuentas y miembros</button>
   {canManage&&<><button className={tab==='access'?'active':''} onClick={()=>setTab('access')}>Asignar accesos</button><button className={tab==='roles'?'active':''} onClick={()=>setTab('roles')}>Roles y permisos</button></>}
   <button className={tab==='invitations'?'active':''} onClick={()=>setTab('invitations')}>Invitaciones recibidas{invites.length>0?` (${invites.length})`:""}</button>
  </div>
  {!organization&&<p className="sec-help">Crea o selecciona una organización para administrar sus cuentas. Aquí puedes aceptar invitaciones pendientes.</p>}
  {tab==='accounts'&&organization&&<>
   {canManage&&<section className="novzi-org-create" aria-label="Agregar persona a la organización">
    <h4>Agregar persona a {organization.name}</h4>
    <p className="sec-help">Si la persona ya tiene una cuenta NOVZI (aunque sea de otra empresa), vincúlala mediante invitación. No se duplica su cuenta ni se revelan los usuarios de otras organizaciones.</p>
    <div className="novzi-account-mode" role="group" aria-label="Tipo de incorporación">
     <button type="button" className={accountMode==='existing'?'primary':'ghost'} aria-pressed={accountMode==='existing'} onClick={()=>setAccountMode('existing')}>Vincular cuenta existente</button>
     <button type="button" className={accountMode==='new'?'primary':'ghost'} aria-pressed={accountMode==='new'} onClick={()=>setAccountMode('new')}>Crear usuario nuevo</button>
    </div>
    {accountMode==='existing'?<>
     <Field label="Correo de la cuenta existente"><input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} placeholder="persona@empresa.com"/></Field>
     <Field label="Rol en esta organización"><select value={invitedRole} onChange={e=>setInvitedRole(e.target.value as 'member'|'admin')} aria-label="Rol al invitar"><option value="member">Miembro</option>{organization.role==='owner'&&<option value="admin">Administrador</option>}</select></Field>
     <p className="sec-help">La invitación aparecerá dentro de NOVZI cuando inicie sesión con ese correo. No enviamos un correo externo. Hasta que la acepte, no verá los espacios ni proyectos de {organization.name}.</p>
     <button type="button" className="primary" disabled={busy||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={()=>void run(async()=>{await inviteToOrganization(organization.id,email.trim(),invitedRole);setEmail('')},'Invitación registrada. La persona debe aceptarla en NOVZI para incorporarse a la organización.')}>Invitar cuenta existente</button>
    </>:<>
     <p className="sec-help">Utiliza esta opción únicamente si la persona todavía no tiene cuenta en NOVZI. Si ya existe, vuelve a «Vincular cuenta existente».</p>
     <Field label="Nombre"><input autoComplete="name" value={newUser.name} onChange={e=>setNewUser(x=>({...x,name:e.target.value}))}/></Field>
     <Field label="Correo"><input type="email" autoComplete="email" value={newUser.email} onChange={e=>setNewUser(x=>({...x,email:e.target.value}))}/></Field>
     <Field label="Contraseña inicial"><input type="password" autoComplete="new-password" minLength={12} value={newUser.password} onChange={e=>setNewUser(x=>({...x,password:e.target.value}))}/></Field>
     <Field label="Rol en la organización"><select aria-label="Rol inicial de organización" value={newUser.role} onChange={e=>setNewUser(x=>({...x,role:e.target.value as 'admin'|'member'}))}><option value="member">Miembro</option>{organization.role==='owner'&&<option value="admin">Administrador</option>}</select></Field>
     <button className="primary" disabled={busy||newUser.name.trim().length<2||!newUser.email.includes('@')||newUser.password.length<12} onClick={()=>void run(async()=>{await createOrganizationUser(organization.id,newUser);setNewUser({name:'',email:'',password:'',role:'member'})},'Cuenta creada sin accesos a espacios ni proyectos')}>Crear cuenta nueva</button>
    </>}
   </section>}
   {canManage&&<section aria-label="Invitaciones enviadas"><h4>Invitaciones pendientes de {organization.name}</h4>
    {sentInvites.length===0?<p className="sec-help">Sin invitaciones pendientes.</p>:<div className="sec-rows">{sentInvites.map(i=><div className="sec-user-row" key={i.id}><div><strong>{i.email}</strong><small>Rol: {i.role==='admin'?'Administrador':'Miembro'} · Pendiente de aceptación · Vence: {new Date(i.expires_at).toLocaleDateString('es-CO')}</small></div><button className="ghost" type="button" disabled={busy} onClick={()=>setPendingInviteCancel(i)}>Cancelar invitación</button></div>)}</div>}
   </section>}
   <h4>Directorio de {organization.name}</h4>
   <Field label="Buscar miembros por nombre o correo"><input type="search" value={directoryQuery} onChange={e=>setDirectoryQuery(e.target.value)} placeholder="Escribe para filtrar el directorio"/></Field>
   <div className="sec-rows">{members.map(m=><div className="sec-user-row" key={m.id}><div><strong>{m.name}</strong><small>{m.email} · {m.role==='owner'?'Propietario':m.role==='admin'?'Administrador':'Miembro'}</small></div>
    {canManage&&<>{m.role!=='owner'&&<button type="button" onClick={()=>{setUserId(m.id);setTab('access')}}>Accesos</button>}{m.role!=='owner'&&<button className="ghost" disabled={busy} onClick={()=>setPendingRemove({kind:'organization',userId:m.id,label:m.name})}>Retirar</button>}{m.role!=='owner'&&organization.role==='owner'&&<select aria-label={`Rol de organización de ${m.name}`} value={m.role} disabled={busy} onChange={e=>void run(()=>updateOrganizationMember(organization.id,m.id,e.target.value as 'admin'|'member'),'Rol actualizado')}><option value="member">Miembro</option><option value="admin">Administrador</option></select>}</>}
   </div>)}</div>

  </>}
  {tab==='access'&&canManage&&organization&&<>
   <h4>Asignar accesos a un miembro</h4>
   <p className="sec-help">Busca y selecciona una persona. Elige un espacio y, si corresponde, un proyecto y diagramas concretos. No necesitas combinar un buscador con un segundo selector de usuario.</p>
   <AccessCombobox label="Persona" placeholder="Buscar por nombre o correo" items={members.map(m=>({id:m.id,label:m.name,description:m.email}))} value={userId} onChange={setUserId} onQueryChange={setDirectoryQuery}/>
   {userId&&<>
    <AccessCombobox label="Espacio" items={spaces.map(s=>({id:s.id,label:s.name}))} value={spaceId} onChange={setSpaceId}/>
    {spaceId&&<>
     <AccessCombobox label="Rol en el espacio (opcional: lector)" items={availableRoles.map(r=>({id:r.id,label:r.name,description:r.role_key}))} value={spaceRoleId} onChange={setSpaceRoleId}/>
     <AccessCombobox label="Proyecto (opcional)" items={(selectedSpace?.projects||[]).map(p=>({id:p.id,label:p.name}))} value={projectId} onChange={setProjectId}/>
     {projectId&&<>
      <AccessCombobox label="Rol en el proyecto (opcional: lector)" items={availableRoles.map(r=>({id:r.id,label:r.name,description:r.role_key}))} value={projectRoleId} onChange={setProjectRoleId}/>
      <div className="novzi-access-scope"><label><input type="radio" checked={!limited} onChange={()=>{setLimited(false);setSelectedDiagrams([])}}/> Todos los diagramas del proyecto</label><label><input type="radio" checked={limited} onChange={()=>setLimited(true)}/> Solo diagramas seleccionados</label></div>
      {limited&&<><p className="sec-help">Acceso limitado de <strong>solo lectura</strong>. El servidor ocultará todos los demás diagramas y bloqueará modificaciones del proyecto.</p><div className="novzi-access-diagrams">{(selectedProject?.diagrams||[]).map(d=><label key={d.id}><input type="checkbox" checked={selectedDiagrams.includes(d.id)} onChange={e=>setSelectedDiagrams(old=>e.target.checked?[...old,d.id]:old.filter(x=>x!==d.id))}/><span><strong>{d.name}</strong><small>{d.type}</small></span></label>)}{!selectedProject?.diagrams.length&&<p className="sec-help">El proyecto aún no tiene diagramas.</p>}</div></>}
     </>}
     <button className="primary" disabled={busy||!canAssign} onClick={()=>void run(()=>assignOrganizationGrants(organization.id,userId,{workspaceId:spaceId,...(spaceRoleId?{workspaceRoleId:spaceRoleId}:{}),...(projectId?{projectId,...(projectRoleId?{projectRoleId}:{}),...(limited?{diagramIds:selectedDiagrams}:{})}:{})}),'Acceso actualizado correctamente')}>Guardar asignación</button>
    </>}
    <h4>Accesos actuales de {selectedUser?.name||'la persona'}</h4>
    {grants.workspaces.length===0&&grants.projects.length===0?<p className="sec-help">Sin espacios ni proyectos asignados.</p>:<div className="sec-rows">
     {grants.workspaces.map(g=><div className="sec-user-row" key={'s-'+g.workspace_id}><div><strong>{currentSpaceName(g.workspace_id)}</strong><small>Espacio · {g.role_name}</small></div>{g.role_key!=='owner'&&<button className="ghost" disabled={busy} onClick={()=>setPendingRemove({kind:'access',userId,workspaceId:g.workspace_id,label:currentSpaceName(g.workspace_id)})}>Quitar acceso</button>}</div>)}
     {grants.projects.map(g=><div className="sec-user-row" key={'p-'+g.project_id}><div><strong>{currentProjectName(g.workspace_id,g.project_id||'')}</strong><small>Proyecto · {g.role_name} · {g.diagram_scope==='selected'?`${g.diagram_ids?.length||0} diagramas, solo lectura`:'Todos los diagramas'}</small></div>{g.role_key!=='owner'&&<button className="ghost" disabled={busy} onClick={()=>setPendingRemove({kind:'access',userId,workspaceId:g.workspace_id,projectId:g.project_id,label:currentProjectName(g.workspace_id,g.project_id||'')})}>Quitar acceso</button>}</div>)}
    </div>}
   </>}
  </>}
  {tab==='roles'&&canManage&&organization&&<>
   <h4>Políticas de acceso</h4>
   <p className="sec-help">Configura las operaciones permitidas a cada rol. Después podrás asignar ese rol en la pestaña «Asignar accesos». La política de propietario es inmutable.</p>
   <AccessCombobox label="Espacio de las políticas" items={spaces.map(x=>({id:x.id,label:x.name}))} value={policySpaceId} onChange={setPolicySpaceId}/>
   {policySpaceId&&<>
    <AccessCombobox label="Rol editable" items={policyRoles.filter(r=>r.role_key!=='owner').map(r=>({id:r.id,label:r.name,description:r.role_key}))} value={policyRoleId} onChange={setPolicyRoleId}/>
    <h4>{policyRoleId?'Permisos del rol seleccionado':'Crear un rol personalizado'}</h4>
    {!policyRoleId&&<><Field label="Nombre del rol"><input value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} placeholder="Ej. Analista funcional"/></Field><Field label="Identificador del rol"><input value={newRoleKey} onChange={e=>setNewRoleKey(e.target.value)} placeholder="Ej. analista_funcional"/></Field></>}
    <Field label="Filtrar permisos"><input type="search" value={policySearch} onChange={e=>setPolicySearch(e.target.value)} placeholder="Buscar una operación, por ejemplo diagrama"/></Field>
    <div className="sec-permission-scroll"><div className="sec-check-grid">{PERMISSIONS.filter(p=>p!=='workspace.delete').filter(p=>`${p} ${permissionLabel(p)}`.toLocaleLowerCase().includes(policySearch.toLocaleLowerCase())).map(p=><label key={p} className="sec-check"><input type="checkbox" checked={policyPermissions.includes(p)} onChange={e=>setPolicyPermissions(old=>e.target.checked?[...old,p]:old.filter(v=>v!==p))}/><span>{permissionLabel(p)}<small>{p}</small></span></label>)}</div></div>
    <button className="primary" disabled={busy||(!policyRoleId&&(newRoleName.trim().length<2||!/^[a-z][a-z0-9_-]{1,39}$/.test(newRoleKey)))} onClick={()=>void run(async()=>{
     if(policyRoleId)await organizationUpdateRole(organization.id,policySpaceId,policyRoleId,policyPermissions)
     else await organizationCreateRole(organization.id,policySpaceId,{name:newRoleName,roleKey:newRoleKey,permissions:policyPermissions})
     setPolicyRoles(await organizationRoles(organization.id,policySpaceId));setNewRoleName('');setNewRoleKey('')
    },policyRoleId?'Permisos del rol actualizados':'Rol personalizado creado')}>{policyRoleId?'Guardar permisos del rol':'Crear rol personalizado'}</button>
   </>}
  </>}
  {tab==='invitations'&&<>
   <h4>Invitaciones recibidas para tu cuenta</h4>
   <p className="sec-help">Si te invitan a otra organización, acepta aquí al ingresar con el correo invitado. No perderás acceso a tus organizaciones actuales.</p>
   {invites.length===0?<p className="sec-help">No tienes invitaciones pendientes.</p>:<div className="sec-rows">{invites.map(i=><div className="sec-user-row" key={i.id}><div><strong>{i.organization_name}</strong><small>Rol: {i.role} · Invitación a {i.email}</small></div><button disabled={busy} onClick={()=>void run(()=>acceptOrganizationInvitation(i.id),'Invitación aceptada')}>Aceptar</button><button className="ghost" disabled={busy} onClick={()=>void run(()=>declineOrganizationInvitation(i.id),'Invitación rechazada')}>Rechazar</button></div>)}</div>}

  </>}
  <div className="modal-actions"><button onClick={onClose}>Cerrar</button></div>
 </div></Overlay>
 {pendingInviteCancel&&organization&&<Overlay title="Cancelar invitación" onClose={()=>{if(!busy)setPendingInviteCancel(null)}}><div className="modal-body"><p>¿Cancelar la invitación pendiente de <strong>{pendingInviteCancel.email}</strong> a <strong>{organization.name}</strong>? Esto no elimina su cuenta global ni afecta sus otras organizaciones.</p><div className="modal-actions"><button className="ghost" type="button" disabled={busy} onClick={()=>setPendingInviteCancel(null)}>Volver</button><button type="button" className="danger outlined" disabled={busy} onClick={()=>{const invite=pendingInviteCancel;void run(()=>cancelOrganizationInvitation(organization.id,invite.id),'Invitación cancelada').then(()=>setPendingInviteCancel(null))}}>Confirmar cancelación</button></div></div></Overlay>}
 {pendingRemove&&<Overlay title="Confirmar retiro de acceso" onClose={()=>{if(!busy)setPendingRemove(null)}}><div className="modal-body"><p>¿Retirar el acceso a <strong>{pendingRemove.label}</strong>? Si retiras un espacio, se retirarán también los accesos a sus proyectos. No se eliminará la cuenta ni los diagramas.</p><div className="modal-actions"><button className="ghost" disabled={busy} onClick={()=>setPendingRemove(null)}>Cancelar</button><button className="danger outlined" disabled={busy} onClick={()=>{const p=pendingRemove;void run(()=>p.kind==='organization'?removeOrganizationMember(organization!.id,p.userId):removeOrganizationGrant(organization!.id,p.userId,p.workspaceId!,p.projectId),'Acceso retirado').then(()=>setPendingRemove(null))}}>Confirmar retiro</button></div></div></Overlay>}
 </>
}
