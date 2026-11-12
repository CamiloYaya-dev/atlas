import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {emptyDoc} from '@atlas/contracts'
import {listDocumentVersions,loadDocumentVersion} from './api'
import VersionHistory from './VersionHistory'

vi.mock('./api',()=>({listDocumentVersions:vi.fn(),loadDocumentVersion:vi.fn()}))
const recorded=[
 {version:3,created_at:'2026-11-12T12:00:00.000Z',updated_by:'actor-a',editor_name:'Equipo Arquitectura'},
 {version:2,created_at:'2026-11-12T11:00:00.000Z',updated_by:'actor-b',editor_name:'Equipo Producto'}
]
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(listDocumentVersions).mockResolvedValue(recorded)
 vi.mocked(loadDocumentVersion).mockResolvedValue({...recorded[1],document:emptyDoc()})
})
describe('Historial de documentos de ATLAS',()=>{
 it('muestra revisiones, autores y versión cargada sin escribir el documento',async()=>{
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} onClose={vi.fn()}/>)
  expect(screen.getByRole('dialog',{name:'Historial de versiones'})).toBeTruthy()
  expect(await screen.findByRole('button',{name:'Consultar v2'})).toBeTruthy()
  expect(screen.getByText('Equipo Arquitectura',{exact:false})).toBeTruthy()
  expect(screen.getByText('Equipo Producto',{exact:false})).toBeTruthy()
  expect(screen.getByText('Versión cargada: v3')).toBeTruthy()
  expect(listDocumentVersions).toHaveBeenCalledWith('proyecto-qa')
  fireEvent.click(screen.getByRole('button',{name:'Consultar v2'}))
  expect(await screen.findByLabelText('Detalle de versión 2')).toBeTruthy()
  expect(loadDocumentVersion).toHaveBeenCalledWith('proyecto-qa',2)
  expect(screen.queryByRole('button',{name:/Restaurar/})).toBeNull()
 })
 it('expone errores del servidor sin representar información histórica inventada',async()=>{
  vi.mocked(listDocumentVersions).mockRejectedValue(new Error('Permiso denegado'))
  render(<VersionHistory projectId="proyecto-qa" currentVersion={1} onClose={vi.fn()}/>)
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Permiso denegado'))
  expect(screen.queryByRole('button',{name:'Consultar v2'})).toBeNull()
 })
 it('permite actualizar la lista sin modificar el contenido del editor',async()=>{
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} onClose={vi.fn()}/>)
  await screen.findByRole('button',{name:'Consultar v2'})
  fireEvent.click(screen.getByRole('button',{name:'Actualizar historial'}))
  await waitFor(()=>expect(listDocumentVersions).toHaveBeenCalledTimes(2))
 })
})
