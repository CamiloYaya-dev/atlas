import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import AuditPanel from './AuditPanel'
import {listAuditEvents} from './api'
import {listProjects} from '../projects/api'
vi.mock('./api',()=>({listAuditEvents:vi.fn()}))
vi.mock('../projects/api',()=>({listProjects:vi.fn()}))
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(listProjects).mockResolvedValue([{id:'11111111-1111-4111-8111-111111111111',name:'Proyecto permitido',workspace_id:'workspace-1'}])
})
describe('Auditoría paginada y filtrable',()=>{
 it('presenta registros en tabla, pagina usando cursor y filtra por proyecto autorizado',async()=>{
  vi.mocked(listAuditEvents).mockResolvedValueOnce({items:[{id:'10',event_type:'project.renamed',actor_name:'Editor QA',actor_email:'editor@qa.test',resource_id:'p1',detail:{name:'Nombre'},created_at:'2026-11-12T12:00:00Z'}],nextCursor:'10'})
   .mockResolvedValueOnce({items:[{id:'9',event_type:'project.document_restore',actor_name:'Arquitectura',actor_email:null,resource_id:'p1',detail:{sourceVersion:1},created_at:'2026-11-11T12:00:00Z'}],nextCursor:null})
   .mockResolvedValue({items:[],nextCursor:null})
  render(<AuditPanel workspaceId="workspace-1" onClose={vi.fn()}/> )
  expect(await screen.findByText('Proyecto renombrado')).toBeTruthy()
  expect(screen.getByRole('table')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Siguiente'}))
  expect(await screen.findByText('Versión restaurada')).toBeTruthy()
  expect(listAuditEvents).toHaveBeenCalledWith('workspace-1',25,'10',expect.objectContaining({actor:'',projectId:''}))
  fireEvent.change(screen.getByLabelText('Filtrar proyecto'),{target:{value:'11111111-1111-4111-8111-111111111111'}})
  fireEvent.click(screen.getByRole('button',{name:'Aplicar filtros'}))
  await waitFor(()=>expect(listAuditEvents).toHaveBeenLastCalledWith('workspace-1',25,undefined,expect.objectContaining({projectId:'11111111-1111-4111-8111-111111111111'})))
 })
 it('presenta denegación de permiso sin inventar eventos',async()=>{
  vi.mocked(listAuditEvents).mockRejectedValueOnce(new Error('Permiso requerido'))
  render(<AuditPanel workspaceId="workspace-1" onClose={vi.fn()}/> )
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Permiso requerido'))
 })
 it('puede limpiar filtros y seleccionar filas por página',async()=>{
  vi.mocked(listAuditEvents).mockResolvedValue({items:[],nextCursor:null})
  render(<AuditPanel workspaceId="workspace-1" onClose={vi.fn()}/> )
  await screen.findByText(/No hay eventos/)
  fireEvent.change(screen.getByLabelText('Filtrar usuario'),{target:{value:'Lady'}})
  fireEvent.change(screen.getByLabelText('Filas por página'),{target:{value:'10'}})
  await waitFor(()=>expect(listAuditEvents).toHaveBeenLastCalledWith('workspace-1',10,undefined,expect.objectContaining({actor:''})))
  fireEvent.click(screen.getByRole('button',{name:'Aplicar filtros'}))
  await waitFor(()=>expect(listAuditEvents).toHaveBeenLastCalledWith('workspace-1',10,undefined,expect.objectContaining({actor:'Lady'})))
  fireEvent.click(screen.getByRole('button',{name:'Limpiar'}))
  await waitFor(()=>expect(listAuditEvents).toHaveBeenLastCalledWith('workspace-1',10,undefined,expect.objectContaining({actor:''})))
 })
})
