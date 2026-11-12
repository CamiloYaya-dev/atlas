import {describe,it,expect,vi,beforeEach} from 'vitest'
import {request,setCsrf} from '../../shared/api/http'
import {session,login,logout,workspaceAccess,workspaceRoles,workspaceMembers,usersList,createUser,setUserActive,createRole,updateRole,assignMember,removeMember} from './api'
vi.mock('../../shared/api/http',()=>({request:vi.fn(),setCsrf:vi.fn()}))
beforeEach(()=>vi.mocked(request).mockResolvedValue({user:{id:'u1',name:'QA',email:'qa@example.com',platformAdmin:true},csrfToken:'csrf-qa'} as never))
describe('Contratos HTTP de sesión y control de acceso',()=>{
 it('sesión/login propagan token CSRF del backend',async()=>{
  expect((await session()).id).toBe('u1')
  expect(setCsrf).toHaveBeenCalledWith('csrf-qa')
  await login('qa@example.com','clave-qa')
  expect(request).toHaveBeenCalledWith('/auth/login',{method:'POST',body:JSON.stringify({email:'qa@example.com',password:'clave-qa'})})
 })
 it('logout borra el token CSRF después de finalizar sesión',async()=>{
  await logout()
  expect(request).toHaveBeenCalledWith('/auth/logout',{method:'POST'})
  expect(setCsrf).toHaveBeenCalledWith('')
 })
 it('solicitudes de acceso y listados de administración',async()=>{
  await workspaceAccess('ws1');await workspaceRoles('ws1');await workspaceMembers('ws1');await usersList()
  expect(request).toHaveBeenCalledWith('/workspaces/ws1/access')
  expect(request).toHaveBeenCalledWith('/workspaces/ws1/roles')
  expect(request).toHaveBeenCalledWith('/workspaces/ws1/members')
  expect(request).toHaveBeenCalledWith('/admin/users')
 })
 it('creación, suspensión de usuarios y gestión de roles',async()=>{
  await createUser({email:'qa@example.com',name:'QA',password:'123456789012'})
  await setUserActive('u1',false)
  await createRole('ws1',{roleKey:'qa',name:'QA',permissions:['diagram.view.c1']})
  await updateRole('ws1','r1',['element.view.actor'])
  expect(request).toHaveBeenCalledWith('/admin/users/u1',{method:'PATCH',body:JSON.stringify({active:false})})
  expect(request).toHaveBeenCalledWith('/workspaces/ws1/roles/r1',{method:'PUT',body:JSON.stringify({permissions:['element.view.actor']})})
 })
 it('membresía asigna permisos mediante rol, no por cuenta global',async()=>{
  await assignMember('ws1','u1','r1');await removeMember('ws1','u1')
  expect(request).toHaveBeenCalledWith('/workspaces/ws1/members',{method:'POST',body:JSON.stringify({userId:'u1',roleId:'r1'})})
  expect(request).toHaveBeenCalledWith('/workspaces/ws1/members/u1',{method:'DELETE'})
 })
})
