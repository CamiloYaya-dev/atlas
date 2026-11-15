import {beforeEach,describe,expect,it,vi} from 'vitest'
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
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

it('historial comunica error de carga y se recupera al actualizar',async()=>{
 vi.mocked(listDocumentVersions).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce([])
 render(<VersionHistory projectId="proyecto-qa" currentVersion={3} onClose={vi.fn()}/>);expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión');fireEvent.click(screen.getByRole('button',{name:'Actualizar historial'}));expect(await screen.findByText('No hay versiones registradas.')).toBeTruthy()
})
it('no oculta una restauración confirmada por servidor aunque falle la recarga local',async()=>{
 const close=vi.fn();render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={close} onRestored={async()=>{throw new Error('Recarga fallida')}}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}));fireEvent.change(screen.getByLabelText('Confirmación de versión'),{target:{value:'v2'}});fireEvent.click(screen.getByRole('button',{name:'Crear versión restaurada'}));expect((await screen.findByRole('alert')).textContent).toContain('Versión v4 creada en el servidor');expect(close).not.toHaveBeenCalled()
})
it('reemplazar desde una rama exige confirmación literal y utiliza la versión de la vista previa',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValue([{id:'branch-qa',source_version:2,base_version:3,status:'open',created_at:'fecha ilegible',creator_name:null}]);const close=vi.fn();render(<VersionHistory projectId="proyecto-qa" currentVersion={4} canRestore onClose={close}/>);fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}));fireEvent.change(await screen.findByLabelText('Modo de aplicación'),{target:{value:'replace'}});const apply=screen.getByRole('button',{name:'Aplicar rama como nueva versión'}) as HTMLButtonElement;expect(apply.disabled).toBe(true);fireEvent.change(screen.getByLabelText('Confirmar reemplazo total'),{target:{value:'REEMPLAZAR'}});expect(apply.disabled).toBe(false);fireEvent.click(apply);await waitFor(()=>expect(applyRestoreBranch).toHaveBeenCalledWith('proyecto-qa','branch-qa',4,'replace',{}));await waitFor(()=>expect(close).toHaveBeenCalledOnce())
})
it('descartar una propuesta no restaura el documento',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValueOnce([{id:'branch-qa',source_version:2,base_version:3,status:'open',created_at:'2026-11-12',creator_name:'QA'}]).mockResolvedValueOnce([]);render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Descartar'}));await waitFor(()=>expect(discardRestoreBranch).toHaveBeenCalledWith('proyecto-qa','branch-qa'));expect(await screen.findByText('No hay propuestas abiertas.')).toBeTruthy();expect(restoreDocumentVersion).not.toHaveBeenCalled();expect(applyRestoreBranch).not.toHaveBeenCalled()
})

