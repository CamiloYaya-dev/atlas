import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import type {ReactNode} from 'react'
import AtlasEditor from './AtlasEditor'
import * as auth from '../security/api'
import * as workspaces from '../workspaces/api'

vi.mock('@xyflow/react',()=>({
 ReactFlowProvider:({children}:{children:ReactNode})=><>{children}</>,
 ReactFlow:()=>null,Background:()=>null,Controls:()=>null,MiniMap:()=>null,
 useNodesState:(initial:unknown)=>[initial,vi.fn(),vi.fn()],
 Handle:()=>null,Position:{Left:'left',Right:'right'},MarkerType:{ArrowClosed:'arrowclosed'}
}))
vi.mock('../security/api',()=>({session:vi.fn(),login:vi.fn(),logout:vi.fn(),workspaceAccess:vi.fn()}))
vi.mock('../workspaces/api',()=>({listWorkspaces:vi.fn(),createWorkspace:vi.fn(),renameWorkspace:vi.fn(),deleteWorkspace:vi.fn()}))
vi.mock('../projects/api',()=>({listProjects:vi.fn(),createProject:vi.fn(),loadDocument:vi.fn(),saveDocument:vi.fn(),exportProject:vi.fn(),importProject:vi.fn(),listDocumentVersions:vi.fn(),loadDocumentVersion:vi.fn(),projectAccess:vi.fn(),deleteProject:vi.fn(),projectMembers:vi.fn(),projectCandidates:vi.fn(),assignProjectMember:vi.fn(),removeProjectMember:vi.fn()}))
beforeEach(()=>{
 vi.mocked(auth.session).mockRejectedValue(new Error('No autenticado'))
 vi.mocked(workspaces.listWorkspaces).mockResolvedValue([])
})
describe('Autenticación de ATLAS - interfaz cerrada',()=>{
 it('no ofrece registro público y siempre muestra formulario de login',async()=>{
  render(<AtlasEditor/>)
  await waitFor(()=>expect(screen.getByRole('heading',{name:'Iniciar sesión'})).toBeTruthy())
  expect(screen.getByText(/No existe registro público/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:/Registrarme|Crear cuenta gratis/})).toBeNull()
 })
 it('credenciales inválidas presentan error sin salir del login',async()=>{
  vi.mocked(auth.login).mockRejectedValue(new Error('Credenciales incorrectas'))
  render(<AtlasEditor/>)
  await screen.findByRole('heading',{name:'Iniciar sesión'})
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'mal@example.com'}})
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'incorrecta'}})
  fireEvent.click(screen.getByRole('button',{name:'Entrar a ATLAS'}))
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Credenciales incorrectas'))
  expect(screen.getByRole('heading',{name:'Iniciar sesión'})).toBeTruthy()
 })
 it('login válido cambia a sesión autenticada',async()=>{
  vi.mocked(auth.login).mockResolvedValue({id:'user-1',email:'qa@example.com',name:'QA',platformAdmin:false})
  render(<AtlasEditor/>)
  await screen.findByRole('heading',{name:'Iniciar sesión'})
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@example.com'}})
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'una-clave-de-prueba'}})
  fireEvent.click(screen.getByRole('button',{name:'Entrar a ATLAS'}))
  await waitFor(()=>expect(screen.getByText('API · PostgreSQL · Acceso cerrado')).toBeTruthy())
  expect(screen.queryByRole('heading',{name:'Iniciar sesión'})).toBeNull()
 })
})
