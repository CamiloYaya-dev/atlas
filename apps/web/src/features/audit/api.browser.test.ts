import {beforeEach,describe,expect,it,vi} from 'vitest'
import {request} from '../../shared/api/http'
import {listAuditEvents} from './api'
vi.mock('../../shared/api/http',()=>({request:vi.fn()}))
beforeEach(()=>{vi.resetAllMocks();vi.mocked(request).mockResolvedValue({items:[],nextCursor:null} as never)})
describe('Auditoría: contrato de filtros y cursor',()=>{
 it('codifica parámetros y limita cada solicitud a su espacio',async()=>{
  await listAuditEvents('espacio/qa',10,'125',{eventType:'project.document_restore',actor:'Lady Morales',projectId:'11111111-1111-4111-8111-111111111111',from:'2026-11-01',to:'2026-11-12'})
  const [url]=vi.mocked(request).mock.calls[0]
  const parsed=new URL('http://atlas.local/api/v1'+url)
  expect(parsed.pathname).toContain('espacio%2Fqa')
  expect(parsed.searchParams.get('limit')).toBe('10')
  expect(parsed.searchParams.get('beforeId')).toBe('125')
  expect(parsed.searchParams.get('eventType')).toBe('project.document_restore')
  expect(parsed.searchParams.get('actor')).toBe('Lady Morales')
  expect(parsed.searchParams.get('projectId')).toBe('11111111-1111-4111-8111-111111111111')
  expect(parsed.searchParams.get('from')).toBe('2026-11-01')
  expect(parsed.searchParams.get('to')).toBe('2026-11-12')
 })
 it('no envía filtros vacíos ni cursor cuando se consulta la primera página',async()=>{
  await listAuditEvents('w1',25,undefined,{actor:'',projectId:''})
  expect(request).toHaveBeenCalledWith('/workspaces/w1/audit?limit=25')
 })
})