const openBranchQA={id:'branch-qa',source_version:2,base_version:3,status:'open' as const,created_at:'2026-11-12',creator_name:'QA'}
const previewQA={id:'branch-qa',sourceVersion:2,baseVersion:3,currentVersion:4,status:'open' as const,conflicts:[],historicalDiagrams:1,currentDiagrams:1}
it('seleccionar una revisión fallida no ofrece restaurar datos inexistentes',async()=>{
 vi.mocked(loadDocumentVersion).mockRejectedValueOnce('Versión no disponible')
 render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
 expect((await screen.findByRole('alert')).textContent).toContain('Versión no disponible')
 expect(screen.queryByLabelText('Detalle de versión 2')).toBeNull()
 expect(restoreDocumentVersion).not.toHaveBeenCalled()
})
it('una comparación fallida conserva la instantánea seleccionada en modo de consulta',async()=>{
 vi.mocked(loadDocumentVersion).mockImplementation(async(_id,v)=>{if(v===3)throw new Error('Comparación no disponible');return {...recorded[1],document:emptyDoc()}})
 render(<VersionHistory projectId="proyecto-qa" currentVersion={3} onClose={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
 expect((await screen.findByRole('alert')).textContent).toContain('Comparación: Comparación no disponible')
 expect(screen.getByLabelText('Detalle de versión 2')).toBeTruthy()
 expect(screen.queryByLabelText('Cambios entre versiones')).toBeNull()
})
it('fusionar sin conflictos usa CAS y no requiere reemplazar el documento',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValue([openBranchQA]);vi.mocked(previewRestoreBranch).mockResolvedValue(previewQA)
 const close=vi.fn();render(<VersionHistory projectId="proyecto-qa" currentVersion={4} canRestore onClose={close}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}))
 expect(await screen.findByText(/No hay colisiones/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Aplicar rama como nueva versión'}))
 await waitFor(()=>expect(applyRestoreBranch).toHaveBeenCalledWith('proyecto-qa','branch-qa',4,'merge',{}))
 await waitFor(()=>expect(close).toHaveBeenCalledOnce())
 expect(restoreDocumentVersion).not.toHaveBeenCalled()
})
it('rechazar una fusión no anuncia éxito ni cierra el historial',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValue([openBranchQA]);vi.mocked(previewRestoreBranch).mockResolvedValue(previewQA)
 vi.mocked(applyRestoreBranch).mockRejectedValue('Conflicto de versión 409')
 const close=vi.fn();render(<VersionHistory projectId="proyecto-qa" currentVersion={4} canRestore onClose={close}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}))
 fireEvent.click(await screen.findByRole('button',{name:'Aplicar rama como nueva versión'}))
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Conflicto de versión 409'))
 expect(close).not.toHaveBeenCalled();expect(restoreDocumentVersion).not.toHaveBeenCalled()
 expect(screen.queryByRole('dialog',{name:'Revisar rama desde v2'})).toBeNull()
})
it('errores de vista previa y descarte no eliminan una propuesta abierta',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValue([openBranchQA]);vi.mocked(previewRestoreBranch).mockRejectedValue('Vista previa bloqueada');vi.mocked(discardRestoreBranch).mockRejectedValue('Descarte bloqueado')
 render(<VersionHistory projectId="proyecto-qa" currentVersion={4} canRestore onClose={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}))
 expect((await screen.findByRole('alert')).textContent).toContain('Vista previa bloqueada')
 fireEvent.click(screen.getByRole('button',{name:'Descartar'}))
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Descarte bloqueado'))
 expect(screen.getByRole('button',{name:'Revisar rama'})).toBeTruthy();expect(applyRestoreBranch).not.toHaveBeenCalled()
})
it('crear una rama desde el diálogo de confirmación no restaura el documento',async()=>{
 render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}))
 fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}))
 fireEvent.click(screen.getByRole('button',{name:'Preparar rama para revisar sin restaurar'}))
 await waitFor(()=>expect(createRestoreBranch).toHaveBeenCalledWith('proyecto-qa',2))
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Confirmar restauración v2'})).toBeNull())
 expect(restoreDocumentVersion).not.toHaveBeenCalled()
})

