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
 vi.mocked(api.deleteProject).mockResolvedValue({ok:true})
})
describe('Administración privada de proyectos',()=>{
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
 })
 it('no permite renombrar ni eliminar mientras hay cambios pendientes',async()=>{
  render(<ProjectSettings project={project} access={owner} canEditNow={false} onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  expect((screen.getByRole('button',{name:'Guardar nombre'}) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}) as HTMLButtonElement).disabled).toBe(true)
 })
})
