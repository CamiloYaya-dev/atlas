import {describe,it,expect,vi} from 'vitest'
import {request} from '../../shared/api/http'
import {listWorkspaces,createWorkspace} from './api'
vi.mock('../../shared/api/http',()=>({request:vi.fn()}))
describe('API de espacios de trabajo',()=>{
 it('lista espacios sin confiar en un user id controlado por el cliente',async()=>{
  vi.mocked(request).mockResolvedValueOnce([] as never)
  await listWorkspaces('id falsificado')
  expect(request).toHaveBeenCalledWith('/workspaces')
 })
 it('crea un espacio y devuelve su identificador',async()=>{
  vi.mocked(request).mockResolvedValueOnce({id:'w1'} as never)
  expect(await createWorkspace('Nuevo espacio')).toBe('w1')
  expect(request).toHaveBeenCalledWith('/workspaces',{method:'POST',body:JSON.stringify({name:'Nuevo espacio'})})
 })
})

it('renombrar y borrar exigen el recurso codificado y el borrado en cascada explícito',async()=>{
 const {renameWorkspace,deleteWorkspace}=await import('./api')
 await renameWorkspace('w/1','Nuevo');expect(request).toHaveBeenLastCalledWith('/workspaces/w%2F1',{method:'PATCH',body:JSON.stringify({name:'Nuevo'})})
 await deleteWorkspace('w/1');expect(request).toHaveBeenLastCalledWith('/workspaces/w%2F1',{method:'DELETE'})
 await deleteWorkspace('w/1','Nuevo',true);expect(request).toHaveBeenLastCalledWith('/workspaces/w%2F1',{method:'DELETE',body:JSON.stringify({confirmName:'Nuevo',deleteProjects:true})})
})
