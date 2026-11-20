import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {emptyDoc,createElement} from '@novzi/contracts'
import DiagramVersionHistory from './DiagramVersionHistory'
import * as api from './api'

vi.mock('./api',()=>({
 loadDiagramState:vi.fn(),listDiagramCheckpoints:vi.fn(),loadDiagramCheckpoint:vi.fn(),
 createDiagramCheckpoint:vi.fn(),restoreDiagramCheckpoint:vi.fn()
}))
vi.mock('./VersionDiagramPreview',()=>({default:()=> <div data-testid="historic-preview">Vista previa histórica</div>}))

const baseline={version:1,created_at:'2026-11-19T10:00:00.000Z',created_by:'u-qa',editor_name:'QA',reason:'baseline' as const}
const doc=()=>{
 const document=emptyDoc(),item=createElement('Cliente','actor');item.id='client';document.elements.client=item
 document.diagrams=[{id:'c2',type:'c2',name:'C2 nuevo',createdAt:'2026-11-19',description:'',nodes:[{id:'n1',elementId:'client',x:0,y:0}],edges:[]}]
 return document
}
const props=()=>({projectId:'p-qa',diagramId:'c2',diagramName:'C2 nuevo',canCheckpoint:true,canRestore:true,onClose:vi.fn(),onRestored:vi.fn(async()=>{}),onOpenProjectHistory:vi.fn()})
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(api.loadDiagramState).mockResolvedValue({revision:12,version:1})
 vi.mocked(api.listDiagramCheckpoints).mockResolvedValue([baseline])
 const snapshot=doc()
 vi.mocked(api.loadDiagramCheckpoint).mockResolvedValue({...baseline,snapshot:{diagram:snapshot.diagrams[0],elements:snapshot.elements}})
 vi.mocked(api.createDiagramCheckpoint).mockResolvedValue({version:2,created:true})
 vi.mocked(api.restoreDiagramCheckpoint).mockResolvedValue({version:264,restoredFrom:1,unchanged:false})
})

describe('Historial por diagrama independiente del cursor global',()=>{
 it('el C2 recién creado indica v1 aunque el proyecto esté en v263',async()=>{
  const p=props();render(<DiagramVersionHistory {...p}/> )
  expect(await screen.findByText('Versión de C2 nuevo: v1')).toBeTruthy()
  expect(screen.queryByText(/v263/)).toBeNull()
  expect(await screen.findByRole('button',{name:'Consultar v1'})).toBeTruthy()
  expect(api.loadDiagramState).toHaveBeenCalledWith('p-qa','c2')
  expect(p.onOpenProjectHistory).not.toHaveBeenCalled()
 })
 it('crear un punto manual no modifica otros diagramas ni el cursor global en la interfaz',async()=>{
  const p=props();render(<DiagramVersionHistory {...p}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Crear punto de control ahora'}))
  await waitFor(()=>expect(api.createDiagramCheckpoint).toHaveBeenCalledWith('p-qa','c2'))
  expect(api.loadDiagramState).toHaveBeenCalledWith('p-qa','c2')
  expect(p.onRestored).not.toHaveBeenCalled()
 })
 it('restaurar utiliza la revisión actual de C2, no el número de versión del proyecto',async()=>{
  const p=props();render(<DiagramVersionHistory {...p}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v1'}))
  expect(await screen.findByTestId('historic-preview')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Restaurar solo este diagrama'}))
  const confirmation=await screen.findByRole('dialog',{name:'Restaurar diagrama desde v1'})
  fireEvent.change(within(confirmation).getByLabelText('Confirmar restauración de diagrama'),{target:{value:'v1'}})
  fireEvent.click(within(confirmation).getByRole('button',{name:'Restaurar diagrama'}))
  await waitFor(()=>expect(api.restoreDiagramCheckpoint).toHaveBeenCalledWith('p-qa','c2',1,12))
  await waitFor(()=>expect(p.onRestored).toHaveBeenCalledWith(264))
  expect(p.onClose).toHaveBeenCalledOnce()
 })
 it('ante conflicto de ficha compartida no da por restaurado el proyecto',async()=>{
  vi.mocked(api.restoreDiagramCheckpoint).mockRejectedValue(new Error('La ficha compartida cambió en otro diagrama'))
  const p=props();render(<DiagramVersionHistory {...p}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Consultar v1'}))
  await screen.findByTestId('historic-preview')
  fireEvent.click(screen.getByRole('button',{name:'Restaurar solo este diagrama'}))
  const confirm=await screen.findByRole('dialog',{name:'Restaurar diagrama desde v1'})
  fireEvent.change(within(confirm).getByLabelText('Confirmar restauración de diagrama'),{target:{value:'v1'}})
  fireEvent.click(within(confirm).getByRole('button',{name:'Restaurar diagrama'}))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','La ficha compartida cambió en otro diagrama')
  expect(p.onRestored).not.toHaveBeenCalled()
  expect(p.onClose).not.toHaveBeenCalled()
 })
})