it('la creación fallida de una rama conserva la revisión y no cierra el historial',async()=>{
 vi.mocked(createRestoreBranch).mockRejectedValue(new Error('No se pudo preparar QA04'));const close=vi.fn();render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={close}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));fireEvent.click(await screen.findByRole('button',{name:'Preparar rama desde v2'}));expect((await screen.findByRole('alert')).textContent).toContain('No se pudo preparar QA04');expect(screen.getByLabelText('Detalle de versión 2')).toBeTruthy();expect(close).not.toHaveBeenCalled();expect(restoreDocumentVersion).not.toHaveBeenCalled()
})
it('cancelar vista previa por Volver o cerrar mantiene la propuesta sin fusionar',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValue([{...openBranchQA,creator_name:null,created_at:'fecha histórica'}]);vi.mocked(previewRestoreBranch).mockResolvedValue(previewQA)
 render(<VersionHistory projectId="proyecto-qa" currentVersion={4} canRestore onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}));const modal=await screen.findByRole('dialog',{name:'Revisar rama desde v2'});fireEvent.click(within(modal).getByRole('button',{name:'Volver'}));expect(screen.queryByRole('dialog',{name:'Revisar rama desde v2'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Revisar rama'}));fireEvent.click(within(await screen.findByRole('dialog',{name:'Revisar rama desde v2'})).getByRole('button',{name:'Cerrar'}));expect(screen.queryByRole('dialog',{name:'Revisar rama desde v2'})).toBeNull();expect(applyRestoreBranch).not.toHaveBeenCalled();expect(discardRestoreBranch).not.toHaveBeenCalled()
})
it('error al listar ramas no presenta una restauración como exitosa',async()=>{
 vi.mocked(listRestoreBranches).mockRejectedValue(new Error('Ramas indisponibles QA04'));render(<VersionHistory projectId="proyecto-qa" currentVersion={3} canRestore onClose={vi.fn()}/>);expect((await screen.findByRole('alert')).textContent).toContain('Ramas indisponibles QA04');expect(await screen.findByRole('button',{name:'Consultar v2'})).toBeTruthy();expect(applyRestoreBranch).not.toHaveBeenCalled()
})

it('historial maneja fecha y autor ausentes y no permite restaurar la revisión vigente',async()=>{
 const version={...recorded[0],created_at:'fecha histórica sin formato',editor_name:null};vi.mocked(listDocumentVersions).mockResolvedValue([version]);vi.mocked(loadDocumentVersion).mockResolvedValue({...version,document:emptyDoc()});render(<VersionHistory projectId="p" currentVersion={3} canRestore onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v3'}));expect(await screen.findByRole('region',{name:'Detalle de versión 3'})).toBeTruthy();expect(screen.getAllByText(/Usuario no disponible/).length).toBeGreaterThan(0);expect(screen.queryByRole('button',{name:/Restaurar v3/})).toBeNull();expect(restoreDocumentVersion).not.toHaveBeenCalled()
})
it('una consulta anterior que termina después de cerrar o cambiar proyecto no suplanta el catálogo nuevo',async()=>{
 let resolveOld!:(value:typeof recorded)=>void;vi.mocked(listDocumentVersions).mockImplementationOnce(()=>new Promise(r=>{resolveOld=r})).mockResolvedValueOnce([{...recorded[0],version:8}]);const close=vi.fn();const view=render(<VersionHistory projectId="p-old" currentVersion={3} onClose={close}/>);view.rerender(<VersionHistory projectId="p-new" currentVersion={8} onClose={close}/>);expect(await screen.findByRole('button',{name:'Consultar v8'})).toBeTruthy();await act(async()=>{resolveOld(recorded)});await waitFor(()=>expect(screen.queryByRole('button',{name:'Consultar v3'})).toBeNull());expect(screen.getByRole('button',{name:'Consultar v8'})).toBeTruthy();expect(restoreDocumentVersion).not.toHaveBeenCalled()
})

it('limita diferencias extensas a 100 registros sin cambiar la instantánea',async()=>{
 const old=emptyDoc(),fresh=emptyDoc();for(let i=0;i<105;i++){const element=createElement('Elemento QA '+i,'system');fresh.elements[element.id]=element}
 vi.mocked(loadDocumentVersion).mockImplementation(async(_id,v)=>({...recorded[v===2?1:0],document:v===2?old:fresh}));render(<VersionHistory projectId="p" currentVersion={3} onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));expect(await screen.findByText('Se muestran los primeros 100 cambios.')).toBeTruthy();expect(within(screen.getByLabelText('Cambios entre versiones')).getAllByRole('listitem')).toHaveLength(100);expect(restoreDocumentVersion).not.toHaveBeenCalled()
})
it('las propuestas cerradas no se ofrecen y una vista previa ya aplicada no se puede aplicar otra vez',async()=>{
 vi.mocked(listRestoreBranches).mockResolvedValue([{...openBranchQA,id:'closed',status:'applied'},openBranchQA]);vi.mocked(previewRestoreBranch).mockResolvedValue({...previewQA,status:'applied'});render(<VersionHistory projectId="p" currentVersion={4} canRestore onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}));const apply=await screen.findByRole('button',{name:'Aplicar rama como nueva versión'});fireEvent.click(apply);expect(screen.getAllByRole('button',{name:'Revisar rama'})).toHaveLength(1);expect(applyRestoreBranch).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Revisar rama desde v2'})).toBeTruthy()
})
it('un error no-Error durante restauración permanece visible y permite cancelar',async()=>{
 vi.mocked(restoreDocumentVersion).mockRejectedValue('Conflicto textual QA06');render(<VersionHistory projectId="p" currentVersion={3} canRestore onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}));const modal=screen.getByRole('dialog',{name:'Confirmar restauración v2'});fireEvent.change(within(modal).getByLabelText('Confirmación de versión'),{target:{value:'v2'}});fireEvent.click(within(modal).getByRole('button',{name:'Crear versión restaurada'}));expect((await within(modal).findByRole('alert')).textContent).toContain('Conflicto textual QA06');fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));expect(screen.queryByRole('dialog',{name:'Confirmar restauración v2'})).toBeNull()
})

