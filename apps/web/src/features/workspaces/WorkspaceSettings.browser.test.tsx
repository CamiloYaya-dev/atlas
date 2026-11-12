import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,fireEvent,screen,waitFor} from '@testing-library/react'
import WorkspaceSettings from './WorkspaceSettings'
import * as api from './api'
import {listProjects} from '../projects/api'
vi.mock('./api',()=>({renameWorkspace:vi.fn(),deleteWorkspace:vi.fn()}))
vi.mock('../projects/api',()=>({listProjects:vi.fn()}))
const workspace={id:'w1',name:'Mi espacio',role:'owner'}
const owner={roleId:'r1',roleKey:'owner',roleName:'Propietario',permissions:[]}
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(api.renameWorkspace).mockResolvedValue({id:'w1',name:'Renombrado'})
 vi.mocked(api.deleteWorkspace).mockResolvedValue({ok:true,deletedProjects:0})
 vi.mocked(listProjects).mockResolvedValue([])
})
describe('Espacios editables y protegidos',()=>{
 it('permite cambiar nombre cuando el rol tiene permiso',async()=>{
  const renamed=vi.fn()
  render(<WorkspaceSettings workspace={workspace} access={owner} onClose={()=>{}} onRenamed={renamed} onDeleted={()=>{}}/>)
  fireEvent.change(screen.getByLabelText('Nombre del espacio'),{target:{value:'Renombrado'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar nombre'}))
  await waitFor(()=>expect(renamed).toHaveBeenCalledWith('w1','Renombrado'))
 })
 it('oculta eliminación y bloquea edición para lector del espacio',()=>{
  render(<WorkspaceSettings workspace={workspace} access={{roleId:'r2',roleKey:'viewer',roleName:'Lector',permissions:[]}} onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  expect((screen.getByLabelText('Nombre del espacio') as HTMLInputElement).disabled).toBe(true)
  expect(screen.queryByRole('button',{name:'Eliminar espacio…'})).toBeNull()
 })
 it('confirma borrado de espacio vacío con un campo propio de ATLAS, sin usar prompt',async()=>{
  const deleted=vi.fn()
  const native=vi.spyOn(window,'prompt')
  render(<WorkspaceSettings workspace={workspace} access={owner} onClose={()=>{}} onRenamed={()=>{}} onDeleted={deleted}/>)
  fireEvent.click(screen.getByRole('button',{name:'Eliminar espacio…'}))
  await screen.findByRole('heading',{name:'Eliminar espacio: Mi espacio'})
  const button=screen.getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Mi espacio'}})
  expect(button.disabled).toBe(false)
  fireEvent.click(button)
  await waitFor(()=>expect(api.deleteWorkspace).toHaveBeenCalledWith('w1','Mi espacio',false))
  await waitFor(()=>expect(deleted).toHaveBeenCalledWith('w1'))
  expect(native).not.toHaveBeenCalled()
  native.mockRestore()
 })
 it('borrado en cascada exige marcar el alcance completo y escribir el nombre exacto',async()=>{
  vi.mocked(listProjects).mockResolvedValue([{id:'p1',name:'Proyecto reservado',workspace_id:'w1'}] as never)
  const deleted=vi.fn()
  render(<WorkspaceSettings workspace={workspace} access={owner} onClose={()=>{}} onRenamed={()=>{}} onDeleted={deleted}/>)
  fireEvent.click(screen.getByRole('button',{name:'Eliminar espacio…'}))
  await screen.findByText(/Este espacio contiene 1 proyecto/)
  const button=screen.getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement
  fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Mi espacio'}})
  expect(button.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(button.disabled).toBe(false)
  fireEvent.click(button)
  await waitFor(()=>expect(api.deleteWorkspace).toHaveBeenCalledWith('w1','Mi espacio',true))
  await waitFor(()=>expect(deleted).toHaveBeenCalledWith('w1'))
 })
 it('si la API rechaza la eliminación, el modal permanece abierto y muestra el error',async()=>{
  vi.mocked(api.deleteWorkspace).mockRejectedValue(new Error('Permiso requerido: workspace.delete'))
  render(<WorkspaceSettings workspace={workspace} access={owner} onClose={()=>{}} onRenamed={()=>{}} onDeleted={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Eliminar espacio…'}))
  await screen.findByRole('heading',{name:'Eliminar espacio: Mi espacio'})
  fireEvent.change(screen.getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:'Mi espacio'}})
  fireEvent.click(screen.getByRole('button',{name:'Eliminar definitivamente'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Permiso requerido')
  expect(screen.getByRole('heading',{name:'Eliminar espacio: Mi espacio'})).toBeTruthy()
 })
})
