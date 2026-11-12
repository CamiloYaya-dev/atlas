import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import AuditPanel from './AuditPanel'
import {listAuditEvents} from './api'
vi.mock('./api',()=>({listAuditEvents:vi.fn()}))
beforeEach(()=>vi.resetAllMocks())
describe('Panel de auditoría',()=>{
 it('lista quién, qué, cuándo y recurso, y permite paginar de manera segura',async()=>{
  vi.mocked(listAuditEvents).mockResolvedValueOnce({items:[{id:'10',event_type:'project.renamed',actor_name:'Editor QA',actor_email:'editor@qa.test',resource_id:'p1',detail:{name:'Nuevo nombre'},created_at:'2026-11-12T12:00:00Z'}],nextCursor:'10'})
   .mockResolvedValueOnce({items:[{id:'9',event_type:'project.document_restore',actor_name:'Arquitectura',actor_email:null,resource_id:'p1',detail:{sourceVersion:1},created_at:'2026-11-11T12:00:00Z'}],nextCursor:null})
  render(<AuditPanel workspaceId="workspace-1" onClose={vi.fn()}/>)
  expect(await screen.findByText('Proyecto renombrado')).toBeTruthy()
  expect(screen.getByText(/Editor QA/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Cargar eventos anteriores'}))
  expect(await screen.findByText('Versión restaurada')).toBeTruthy()
  expect(listAuditEvents).toHaveBeenNthCalledWith(2,'workspace-1',30,'10')
 })
 it('reporta acceso denegado sin mostrar eventos ficticios',async()=>{
  vi.mocked(listAuditEvents).mockRejectedValueOnce(new Error('Permiso requerido'))
  render(<AuditPanel workspaceId="workspace-1" onClose={vi.fn()}/>)
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Permiso requerido'))
 })
})
