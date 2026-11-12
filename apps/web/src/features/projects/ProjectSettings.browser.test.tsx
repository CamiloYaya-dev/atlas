import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import ProjectSettings from './ProjectSettings'
import * as api from './api'
vi.mock('./api',()=>({projectMembers:vi.fn(),projectCandidates:vi.fn(),assignProjectMember:vi.fn(),removeProjectMember:vi.fn(),renameProject:vi.fn(),deleteProject:vi.fn()}))
const project={id:'p1',workspace_id:'w1',name:'Proyecto protegido'}
const owner={roleId:'r1',roleKey:'owner',roleName:'Propietario',permissions:[]}
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(api.projectMembers).mockResolvedValue([{id:'owner',name:'Propietario',email:'owner@test.local',role_id:'r1',role_key:'owner',role_name:'Propietario'}])
 vi.mocked(api.projectCandidates).mockResolvedValue({users:[{id:'u2',name:'Usuario 2',email:'u2@test.local'}],roles:[{id:'r-viewer',role_key:'viewer',name:'Lector',permissions:['project.read']}]})
 vi.mocked(api.assignProjectMember).mockResolvedValue({ok:true})
 vi.mocked(api.removeProjectMember).mockResolvedValue({ok:true})
 vi.mocked(api.renameProject).mockResolvedValue({...project,name:'Nuevo proyecto'} as never)
 vi.mocked(api.deleteProject).mockResolvedValue({ok:true})
})
describe('Administración privada de proyectos',()=>{
 it('una respuesta de membresías incompleta no rompe la aplicación',async()=>{
  vi.mocked(api.projectCandidates).mockResolvedValue(undefined as never)
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  expect((await screen.findByRole('alert')).textContent).toContain('lista de miembros o roles incompleta')
  expect(screen.getByRole('dialog',{name:'Administrar proyecto: Proyecto protegido'})).toBeTruthy()
 })
 it('muestra miembros del proyecto, no todos los proyectos del espacio',async()=>{
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  expect(await screen.findByText('owner@test.local · Propietario')).toBeTruthy()
  expect(screen.getByLabelText('Usuario del espacio')).toBeTruthy()
 })
 it('asigna un rol a una persona concreta sin alterar otros proyectos',async()=>{
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  await screen.findByText('owner@test.local · Propietario')
  fireEvent.change(screen.getByLabelText('Usuario del espacio'),{target:{value:'u2'}})
  fireEvent.change(screen.getByLabelText('Rol para el proyecto'),{target:{value:'r-viewer'}})
  fireEvent.click(screen.getByRole('button',{name:'Asignar'}))
  await waitFor(()=>expect(api.assignProjectMember).toHaveBeenCalledWith('p1','u2','r-viewer'))
  expect(await screen.findByText('Acceso al proyecto actualizado correctamente.')).toBeTruthy()
 })
 it('renombra proyecto y notifica el cambio',async()=>{
  const renamed=vi.fn()
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={renamed} onDeleted={()=>{}}/>)
  fireEvent.change(screen.getByLabelText('Nombre del proyecto'),{target:{value:'Nuevo proyecto'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar nombre'}))
  await waitFor(()=>expect(api.renameProject).toHaveBeenCalledWith('p1','Nuevo proyecto'))
  expect(renamed).toHaveBeenCalledWith(expect.objectContaining({name:'Nuevo proyecto'}))
 })
 it('no permite renombrar ni eliminar mientras hay cambios pendientes',async()=>{
  render(<ProjectSettings project={project} access={owner} canEditNow={false} onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  expect((screen.getByRole('button',{name:'Guardar nombre'}) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}) as HTMLButtonElement).disabled).toBe(true)
 })
 it('borrado del proyecto exige nombre exacto en modal sin prompt',async()=>{
  const deleted=vi.fn(),native=vi.spyOn(window,'prompt')
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={deleted}/>)
  fireEvent.click(screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}))
  await screen.findByRole('heading',{name:'Eliminar proyecto: Proyecto protegido'})
  const button=screen.getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Proyecto protegido'}})
  fireEvent.click(button)
  await waitFor(()=>expect(api.deleteProject).toHaveBeenCalledWith('p1'))
  expect(deleted).toHaveBeenCalledWith('p1')
  expect(native).not.toHaveBeenCalled()
  native.mockRestore()
 })
 it('quitar miembro abre un segundo modal y actualiza la lista solo si la API confirma',async()=>{
  vi.mocked(api.projectMembers).mockResolvedValueOnce([{id:'u2',name:'Usuario 2',email:'u2@test.local',role_id:'r-viewer',role_key:'viewer',role_name:'Lector'}])
   .mockResolvedValueOnce([])
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  await screen.findByText('u2@test.local · Lector')
  fireEvent.click(screen.getByRole('button',{name:'Quitar acceso a Usuario 2'}))
  expect(screen.getByText(/no eliminará su cuenta ni su acceso a otros proyectos/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Quitar acceso'}))
  await waitFor(()=>expect(api.removeProjectMember).toHaveBeenCalledWith('p1','u2'))
  expect(await screen.findByText('Acceso retirado a Usuario 2.')).toBeTruthy()
 })
 it('si falla el borrado, mantiene el modal abierto y muestra el error real',async()=>{
  vi.mocked(api.deleteProject).mockRejectedValue(new Error('Permiso requerido: project.delete'))
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}))
  fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Proyecto protegido'}})
  fireEvent.click(screen.getByRole('button',{name:'Eliminar definitivamente'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Permiso requerido')
  expect(screen.getByRole('heading',{name:'Eliminar proyecto: Proyecto protegido'})).toBeTruthy()
 })
})
