import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import LicensePanel from './LicensePanel'
import * as api from '../projects/api'
vi.mock('../projects/api',()=>({workspaceLicense:vi.fn(),setWorkspaceLicense:vi.fn()}))
const free={workspaceId:'test-workspace',planCode:'free' as const,licenseActive:false,status:'free',features:{'diagram.export.png':true,'diagram.export.jpg':true,'diagram.export.clean':false,'diagram.export.advanced':false},expiresAt:null}
const pro={...free,planCode:'pro' as const,status:'active',licenseActive:true,features:{...free.features,'diagram.export.clean':true,'diagram.export.advanced':true}}
describe('Licencias NOVZI',()=>{
 it('un miembro consulta pero no activa una licencia',async()=>{
  vi.mocked(api.workspaceLicense).mockResolvedValue(free)
  render(<LicensePanel workspaceId="test-workspace" workspaceName="Organización QA" platformAdmin={false} onClose={()=>{}}/>)
  expect(await screen.findByText('FREE · Sin licencia comercial')).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Activar PRO de prueba'})).toBeNull()
 })
 it('un administrador activa y revoca PRO mediante la API',async()=>{
  vi.mocked(api.workspaceLicense).mockResolvedValue(free)
  vi.mocked(api.setWorkspaceLicense).mockResolvedValueOnce(pro).mockResolvedValueOnce(free)
  render(<LicensePanel workspaceId="test-workspace" workspaceName="Organización QA" platformAdmin={true} onClose={()=>{}}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Activar PRO de prueba'}))
  await waitFor(()=>expect(api.setWorkspaceLicense).toHaveBeenCalledWith('test-workspace',{planCode:'pro',status:'active',features:{}}))
  expect(await screen.findByText('PRO · Licencia activa')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Desactivar licencia'}))
  await waitFor(()=>expect(api.setWorkspaceLicense).toHaveBeenCalledWith('test-workspace',{planCode:'free',status:'revoked',features:{}}))
  expect(await screen.findByText('FREE · Sin licencia comercial')).toBeTruthy()
 })
})

it('presenta errores de consulta y de activación sin conceder PRO localmente, permite actualizar y cerrar',async()=>{
 vi.mocked(api.workspaceLicense).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(free)
 vi.mocked(api.setWorkspaceLicense).mockRejectedValueOnce(new Error('Permiso denegado'))
 const close=vi.fn();render(<LicensePanel workspaceId="test-workspace" workspaceName="QA" platformAdmin onClose={close}/> )
 expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión');fireEvent.click(screen.getByRole('button',{name:'Actualizar'}));expect(await screen.findByText('FREE · Sin licencia comercial')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Activar PRO de prueba'}));expect((await screen.findByRole('alert')).textContent).toContain('Permiso denegado');expect(screen.queryByText('PRO · Licencia activa')).toBeNull();fireEvent.click(screen.getAllByRole('button',{name:'Cerrar'}).at(-1)!);expect(close).toHaveBeenCalledOnce()
})
