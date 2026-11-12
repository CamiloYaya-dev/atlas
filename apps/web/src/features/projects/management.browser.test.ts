import {describe,it,expect,vi,beforeEach} from 'vitest'
import {renameProject,restoreDocumentVersion} from './api'
import {request} from '../../shared/api/http'
vi.mock('../../shared/api/http',()=>({request:vi.fn()}))
beforeEach(()=>{vi.resetAllMocks()})
describe('Gestión administrativa segura de proyectos',()=>{
 it('renombra solo el proyecto indicado mediante PATCH sin alterar diagramas',async()=>{
  vi.mocked(request).mockResolvedValueOnce({id:'project/1',workspace_id:'w',name:'Nuevo nombre'} as never)
  expect(await renameProject('project/1','Nuevo nombre')).toHaveProperty('name','Nuevo nombre')
  expect(request).toHaveBeenCalledWith('/projects/project%2F1',{method:'PATCH',body:JSON.stringify({name:'Nuevo nombre'})})
 })
 it('restauración manda versión histórica y versión actual (CAS)',async()=>{
  vi.mocked(request).mockResolvedValueOnce({version:8,restoredFrom:2} as never)
  expect(await restoreDocumentVersion('p1',2,7)).toEqual({version:8,restoredFrom:2})
  expect(request).toHaveBeenCalledWith('/projects/p1/restore',{method:'POST',body:JSON.stringify({sourceVersion:2,expectedVersion:7})})
 })
})
