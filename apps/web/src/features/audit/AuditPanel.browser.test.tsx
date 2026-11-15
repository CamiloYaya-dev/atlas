import {beforeEach,describe,expect,it,vi} from 'vitest'
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react'
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

it('permite filtrar fechas y acción, volver a la página anterior, actualizar y cerrar',async()=>{
 const close=vi.fn()
 vi.mocked(listAuditEvents).mockResolvedValueOnce({items:[{id:'1',event_type:'qa.event',actor_name:'QA',actor_email:null,resource_id:null,detail:{},created_at:'2026-11-14T12:00:00Z'}],nextCursor:'1'}).mockResolvedValue({items:[],nextCursor:null})
 render(<AuditPanel workspaceId="workspace-1" onClose={close}/>)
 expect(await screen.findByText('qa.event')).toBeTruthy()
 expect(screen.getByText('Espacio de trabajo')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}))
 await screen.findByText('Resultados · página 2')
 await waitFor(()=>expect((screen.getByRole('button',{name:'Anterior'}) as HTMLButtonElement).disabled).toBe(false))
 fireEvent.click(screen.getByRole('button',{name:'Anterior'}))
 await screen.findByText('Resultados · página 1')
 fireEvent.change(screen.getByLabelText('Filtrar acción'),{target:{value:'project.created'}})
 fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-11-01'}})
 fireEvent.change(screen.getByLabelText('Hasta'),{target:{value:'2026-11-14'}})
 fireEvent.click(screen.getByRole('button',{name:'Aplicar filtros'}))
 await waitFor(()=>expect(listAuditEvents).toHaveBeenLastCalledWith('workspace-1',25,undefined,expect.objectContaining({eventType:'project.created',from:'2026-11-01',to:'2026-11-14'})))
 const count=vi.mocked(listAuditEvents).mock.calls.length
 fireEvent.click(screen.getByRole('button',{name:'Actualizar actividad'}))
 await waitFor(()=>expect(listAuditEvents).toHaveBeenCalledTimes(count+1))
 fireEvent.click(screen.getAllByRole('button',{name:'Cerrar'}).at(-1)!);expect(close).toHaveBeenCalled()
})


it('la indisponibilidad del catálogo no impide informar el error textual de auditoría',async()=>{
 vi.mocked(listProjects).mockRejectedValueOnce(new Error('Catálogo no disponible'))
 vi.mocked(listAuditEvents).mockRejectedValueOnce('Auditoría no disponible QA')
 render(<AuditPanel workspaceId="workspace-1" onClose={vi.fn()}/> )
 expect((await screen.findByRole('alert')).textContent).toContain('Auditoría no disponible QA');expect(screen.queryByText('Proyecto permitido')).toBeNull()
 vi.mocked(listAuditEvents).mockResolvedValueOnce({items:[],nextCursor:null});fireEvent.click(screen.getByRole('button',{name:'Actualizar actividad'}));expect(await screen.findByText(/No hay eventos/)).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull()
})
it('descarta respuestas de otro workspace al cambiar de contexto',async()=>{
 let resolveOld!:(value:Awaited<ReturnType<typeof listAuditEvents>>)=>void
 vi.mocked(listAuditEvents).mockReturnValueOnce(new Promise(resolve=>{resolveOld=resolve})).mockResolvedValue({items:[],nextCursor:null})
 const view=render(<AuditPanel workspaceId="old" onClose={vi.fn()}/>);view.rerender(<AuditPanel workspaceId="new" onClose={vi.fn()}/>);await screen.findByText(/No hay eventos/)
 await act(async()=>{resolveOld({items:[{id:'old',event_type:'project.created',actor_name:'Usuario anterior QA',actor_email:null,resource_id:null,detail:{},created_at:'2026-11-14'}],nextCursor:null})});expect(screen.queryByText('Usuario anterior QA')).toBeNull()
})