// QA07: exercise real modal controls while requests are unresolved.
it('una fusión en curso mantiene la confirmación abierta y no duplica solicitudes',async()=>{
 let complete!:(value:{version:number;restoredFrom:number})=>void
 vi.mocked(listRestoreBranches).mockResolvedValue([openBranchQA]);vi.mocked(previewRestoreBranch).mockResolvedValue(previewQA)
 vi.mocked(applyRestoreBranch).mockImplementation(()=>new Promise(resolve=>{complete=resolve}))
 const close=vi.fn(),onRestored=vi.fn();render(<VersionHistory projectId="p" currentVersion={4} canRestore onClose={close} onRestored={onRestored}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Revisar rama'}));const modal=await screen.findByRole('dialog',{name:'Revisar rama desde v2'})
 fireEvent.click(within(modal).getByRole('button',{name:'Aplicar rama como nueva versión'}));const busy=await within(modal).findByRole('button',{name:'Aplicando…'}) as HTMLButtonElement
 expect(busy.disabled).toBe(true);expect((within(modal).getByRole('button',{name:'Volver'}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));fireEvent.click(busy);expect(applyRestoreBranch).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Revisar rama desde v2'})).toBeTruthy()
 await act(async()=>complete({version:5,restoredFrom:2}));await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(onRestored).toHaveBeenCalledWith(5)
})
it('una restauración pendiente no se puede cancelar ni repetir hasta recibir la versión del servidor',async()=>{
 let complete!:(value:{version:number;restoredFrom:number})=>void;vi.mocked(restoreDocumentVersion).mockImplementation(()=>new Promise(resolve=>{complete=resolve}))
 const close=vi.fn();render(<VersionHistory projectId="p" currentVersion={3} canRestore onClose={close}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}))
 const modal=screen.getByRole('dialog',{name:'Confirmar restauración v2'});fireEvent.change(within(modal).getByLabelText('Confirmación de versión'),{target:{value:' v2 '}});fireEvent.click(within(modal).getByRole('button',{name:'Crear versión restaurada'}));const busy=await within(modal).findByRole('button',{name:'Restaurando…'}) as HTMLButtonElement
 expect(busy.disabled).toBe(true);expect((within(modal).getByRole('button',{name:'Cancelar'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));expect(screen.getByRole('dialog',{name:'Confirmar restauración v2'})).toBeTruthy();fireEvent.click(busy);expect(restoreDocumentVersion).toHaveBeenCalledOnce()
 await act(async()=>complete({version:4,restoredFrom:2}));await waitFor(()=>expect(close).toHaveBeenCalledOnce())
})
it('errores textuales de listado, creación y comparación se presentan sin escritura histórica',async()=>{
 vi.mocked(listDocumentVersions).mockRejectedValueOnce('Historial textual QA07').mockResolvedValue(recorded)
 vi.mocked(listRestoreBranches).mockRejectedValueOnce('Ramas textuales QA07').mockResolvedValue([])
 vi.mocked(loadDocumentVersion).mockImplementation(async(_id,v)=>{if(v===3)throw 'Comparación textual QA07';return {...recorded[1],document:emptyDoc()}})
 vi.mocked(createRestoreBranch).mockRejectedValue('Creación textual QA07');const close=vi.fn();render(<VersionHistory projectId="p" currentVersion={3} canRestore onClose={close}/>);
 expect(await screen.findByText(/Historial textual QA07/)).toBeTruthy();expect(await screen.findByText(/Ramas textuales QA07/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Actualizar historial'}));fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));expect(await screen.findByText(/Comparación textual QA07/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Preparar rama desde v2'}));expect(await screen.findByText(/Creación textual QA07/)).toBeTruthy();expect(close).not.toHaveBeenCalled();expect(restoreDocumentVersion).not.toHaveBeenCalled();expect(applyRestoreBranch).not.toHaveBeenCalled()
})
it('ignora el rechazo tardío de una comparación que ya fue reemplazada',async()=>{
 let rejectOld!:(reason:Error)=>void;const doc=emptyDoc();vi.mocked(loadDocumentVersion).mockImplementation(async(_id,v)=>v===3?new Promise((_resolve,reject)=>{rejectOld=reject}):{...recorded[1],document:doc})
 render(<VersionHistory projectId="p" currentVersion={3} onClose={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));const compare=await screen.findByLabelText('Versión para comparar');await waitFor(()=>expect(loadDocumentVersion).toHaveBeenCalledWith('p',3));fireEvent.change(compare,{target:{value:'2'}});expect(await screen.findByText('0 cambios entre v2 y v2')).toBeTruthy();await act(async()=>rejectOld(new Error('Comparación antigua QA07')));expect(screen.queryByText(/Comparación antigua QA07/)).toBeNull();expect(restoreDocumentVersion).not.toHaveBeenCalled()
})
