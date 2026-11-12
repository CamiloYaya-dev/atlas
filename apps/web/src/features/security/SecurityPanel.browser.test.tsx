import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import SecurityPanel from './SecurityPanel'
import * as api from './api'
import type {WorkspaceAccess} from './types'

vi.mock('./api',()=>({
 workspaceRoles:vi.fn(),workspaceMembers:vi.fn(),usersList:vi.fn(),createUser:vi.fn(),
 createRole:vi.fn(),updateRole:vi.fn(),assignMember:vi.fn(),removeMember:vi.fn(),setUserActive:vi.fn()
}))
const full:WorkspaceAccess={roleId:'r1',roleKey:'owner',roleName:'Propietario',permissions:[]}
const limited:WorkspaceAccess={roleId:'r2',roleKey:'functional',roleName:'Funcional',permissions:['workspace.members.manage']}
const roles=[
 {id:'r1',role_key:'owner',name:'Propietario',system_role:true,permissions:[]},
 {id:'r2',role_key:'functional',name:'Funcional',system_role:false,permissions:['diagram.view.c1']},
]
function setup(access:WorkspaceAccess=full,platformAdmin=true){return render(<SecurityPanel workspaceId="w1" access={access} platformAdmin={platformAdmin} onClose={vi.fn()}/>)}
beforeEach(()=>{
 vi.mocked(api.workspaceRoles).mockResolvedValue(roles)
 vi.mocked(api.workspaceMembers).mockResolvedValue([])
 vi.mocked(api.usersList).mockResolvedValue([{id:'u1',email:'test@example.com',name:'Test',active:true,platform_admin:false}])
 vi.mocked(api.createUser).mockResolvedValue({id:'u2'})
 vi.mocked(api.updateRole).mockResolvedValue({ok:true})
 vi.mocked(api.setUserActive).mockResolvedValue({ok:true})
 vi.mocked(api.assignMember).mockResolvedValue({ok:true})
})
describe('Consola de permisos',()=>{
 it('propietario ve catálogo y política inmutable',async()=>{
  setup()
  await waitFor(()=>expect(screen.getByText('diagram.view.c1')).toBeTruthy())
  fireEvent.change(screen.getByLabelText('Rol a configurar'),{target:{value:'r1'}})
  expect(screen.getByText(/Propietario tiene todos los permisos/)).toBeTruthy()
  expect(screen.getByText('diagram.view.c1')).toBeTruthy()
  expect(screen.getByRole('button',{name:/Guardar política/}).hasAttribute('disabled')).toBe(true)
 })
 it('puede cambiar permisos de un rol no propietario y guardarlos',async()=>{
  setup()
  await waitFor(()=>expect(screen.getByText('diagram.view.c1')).toBeTruthy())
  fireEvent.change(screen.getByLabelText('Rol a configurar'),{target:{value:'r2'}})
  const save=screen.getByRole('button',{name:/Guardar política/})
  expect(save.hasAttribute('disabled')).toBe(false)
  fireEvent.click(save)
  await waitFor(()=>expect(api.updateRole).toHaveBeenCalledWith('w1','r2',['diagram.view.c1']))
 })
 it('administrador de plataforma crea una cuenta sin registro público',async()=>{
  setup()
  fireEvent.click(screen.getByRole('button',{name:/Cuentas/}))
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Persona QA'}})
  fireEvent.change(screen.getByLabelText('Email'),{target:{value:'qa@example.com'}})
  fireEvent.change(screen.getByLabelText('Contraseña inicial'),{target:{value:'Clave-prueba-muy-segura-2026'}})
  fireEvent.click(screen.getByRole('button',{name:/Crear cuenta/}))
  await waitFor(()=>expect(api.createUser).toHaveBeenCalledWith({name:'Persona QA',email:'qa@example.com',password:'Clave-prueba-muy-segura-2026'}))
 })
 it('un rol sin privilegios de roles no muestra la política de roles',async()=>{
  setup(limited,false)
  expect(screen.queryByRole('button',{name:/Roles y comportamientos/})).toBeNull()
  expect(screen.getByRole('button',{name:/Miembros/})).toBeTruthy()
  expect(screen.queryByRole('button',{name:/Cuentas/})).toBeNull()
  await waitFor(()=>expect(api.workspaceMembers).toHaveBeenCalledWith('w1'))
 })
 it('filtra el catálogo de permisos sin alterar su configuración',async()=>{
  setup()
  await screen.findByText('diagram.view.c1')
  fireEvent.change(screen.getByLabelText('Filtrar permisos'),{target:{value:'relation.delete.technical'}})
  expect(screen.getByText('relation.delete.technical')).toBeTruthy()
  expect(screen.queryByText('diagram.view.c1')).toBeNull()
 })
 it('crea un rol personalizado con su política configurada',async()=>{
  setup()
  await screen.findByText('diagram.view.c1')
  fireEvent.change(screen.getByLabelText('Rol a configurar'),{target:{value:'r2'}})
  fireEvent.change(screen.getByPlaceholderText('Nombre (ej. QA funcional)'),{target:{value:'QA funcional'}})
  fireEvent.change(screen.getByPlaceholderText('Clave (ej. qa_funcional)'),{target:{value:'qa_funcional'}})
  fireEvent.click(screen.getByRole('button',{name:/^Crear$/}))
  await waitFor(()=>expect(api.createRole).toHaveBeenCalledWith('w1',{name:'QA funcional',roleKey:'qa_funcional',permissions:['diagram.view.c1']}))
 })
 it('suspende una cuenta ordinaria y conserva la cuenta administrativa',async()=>{
  setup()
  fireEvent.click(screen.getByRole('button',{name:/Cuentas/}))
  await screen.findByText('test@example.com · Activo')
  fireEvent.click(screen.getByRole('button',{name:'Suspender'}))
  await waitFor(()=>expect(api.setUserActive).toHaveBeenCalledWith('u1',false))
 })
 it('no asigna membresías sin usuario y rol, pero sí con ambos seleccionados',async()=>{
  setup()
  await screen.findByText('diagram.view.c1')
  fireEvent.click(screen.getByRole('button',{name:/Miembros/}))
  const dropdowns=document.querySelectorAll<HTMLSelectElement>('.sec-inputs select')
  expect(dropdowns.length).toBe(2)
  expect(screen.getByRole('button',{name:'Asignar'}).hasAttribute('disabled')).toBe(true)
  fireEvent.change(dropdowns[0],{target:{value:'u1'}})
  fireEvent.change(dropdowns[1],{target:{value:'r2'}})
  fireEvent.click(screen.getByRole('button',{name:'Asignar'}))
  await waitFor(()=>expect(api.assignMember).toHaveBeenCalledWith('w1','u1','r2'))
 })
 it('error de API durante carga aparece dentro del panel',async()=>{
  vi.mocked(api.usersList).mockRejectedValue(new Error('Servidor QA no disponible'))
  setup()
  await waitFor(()=>expect(screen.getByText(/Servidor QA no disponible/)).toBeTruthy())
 })


 it('reactiva una cuenta suspendida y muestra el estado correspondiente',async()=>{
  vi.mocked(api.usersList).mockResolvedValue([{id:'u2',email:'suspendido@example.com',name:'Suspendido QA',active:false,platform_admin:false}])
  setup()
  fireEvent.click(screen.getByRole('button',{name:/Cuentas/}))
  await screen.findByText('suspendido@example.com · Suspendido')
  fireEvent.click(screen.getByRole('button',{name:'Activar'}))
  await waitFor(()=>expect(api.setUserActive).toHaveBeenCalledWith('u2',true))
 })
 it('el propietario no ofrece botón para expulsarse y sí permite retirar un miembro ordinario',async()=>{
  vi.mocked(api.workspaceMembers).mockResolvedValue([
   {id:'owner-1',name:'Propietario',email:'owner@example.com',active:true,role_id:'r1',role_name:'Propietario',role_key:'owner'},
   {id:'member-2',name:'Invitado',email:'guest@example.com',active:true,role_id:'r2',role_name:'Funcional',role_key:'functional'}
  ])
  vi.mocked(api.removeMember).mockResolvedValue({ok:true})
  setup()
  fireEvent.click(screen.getByRole('button',{name:/Miembros/}))
  await screen.findByText('guest@example.com · Funcional')
  expect(screen.getAllByRole('button',{name:'Quitar'})).toHaveLength(1)
  fireEvent.click(screen.getByRole('button',{name:'Quitar'}))
  await waitFor(()=>expect(api.removeMember).toHaveBeenCalledWith('w1','member-2'))
 })
 it('si falla la creación de un usuario, informa el fallo y mantiene el panel abierto',async()=>{
  vi.mocked(api.createUser).mockRejectedValue(new Error('El correo ya existe'))
  setup()
  fireEvent.click(screen.getByRole('button',{name:/Cuentas/}))
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Usuario repetido'}})
  fireEvent.change(screen.getByLabelText('Email'),{target:{value:'repetido@example.com'}})
  fireEvent.change(screen.getByLabelText('Contraseña inicial'),{target:{value:'Password-Seguro-2026!'}})
  fireEvent.click(screen.getByRole('button',{name:/Crear cuenta/}))
  await waitFor(()=>expect(screen.getByText('El correo ya existe')).toBeTruthy())
  expect(screen.getByRole('dialog',{name:'Usuarios y políticas de acceso'})).toBeTruthy()
 })

 it('un error al guardar una política muestra el fallo sin notificación falsa',async()=>{
  vi.mocked(api.updateRole).mockRejectedValue(new Error('Política rechazada por API'))
  setup()
  await screen.findByText('diagram.view.c1')
  fireEvent.change(screen.getByLabelText('Rol a configurar'),{target:{value:'r2'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar política'}))
  expect(await screen.findByText('Política rechazada por API')).toBeTruthy()
  expect(screen.queryByText('Permisos guardados correctamente')).toBeNull()
 })
 it('recargar actualiza roles y lista de cuentas autorizadas',async()=>{
  setup()
  await screen.findByText('diagram.view.c1')
  const original=vi.mocked(api.workspaceRoles).mock.calls.length
  fireEvent.click(screen.getByRole('button',{name:'Recargar'}))
  await waitFor(()=>expect(vi.mocked(api.workspaceRoles).mock.calls.length).toBeGreaterThan(original))
  expect(vi.mocked(api.usersList)).toHaveBeenCalled()
 })
 it('cuentas exige nombre, email y mínimo 12 caracteres antes de enviar el alta',async()=>{
  setup()
  fireEvent.click(screen.getByRole('button',{name:'Cuentas'}))
  const submit=screen.getByRole('button',{name:'Crear cuenta'})
  expect(submit.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Nuevo QA'}})
  fireEvent.change(screen.getByLabelText('Email'),{target:{value:'qa2@example.com'}})
  fireEvent.change(screen.getByLabelText('Contraseña inicial'),{target:{value:'corta'}})
  expect(submit.hasAttribute('disabled')).toBe(true)
  expect(api.createUser).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Contraseña inicial'),{target:{value:'QA-Contraseña-larga-2026'}})
  expect(submit.hasAttribute('disabled')).toBe(false)
 })
 it('solo se listan usuarios activos para asignar miembros y nunca se permite asignar owner',async()=>{
  vi.mocked(api.usersList).mockResolvedValue([
   {id:'u1',email:'activo@example.com',name:'Activo',active:true,platform_admin:false},
   {id:'u2',email:'bloqueado@example.com',name:'Bloqueado',active:false,platform_admin:false}
  ])
  setup()
  fireEvent.click(screen.getByRole('button',{name:'Miembros'}))
  await screen.findByText('Asignar un usuario existente')
  const dropdowns=document.querySelectorAll<HTMLSelectElement>('.sec-inputs select')
  await waitFor(()=>expect(dropdowns[0].querySelectorAll('option').length).toBe(2))
  expect(dropdowns[0].textContent).toContain('activo@example.com')
  expect(dropdowns[0].textContent).not.toContain('bloqueado@example.com')
  expect(dropdowns[1].textContent).not.toContain('Propietario')
 })
 it('un permiso individual puede desactivarse y persistirse para un rol no propietario',async()=>{
  setup()
  await screen.findByText('diagram.view.c1')
  fireEvent.change(screen.getByLabelText('Rol a configurar'),{target:{value:'r2'}})
  const permission=document.querySelector<HTMLInputElement>('label[title="diagram.view.c1"] input[type="checkbox"]')!
  expect(permission).not.toBeNull()
  expect(permission.checked).toBe(true)
  fireEvent.click(permission)
  expect(permission.checked).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'Guardar política'}))
  await waitFor(()=>expect(api.updateRole).toHaveBeenCalledWith('w1','r2',[]))
 })

})
