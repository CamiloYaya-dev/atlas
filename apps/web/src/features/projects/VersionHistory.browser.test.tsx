import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {emptyDoc,createElement} from '@atlas/contracts'
import {listDocumentVersions,loadDocumentVersion,restoreDocumentVersion,listRestoreBranches,createRestoreBranch,previewRestoreBranch,applyRestoreBranch,discardRestoreBranch} from './api'
import VersionHistory from './VersionHistory'

vi.mock('./api',()=>({listDocumentVersions:vi.fn(),loadDocumentVersion:vi.fn(),restoreDocumentVersion:vi.fn(),listRestoreBranches:vi.fn(),createRestoreBranch:vi.fn(),previewRestoreBranch:vi.fn(),applyRestoreBranch:vi.fn(),discardRestoreBranch:vi.fn()}))
const recorded=[
 {version:3,created_at:'2026-11-12T12:00:00.000Z',updated_by:'actor-a',editor_name:'Equipo Arquitectura'},
 {version:2,created_at:'2026-11-12T11:00:00.000Z',updated_by:'actor-b',editor_name:'Equipo Producto'}
]
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(listDocumentVersions).mockResolvedValue(recorded)
 vi.mocked(loadDocumentVersion).mockResolvedValue({...recorded[1],document:emptyDoc()})
 vi.mocked(restoreDocumentVersion).mockResolvedValue({version:4,restoredFrom:2})
 vi.mocked(listRestoreBranches).mockResolvedValue([])
 vi.mocked(createRestoreBranch).mockResolvedValue({id:'branch-qa',source_version:2,base_version:3,status:'open',created_at:'2026-11-12',creator_name:'QA'})
 vi.mocked(previewRestoreBranch).mockResolvedValue({id:'branch-qa',sourceVersion:2,baseVersion:3,currentVersion:4,status:'open',conflicts:['document.elements.foo.name'],historicalDiagrams:1,currentDiagrams:1})
 vi.mocked(applyRestoreBranch).mockResolvedValue({version:5,restoredFrom:2})
 vi.mocked(discardRestoreBranch).mockResolvedValue({ok:true})
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
 it('dibuja una revisión histórica y muestra diferencias contra la revisión actual',async()=>{
  const old=emptyDoc(),updated=emptyDoc()
  const element=createElement('API de pagos','service')
  old.elements[element.id]=element
  const diagram={id:'d1',name:'C2 · Visual',description:'',type:'c2' as const,createdAt:'2026-01-01',nodes:[{id:'n1',elementId:element.id,x:30,y:40}],edges:[]}
  old.diagrams=[diagram]
  updated.elements[element.id]={...element,name:'API de pagos V2'}
  updated.diagrams=[{...diagram,name:'C2 · Cambiado'}]
  vi.mocked(loadDocumentVersion).mockImplementation(async(_id,version)=>({...(version===2?recorded[1]:recorded[0]),document:version===2?old:updated}))
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} onClose={vi.fn()}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
  expect(await screen.findByRole('img',{name:'Vista histórica del diagrama C2 · Visual'})).toBeTruthy()
  expect(await screen.findByText(/Modificado · Diagrama: C2 · Cambiado/)).toBeTruthy()
  expect(screen.getByText(/Modificado · Elemento: API de pagos V2/)).toBeTruthy()
 })
 it('propietario crea nueva versión al restaurar; el lector nunca recibe ese botón',async()=>{
  const onRestored=vi.fn().mockResolvedValue(undefined),onClose=vi.fn()
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onRestored={onRestored} onClose={onClose}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
  fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}))
  expect(screen.getByRole('dialog',{name:'Confirmar restauración v2'})).toBeTruthy()
  expect(restoreDocumentVersion).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Confirmación de versión'),{target:{value:'v2'}})
  fireEvent.click(screen.getByRole('button',{name:'Crear versión restaurada'}))
  await waitFor(()=>expect(restoreDocumentVersion).toHaveBeenCalledWith('proyecto-qa',2,3))
  await waitFor(()=>expect(onRestored).toHaveBeenCalledWith(4))
  expect(onClose).toHaveBeenCalled()
  vi.restoreAllMocks()
 })
 it('si el servidor rechaza una restauración por 409, informa conflicto sin cerrar el historial',async()=>{
  vi.mocked(restoreDocumentVersion).mockRejectedValue(new Error('Conflicto 409'))
  const onClose=vi.fn()
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={onClose}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
  fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}))
  fireEvent.change(screen.getByLabelText('Confirmación de versión'),{target:{value:'v2'}})
  fireEvent.click(screen.getByRole('button',{name:'Crear versión restaurada'}))
  await waitFor(()=>expect(screen.getAllByRole('alert').some(item=>item.textContent?.includes('Conflicto 409'))).toBe(true))
  expect(onClose).not.toHaveBeenCalled()
  vi.restoreAllMocks()
 })
 it('cancelar restauración no envía ninguna operación de escritura',async()=>{
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
  fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}))
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}))
  expect(restoreDocumentVersion).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog',{name:'Confirmar restauración v2'})).toBeNull()
 })
 it('puede preparar una rama sin restaurar el documento vigente',async()=>{
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={vi.fn()}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
  fireEvent.click(await screen.findByRole('button',{name:'Preparar rama desde v2'}))
  await waitFor(()=>expect(createRestoreBranch).toHaveBeenCalledWith('proyecto-qa',2))
  expect(restoreDocumentVersion).not.toHaveBeenCalled()
 })
 it('obliga a elegir resolución de conflicto antes de aplicar una rama',async()=>{
  vi.mocked(listRestoreBranches).mockResolvedValue([{id:'branch-qa',source_version:2,base_version:3,status:'open',created_at:'2026-11-12',creator_name:'QA'}])
  const onRestored=vi.fn().mockResolvedValue(undefined)
  render(<VersionHistory projectId="proyecto-qa" currentVersion={4} canRestore onRestored={onRestored} onClose={vi.fn()}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}))
  expect(await screen.findByText('Conflictos detectados: 1')).toBeTruthy()
  const action=screen.getByRole('button',{name:'Aplicar rama como nueva versión'}) as HTMLButtonElement
  expect(action.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Resolver document.elements.foo.name'),{target:{value:'historical'}})
  expect(action.disabled).toBe(false)
  fireEvent.click(action)
  await waitFor(()=>expect(applyRestoreBranch).toHaveBeenCalledWith('proyecto-qa','branch-qa',4,'merge',{'document.elements.foo.name':'historical'}))
  await waitFor(()=>expect(onRestored).toHaveBeenCalledWith(5))
 })
 it('permite actualizar la lista sin modificar el contenido del editor',async()=>{
  render(<VersionHistory projectId="proyecto-qa" currentVersion={3} onClose={vi.fn()}/>)
  await screen.findByRole('button',{name:'Consultar v2'})
  fireEvent.click(screen.getByRole('button',{name:'Actualizar historial'}))
  await waitFor(()=>expect(listDocumentVersions).toHaveBeenCalledTimes(2))
 })
})
