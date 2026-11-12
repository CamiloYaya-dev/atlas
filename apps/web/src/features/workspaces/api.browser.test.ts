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
