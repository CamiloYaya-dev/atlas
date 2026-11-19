import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import ProjectSettings from './ProjectSettings'
import type {WorkspaceAccess} from '../security/types'
import * as api from './api'
vi.mock('./api',()=>({renameProject:vi.fn(),deleteProject:vi.fn(),projectMembers:vi.fn(),projectCandidates:vi.fn(),assignProjectMember:vi.fn(),removeProjectMember:vi.fn()}))
const project={id:'p1',workspace_id:'w1',name:'Proyecto protegido'}
const owner:WorkspaceAccess={roleId:'r1',roleKey:'owner',roleName:'Propietario',permissions:[]}
const renderSettings=(access:WorkspaceAccess|null=owner,canEditNow=true)=>render(<ProjectSettings project={project} access={access} canEditNow={canEditNow} onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.renameProject).mockResolvedValue({...project,name:'Nuevo proyecto'} as never);vi.mocked(api.deleteProject).mockResolvedValue({ok:true})})
describe('Configuración de proyecto sin administración duplicada de cuentas',()=>{
 it('solo informa dónde gestionar usuarios, sin consultar ni listar cuentas en el proyecto',()=>{
  renderSettings()
  expect(screen.getByText(/Usuarios y accesos de la organización/)).toBeTruthy()
  expect(screen.queryByText('Personas con acceso a este proyecto')).toBeNull()
  expect(screen.queryByRole('button',{name:'Asignar'})).toBeNull()
  expect(screen.queryByLabelText('Usuario del espacio')).toBeNull()
  expect(api.projectMembers).not.toHaveBeenCalled()
  expect(api.projectCandidates).not.toHaveBeenCalled()
 })
 it('el botón de creación de cuentas no se ofrece desde un proyecto',()=>{
  renderSettings();expect(screen.queryByRole('button',{name:'Crear cuenta'})).toBeNull()
 })
 it('renombra proyecto y notifica el cambio',async()=>{
  const renamed=vi.fn()
  render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={renamed} onDeleted={()=>{}}/>)
  fireEvent.change(screen.getByLabelText('Nombre del proyecto'),{target:{value:'Nuevo proyecto'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar nombre'}))
  await waitFor(()=>expect(api.renameProject).toHaveBeenCalledWith('p1','Nuevo proyecto'))
  expect(renamed).toHaveBeenCalledWith(expect.objectContaining({name:'Nuevo proyecto'}))
 })
 it('bloquea cambios destructivos mientras hay modificaciones pendientes',()=>{
  renderSettings(owner,false)
  expect((screen.getByRole('button',{name:'Guardar nombre'}) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}) as HTMLButtonElement).disabled).toBe(true)
 })
 it('la eliminación sigue requiriendo confirmación por nombre sin usar prompt nativo',async()=>{
  const deleted=vi.fn(),native=vi.spyOn(window,'prompt')
  try{
   render(<ProjectSettings project={project} access={owner} canEditNow onClose={()=>{}} onRenamed={()=>{}} onDeleted={deleted}/>)
   fireEvent.click(screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}))
   const button=screen.getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement
   expect(button.disabled).toBe(true)
   fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Proyecto protegido'}})
   fireEvent.click(button)
   await waitFor(()=>expect(api.deleteProject).toHaveBeenCalledWith('p1'))
   expect(deleted).toHaveBeenCalledWith('p1')
   expect(native).not.toHaveBeenCalled()
  }finally{native.mockRestore()}
 })
 it('un lector no recibe edición ni administración destructiva',()=>{
  renderSettings({roleId:'r2',roleKey:'viewer',roleName:'Lector',permissions:['project.read']})
  expect(screen.queryByLabelText('Nombre del proyecto')).toBeNull()
  expect(screen.queryByRole('button',{name:'Eliminar proyecto definitivamente'})).toBeNull()
 })
 it('un error del backend en el borrado no cierra la confirmación',async()=>{
  vi.mocked(api.deleteProject).mockRejectedValueOnce(new Error('Permiso requerido: project.delete'))
  renderSettings()
  fireEvent.click(screen.getByRole('button',{name:'Eliminar proyecto definitivamente'}))
  fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Proyecto protegido'}})
  fireEvent.click(screen.getByRole('button',{name:'Eliminar definitivamente'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Permiso requerido')
  expect(screen.getByRole('dialog',{name:'Eliminar proyecto: Proyecto protegido'})).toBeTruthy()
 })
})
