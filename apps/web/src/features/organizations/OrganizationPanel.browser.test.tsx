import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import OrganizationPanel from './OrganizationPanel'
import * as api from './api'
vi.mock('./api',()=>({organizationMembers:vi.fn(),myOrganizationInvitations:vi.fn(),organizationAccessTree:vi.fn(),organizationMemberGrants:vi.fn(),createOrganizationUser:vi.fn(),inviteToOrganization:vi.fn(),acceptOrganizationInvitation:vi.fn(),declineOrganizationInvitation:vi.fn(),updateOrganizationMember:vi.fn(),removeOrganizationMember:vi.fn(),assignOrganizationGrants:vi.fn(),removeOrganizationGrant:vi.fn(),organizationRoles:vi.fn(),organizationCreateRole:vi.fn(),organizationUpdateRole:vi.fn()}))
const org={id:'o1',name:'Zercano',role:'admin' as const,created_by:'u1',workspace_count:1}
const members=[{id:'u1',name:'Lady Morales',email:'lady@example.com',role:'admin' as const},{id:'u2',name:'Camilo',email:'camilo@example.com',role:'member' as const}]
const tree=[{id:'w1',name:'Dirección Tecnología',roles:[{id:'rviewer',workspace_id:'w1',name:'Lector',role_key:'viewer'},{id:'reditor',workspace_id:'w1',name:'Editor',role_key:'editor'}],projects:[{id:'p1',name:'Zercano Plataforma',diagrams:[{id:'d1',name:'C1 Contexto',type:'c1'},{id:'d2',name:'UML Clases',type:'uml-class'}]}]}]
beforeEach(()=>{
 vi.resetAllMocks();vi.mocked(api.organizationMembers).mockResolvedValue(members)
 vi.mocked(api.myOrganizationInvitations).mockResolvedValue([])
 vi.mocked(api.organizationAccessTree).mockResolvedValue(tree)
 vi.mocked(api.organizationMemberGrants).mockResolvedValue({workspaces:[],projects:[]})
 vi.mocked(api.assignOrganizationGrants).mockResolvedValue({ok:true})
 vi.mocked(api.organizationRoles).mockResolvedValue([{id:'rviewer',name:'Lector',role_key:'viewer',permissions:['project.read','diagram.view.c1']}])
})
const open=()=>render(<OrganizationPanel organization={org} onClose={()=>{}} onChanged={()=>{}}/>)
const choose=async(label:string,name:string)=>{
 const input=await screen.findByRole('combobox',{name:label})
 fireEvent.focus(input)
 fireEvent.change(input,{target:{value:name}})
 const list=await screen.findByRole('listbox')
 fireEvent.click(within(list).getByRole('option',{name:new RegExp(name,'i')}))
}
describe('Consola única de organización',()=>{
 it('un miembro ordinario no recibe botones de alta ni de asignaciones',async()=>{
  render(<OrganizationPanel organization={{...org,role:'member'}} onClose={()=>{}} onChanged={()=>{}}/>)
  expect(await screen.findByText(/Directorio de Zercano/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Asignar accesos'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Roles y permisos'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Crear cuenta'})).toBeNull()
  expect(api.organizationAccessTree).not.toHaveBeenCalled()
 })
 it('el administrador crea una cuenta exclusivamente dentro de su organización',async()=>{
  vi.mocked(api.createOrganizationUser).mockResolvedValue({id:'u3'})
  open();await screen.findByText('Directorio de Zercano')
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Usuario nuevo'}})
  fireEvent.change(screen.getByLabelText('Correo'),{target:{value:'nuevo@example.com'}})
  fireEvent.change(screen.getByLabelText('Contraseña inicial'),{target:{value:'Clave-inicial-segura-2026'}})
  fireEvent.click(screen.getByRole('button',{name:'Crear cuenta'}))
  await waitFor(()=>expect(api.createOrganizationUser).toHaveBeenCalledWith(org.id,{name:'Usuario nuevo',email:'nuevo@example.com',password:'Clave-inicial-segura-2026',role:'member'}))
  expect(api.assignOrganizationGrants).not.toHaveBeenCalled()
 })
 it('busca la persona y asigna jerarquía espacio/proyecto/diagramas por un solo selector con opciones',async()=>{
  open();fireEvent.click(screen.getByRole('button',{name:'Asignar accesos'}))
  await choose('Persona','Camilo')
  await choose('Espacio','Dirección Tecnología')
  await choose('Proyecto (opcional)','Zercano Plataforma')
  fireEvent.click(screen.getByLabelText('Solo diagramas seleccionados'))
  fireEvent.click(screen.getByLabelText(/C1 Contexto/))
  fireEvent.click(screen.getByRole('button',{name:'Guardar asignación'}))
  await waitFor(()=>expect(api.assignOrganizationGrants).toHaveBeenCalledWith(org.id,'u2',{workspaceId:'w1',projectId:'p1',diagramIds:['d1']}))
  expect(screen.getByText(/solo lectura/)).toBeTruthy()
 })
 it('separa el directorio de permisos y conserva una sola entrada para configurar roles',async()=>{
  open();fireEvent.click(screen.getByRole('button',{name:'Roles y permisos'}))
  await choose('Espacio de las políticas','Dirección Tecnología')
  expect(await screen.findByRole('combobox',{name:'Rol editable'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Crear cuenta'})).toBeNull()
 })
 it('el retiro de un acceso exige una confirmación del aplicativo, no confirmación nativa',async()=>{
  vi.mocked(api.organizationMemberGrants).mockResolvedValue({workspaces:[{workspace_id:'w1',role_id:'rviewer',role_name:'Lector',role_key:'viewer'}],projects:[]})
  const native=vi.spyOn(window,'confirm')
  try{
   open();fireEvent.click(screen.getByRole('button',{name:'Asignar accesos'}));await choose('Persona','Camilo')
   fireEvent.click(await screen.findByRole('button',{name:'Quitar acceso'}))
   expect(await screen.findByRole('dialog',{name:'Confirmar retiro de acceso'})).toBeTruthy()
   fireEvent.click(screen.getByRole('button',{name:'Cancelar'}))
   expect(api.removeOrganizationGrant).not.toHaveBeenCalled()
   expect(native).not.toHaveBeenCalled()
  }finally{native.mockRestore()}
 })
})
