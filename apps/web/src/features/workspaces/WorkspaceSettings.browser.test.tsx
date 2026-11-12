import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,fireEvent,screen,waitFor} from '@testing-library/react'
import WorkspaceSettings from './WorkspaceSettings'
import * as api from './api'
vi.mock('./api',()=>({renameWorkspace:vi.fn(),deleteWorkspace:vi.fn()}))
const workspace={id:'w1',name:'Mi espacio',role:'owner'}
const owner={roleId:'r1',roleKey:'owner',roleName:'Propietario',permissions:[]}
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.renameWorkspace).mockResolvedValue({id:'w1',name:'Renombrado'})})
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
  expect(screen.queryByRole('button',{name:'Eliminar espacio vacío'})).toBeNull()
 })
})
