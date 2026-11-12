import {describe,it,expect,vi,beforeEach} from 'vitest'
import {request} from '../../shared/api/http'
import {projectAccess,deleteProject,projectMembers,projectCandidates,assignProjectMember,removeProjectMember} from './api'
import {renameWorkspace,deleteWorkspace} from '../workspaces/api'
vi.mock('../../shared/api/http',()=>({request:vi.fn()}))
beforeEach(()=>vi.mocked(request).mockResolvedValue({ok:true} as never))
describe('ATLAS 4.7 permisos separados de espacios y proyectos',()=>{
 it('la política individual se consulta en el proyecto',async()=>{
  await projectAccess('p/1');expect(request).toHaveBeenCalledWith('/projects/p%2F1/access')
 })
 it('listar, asignar y quitar acceso no afecta otros proyectos',async()=>{
  await projectMembers('p1');await projectCandidates('p1')
  await assignProjectMember('p1','u1','r1');await removeProjectMember('p1','u1')
  expect(request).toHaveBeenCalledWith('/projects/p1/members/u1',{method:'PUT',body:JSON.stringify({roleId:'r1'})})
  expect(request).toHaveBeenCalledWith('/projects/p1/members/u1',{method:'DELETE'})
 })
 it('eliminar proyecto y editar/eliminar espacio usan endpoints diferentes',async()=>{
  await deleteProject('p1');await renameWorkspace('w1','Nuevo espacio');await deleteWorkspace('w1')
  expect(request).toHaveBeenCalledWith('/projects/p1',{method:'DELETE'})
  expect(request).toHaveBeenCalledWith('/workspaces/w1',{method:'PATCH',body:JSON.stringify({name:'Nuevo espacio'})})
  expect(request).toHaveBeenCalledWith('/workspaces/w1',{method:'DELETE'})
 })
})
