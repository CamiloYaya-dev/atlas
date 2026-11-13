vi.mock('./capture-diagram',()=>({captureDiagramPng:vi.fn().mockResolvedValue('cG5n')}))
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import type {ReactNode} from 'react'
import {demoDocument} from '@atlas/fixtures'
import type {WorkspaceAccess} from '../security/types'
import AtlasEditor from './AtlasEditor'
import * as auth from '../security/api'
import * as workspaces from '../workspaces/api'
import * as projects from '../projects/api'
import * as audit from '../audit/api'

// The mock renders actual filtered graph nodes, while events reach the real
// AtlasEditor handlers. Only XYFlow's canvas renderer is replaced by buttons.
vi.mock('@xyflow/react',async()=>{
 const React=await import('react')
 return {
  ReactFlowProvider:({children}:{children:ReactNode})=><>{children}</>,
  ReactFlow:({nodes=[],edges=[],onNodeClick,onNodeDoubleClick,onNodeDragStop,onPaneClick,onConnect,onEdgeClick,nodesConnectable}: {
   nodes?:Array<{id:string;data:{element?:{name:string};elementId?:string}}>,
   edges?:Array<{id:string;label?:string;source:string;target:string}>,
   onNodeClick?:(e:unknown,n:unknown)=>void,
   onNodeDoubleClick?:(e:unknown,n:unknown)=>void,
   onNodeDragStop?:(e:unknown,n:unknown)=>void,
   onPaneClick?:()=>void,
   onConnect?:(c:{source:string|null;target:string|null;sourceHandle?:string;targetHandle?:string})=>void,
   onEdgeClick?:(e:unknown,edge:unknown)=>void,
   nodesConnectable?:boolean
  })=><div className="react-flow" data-testid="graph-renderer" data-relations-enabled={String(nodesConnectable)}>
   {nodes.map(n=><button type="button" key={n.id} onClick={()=>onNodeClick?.({},n)}>{n.data.element?.name||n.id}</button>)}
   {edges.length>0&&<button type="button" onClick={()=>onEdgeClick?.({},edges[0])}>Editar relación QA</button>}
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-payment-provider'})}>Conectar QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-payment-provider',sourceHandle:'top-1',targetHandle:'bottom-3'})}>Conectar puertos adicionales QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-actor'})}>Autoconexión QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-ghost',target:'n-payment-provider'})}>Conexión huérfana QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:null})}>Conexión incompleta QA</button>
   <button type="button" onClick={()=>onNodeDoubleClick?.({},nodes.find(n=>n.data.elementId==='platform')||nodes[0])}>Profundizar QA</button>
   <button type="button" onClick={()=>onNodeDragStop?.({}, {id:'n-platform',position:{x:372.4,y:183.6}})}>Mover nodo QA</button>
   <button type="button" onClick={()=>onPaneClick?.()}>Deseleccionar QA</button>
  </div>,
  useReactFlow:()=>({getNode:()=>null,fitView:async()=>true,getViewport:()=>({x:0,y:0,zoom:1})}),
  useNodesState:(initial:unknown[])=>{const [nodes,setNodes]=React.useState(initial);return[nodes,setNodes,()=>{}]},
  Background:()=>null,Controls:()=>null,MiniMap:()=>null,Handle:()=>null,
  Position:{Left:'left',Right:'right'},MarkerType:{ArrowClosed:'arrowclosed'},ConnectionMode:{Loose:'loose',Strict:'strict'}
 }
})
vi.mock('../security/api',()=>({session:vi.fn(),login:vi.fn(),logout:vi.fn(),workspaceAccess:vi.fn()}))
vi.mock('../workspaces/api',()=>({listWorkspaces:vi.fn(),createWorkspace:vi.fn(),renameWorkspace:vi.fn(),deleteWorkspace:vi.fn()}))
vi.mock('../projects/api',()=>({listProjects:vi.fn(),createProject:vi.fn(),loadDocument:vi.fn(),saveDocument:vi.fn(),exportProject:vi.fn(),workspaceLicense:vi.fn(),exportDiagramImage:vi.fn(),setWorkspaceLicense:vi.fn(),importProject:vi.fn(),listDocumentVersions:vi.fn(),loadDocumentVersion:vi.fn(),renameProject:vi.fn(),restoreDocumentVersion:vi.fn(),listRestoreBranches:vi.fn(),createRestoreBranch:vi.fn(),previewRestoreBranch:vi.fn(),applyRestoreBranch:vi.fn(),discardRestoreBranch:vi.fn(),projectAccess:vi.fn(),deleteProject:vi.fn(),projectMembers:vi.fn(),projectCandidates:vi.fn(),assignProjectMember:vi.fn(),removeProjectMember:vi.fn()}))
vi.mock('../audit/api',()=>({listAuditEvents:vi.fn()}))

const owner:WorkspaceAccess={roleId:'r-owner',roleKey:'owner',roleName:'Propietario',permissions:[]}
const reader:WorkspaceAccess={roleId:'r-reader',roleKey:'viewer',roleName:'Lector',permissions:['project.read','diagram.view.c1','element.view.actor','element.view.system','element.view.external']}
const workspace={id:'w-qa',name:'Espacio QA',role:'owner'}
const project={id:'p-qa',name:'Proyecto QA',workspace_id:'w-qa'}
const user={id:'u-qa',email:'qa@atlas.test',name:'QA',platformAdmin:true}

afterEach(()=>{vi.restoreAllMocks()})
beforeEach(()=>{
 localStorage.removeItem('atlas.navigation.collapsed')
 localStorage.removeItem('atlas.minimap.visible')
 localStorage.removeItem('atlas.tutorial.progress.v1')
 vi.resetAllMocks()
 vi.mocked(auth.session).mockResolvedValue(user)
 vi.mocked(auth.workspaceAccess).mockResolvedValue(owner)
 vi.mocked(auth.logout).mockResolvedValue(undefined)
 vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace])
 vi.mocked(projects.listProjects).mockResolvedValue([project])
 vi.mocked(projects.projectAccess).mockResolvedValue(owner)
 vi.mocked(projects.workspaceLicense).mockResolvedValue({workspaceId:'w-qa',planCode:'free',licenseActive:false,status:'free',features:{'diagram.export.png':true,'diagram.export.jpg':true,'diagram.export.clean':false,'diagram.export.advanced':false},expiresAt:null})
 vi.mocked(projects.loadDocument).mockResolvedValue({document:demoDocument(),version:1})
 vi.mocked(projects.saveDocument).mockResolvedValue(2)
 vi.mocked(projects.listDocumentVersions).mockResolvedValue([])
 vi.mocked(projects.listRestoreBranches).mockResolvedValue([])
 vi.mocked(projects.renameProject).mockResolvedValue(project)
 vi.mocked(projects.projectMembers).mockResolvedValue([])
 vi.mocked(projects.projectCandidates).mockResolvedValue({users:[],roles:[]})
 vi.mocked(audit.listAuditEvents).mockResolvedValue({items:[],nextCursor:null})
})
async function openEditor(){
 render(<AtlasEditor/>)
 await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'})
}

describe('Editor conectado a API — recorridos de comportamiento',()=>{
 it('muestra el tutorial de ATLAS desde el editor sin modificar el proyecto',async()=>{
  localStorage.removeItem('atlas.tutorial.complete.v1')
  await openEditor()
  const graph=screen.getByTestId('graph-renderer')
  fireEvent.click(screen.getByRole('button',{name:'Aprender ATLAS'}))
  expect(screen.getByRole('dialog',{name:'Bienvenido a ATLAS'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  expect(screen.getByRole('dialog',{name:'1. Organización = espacio de trabajo'})).toBeTruthy()
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  fireEvent.click(screen.getByRole('button',{name:'Cerrar tutorial'}))
  expect(screen.queryByTestId('atlas-guided-tutorial')).toBeNull()
  expect(projects.saveDocument).not.toHaveBeenCalled()
  expect(projects.importProject).not.toHaveBeenCalled()
 })
 it('tutorial permanece disponible al abrir un formulario y reanuda al cerrarlo',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Aprender ATLAS'}))
  const next=()=>fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  for(let i=0;i<6;i++)next()
  expect(screen.getByRole('dialog',{name:'6. Agrega elementos de distintos tipos'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Agregar caja'}))
  expect(screen.getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy()
  expect(screen.queryByTestId('atlas-guided-tutorial')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}))
  expect(screen.getByRole('dialog',{name:'6. Agrega elementos de distintos tipos'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })

 it('ocultar y mostrar menú lateral preserva el lienzo y el proyecto abierto',async()=>{
  await openEditor()
  const graph=screen.getByTestId('graph-renderer')
  const layout=document.querySelector('.layout')!
  expect(layout.classList.contains('expanded')).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'Ocultar menú lateral'}))
  expect(layout.classList.contains('expanded')).toBe(true)
  expect(screen.getByRole('button',{name:'Mostrar menú lateral'}).getAttribute('aria-expanded')).toBe('false')
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
  expect(localStorage.getItem('atlas.navigation.collapsed')).toBe('1')
  fireEvent.click(screen.getByRole('button',{name:'Mostrar menú lateral'}))
  expect(layout.classList.contains('expanded')).toBe(false)
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  expect(localStorage.getItem('atlas.navigation.collapsed')).toBe('0')
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('ampliar área de trabajo y restaurar distribución conservan el editor',async()=>{
  await openEditor()
  const graph=screen.getByTestId('graph-renderer')
  const layout=document.querySelector('.layout')!
  fireEvent.click(screen.getByRole('button',{name:'Ampliar área de trabajo'}))
  expect(layout.classList.contains('expanded')).toBe(true)
  expect(screen.getByRole('button',{name:'Restaurar distribución'}).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button',{name:'Mostrar menú lateral'})).toBeTruthy()
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  fireEvent.click(screen.getByRole('button',{name:'Restaurar distribución'}))
  expect(layout.classList.contains('expanded')).toBe(false)
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  expect(screen.getByRole('button',{name:'Ocultar menú lateral'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('si el área está ampliada, mostrar menú lateral recupera la distribución normal',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Ampliar área de trabajo'}))
  fireEvent.click(screen.getByRole('button',{name:'Mostrar menú lateral'}))
  expect(document.querySelector('.layout')?.classList.contains('expanded')).toBe(false)
  expect(screen.getByRole('button',{name:'Ocultar menú lateral'})).toBeTruthy()
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
 })
 it('ampliar el área oculta título y filtros, deja una restauración accesible en el lienzo',async()=>{
  await openEditor()
  const layout=document.querySelector('.layout')!
  const frame=document.querySelector('.canvas-frame')!
  const graph=screen.getByTestId('graph-renderer')
  const intro=document.querySelector('.page-intro')!
  const filters=document.querySelector('.filters-bar')!
  fireEvent.click(screen.getByRole('button',{name:'Ampliar área de trabajo'}))
  expect(layout.classList.contains('workspace-expanded')).toBe(true)
  expect(layout.contains(intro)).toBe(true) // CSS oculta sin desmontar ni destruir estado
  expect(layout.contains(filters)).toBe(true)
  expect(within(frame as HTMLElement).getByRole('button',{name:'Restaurar distribución'})).toBeTruthy()
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  fireEvent.click(within(frame as HTMLElement).getByRole('button',{name:'Restaurar distribución'}))
  expect(layout.classList.contains('workspace-expanded')).toBe(false)
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('agregar caja está junto a pantalla completa y disponible en la alternativa fullscreen',async()=>{
  await openEditor()
  const frame=document.querySelector('.canvas-frame') as HTMLElement
  const actions=within(frame).getByLabelText('Acciones del diagrama')
  expect(within(actions).getByRole('button',{name:'Agregar caja'})).toBeTruthy()
  expect(within(actions).getByRole('button',{name:'Pantalla completa del diagrama'})).toBeTruthy()
  expect(screen.getAllByRole('button',{name:'Agregar caja'})).toHaveLength(1)
  fireEvent.click(within(actions).getByRole('button',{name:'Pantalla completa del diagrama'}))
  await waitFor(()=>expect(frame.className).toContain('atlas-fullscreen-fallback'))
  fireEvent.click(within(actions).getByRole('button',{name:'Agregar caja'}))
  expect(within(frame).getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy()
  fireEvent.click(within(frame).getByRole('button',{name:'Cancelar'}))
  expect(frame.querySelector('[role="dialog"]')).toBeNull()
  fireEvent.click(within(actions).getByRole('button',{name:'Salir de pantalla completa'}))
  await waitFor(()=>expect(frame.className).not.toContain('atlas-fullscreen-fallback'))
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('agregar caja muestra su diálogo dentro del elemento fullscreen nativo',async()=>{
  await openEditor()
  const frame=document.querySelector('.canvas-frame') as HTMLElement
  Object.defineProperty(frame,'requestFullscreen',{configurable:true,value:async()=>{
   Object.defineProperty(document,'fullscreenElement',{configurable:true,value:frame})
   document.dispatchEvent(new Event('fullscreenchange'))
  }})
  try{
   fireEvent.click(within(frame).getByRole('button',{name:'Pantalla completa del diagrama'}))
   await waitFor(()=>expect(within(frame).getByRole('button',{name:'Salir de pantalla completa'})).toBeTruthy())
   fireEvent.click(within(frame).getByRole('button',{name:'Agregar caja'}))
   expect(within(frame).getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy()
   expect(projects.saveDocument).not.toHaveBeenCalled()
  }finally{
   Reflect.deleteProperty(document,'fullscreenElement')
  }
 })
 it('propietario renombra el proyecto sin modificar el documento ni reiniciar el editor',async()=>{
  const nativePrompt=vi.spyOn(window,'prompt')
  vi.mocked(projects.renameProject).mockResolvedValue({...project,name:'Proyecto renombrado QA'})
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Administrar proyecto'}))
  const panel=await screen.findByRole('dialog',{name:'Administrar proyecto: Proyecto QA'})
  fireEvent.change(within(panel).getByLabelText('Nombre del proyecto'),{target:{value:'Proyecto renombrado QA'}})
  fireEvent.click(within(panel).getByRole('button',{name:'Guardar nombre'}))
  await waitFor(()=>expect(projects.renameProject).toHaveBeenCalledWith('p-qa','Proyecto renombrado QA'))
  expect(nativePrompt).not.toHaveBeenCalled()
  await waitFor(()=>expect(screen.getByRole('button',{name:'Proyecto renombrado QA'})).toBeTruthy())
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('autorizado accede al panel de auditoría desde el editor',async()=>{
  vi.mocked(audit.listAuditEvents).mockResolvedValue({items:[{id:'1',event_type:'project.renamed',actor_name:'QA',actor_email:null,resource_id:'p-qa',resource_name:'Proyecto QA',detail:{name:'Proyecto QA'},created_at:'2026-11-12T12:00:00Z'}],nextCursor:null})
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Actividad'}))
  const activityDialog=await screen.findByRole('dialog',{name:'Actividad y auditoría'})
  // El mismo nombre también aparece en el filtro <option>; comprobar la celda
  // de auditoría, no un texto ambiguo en dos elementos del DOM.
  expect(await within(activityDialog).findByRole('cell',{name:'Proyecto renombrado'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('propietario conserva edición aunque el catálogo de permisos en sesión venga vacío',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Crear diagrama'}))
  const modal=screen.getByRole('dialog',{name:'Nuevo diagrama'})
  fireEvent.change(within(modal).getByLabelText('Nombre del diagrama'),{target:{value:'Vista QA nueva'}})
  fireEvent.change(within(modal).getByLabelText('Tipo de visualización'),{target:{value:'custom'}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  expect(screen.getByRole('heading',{name:'Vista QA nueva'})).toBeTruthy()
  await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalled(),{timeout:4500})
  const [savedId,savedDoc,version]=vi.mocked(projects.saveDocument).mock.calls.at(-1)!
  expect(savedId).toBe('p-qa')
  expect(savedDoc.diagrams.some(d=>d.name==='Vista QA nueva'&&d.type==='custom')).toBe(true)
  expect(version).toBe(1)
 })
 it('agregar caja, seleccionar nodo y editar ficha produce un cambio persistible',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Agregar caja'}))
  const modal=screen.getByRole('dialog',{name:'Agregar caja al diagrama'})
  fireEvent.change(within(modal).getByLabelText('Nombre de la caja'),{target:{value:'Actividad del piloto'}})
  fireEvent.change(within(modal).getByLabelText('Tipo de elemento'),{target:{value:'activity'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Agregar al lienzo'}))
  expect(screen.getByText('Actividad del piloto')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Resumen'),{target:{value:'Flujo funcional verificado'}})
  await waitFor(()=>{
   const calls=vi.mocked(projects.saveDocument).mock.calls
   expect(calls.length).toBeGreaterThan(0)
   expect(Object.values(calls.at(-1)![1].elements).some(e=>e.name==='Actividad del piloto'&&e.summary==='Flujo funcional verificado')).toBe(true)
  },{timeout:4500})
 })
 it('lector no obtiene controles de creación, importación o exportación',async()=>{
  vi.mocked(auth.workspaceAccess).mockResolvedValue(reader)
  vi.mocked(projects.projectAccess).mockResolvedValue(reader)
  await openEditor()
  expect(screen.queryByRole('button',{name:'Crear diagrama'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Agregar caja'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Exportar'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Importar'})).toBeNull()
  expect(screen.getByText('Lectura')).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('permiso para editar una relación no exige permiso para mover cajas',async()=>{
  vi.mocked(auth.workspaceAccess).mockResolvedValue({...reader,roleKey:'relation-editor',roleName:'Editor de relaciones',permissions:[...reader.permissions,'relation.edit.mixed']})
  vi.mocked(projects.projectAccess).mockResolvedValue({...reader,roleKey:'relation-editor',roleName:'Editor de relaciones',permissions:[...reader.permissions,'relation.edit.mixed']})
  const nativePrompt=vi.spyOn(window,'prompt')
  await openEditor()
  await waitFor(()=>expect(screen.getByRole('button',{name:'Editar relación QA'})).toBeTruthy())
  fireEvent.click(screen.getByRole('button',{name:'Editar relación QA'}))
  const relationDialog=await screen.findByRole('dialog',{name:'Configurar relación'})
  fireEvent.change(within(relationDialog).getByLabelText('Nombre o protocolo de la relación'),{target:{value:'Etiqueta actualizada'}})
  fireEvent.click(within(relationDialog).getByRole('button',{name:'Guardar relación'}))
  expect(nativePrompt).not.toHaveBeenCalled()
  await waitFor(()=>{
   const calls=vi.mocked(projects.saveDocument).mock.calls
   expect(calls.length).toBeGreaterThan(0)
   expect(calls.at(-1)![1].diagrams[0].edges[0].label).toBe('Etiqueta actualizada')
  },{timeout:4500})
 })
 it('relaciones creables por permiso propio, sin habilitar arrastre de nodos',async()=>{
  vi.mocked(auth.workspaceAccess).mockResolvedValue({...reader,roleKey:'relation-creator',roleName:'Creador de relaciones',permissions:[...reader.permissions,'relation.create.mixed']})
  vi.mocked(projects.projectAccess).mockResolvedValue({...reader,roleKey:'relation-creator',roleName:'Creador de relaciones',permissions:[...reader.permissions,'relation.create.mixed']})
  await openEditor()
  const graph=screen.getByTestId('graph-renderer')
  expect(graph.getAttribute('data-relations-enabled')).toBe('true')
  fireEvent.click(screen.getByRole('button',{name:'Conectar QA'}))
  await waitFor(()=>{
   const calls=vi.mocked(projects.saveDocument).mock.calls
   expect(calls.length).toBeGreaterThan(0)
   const edges=calls.at(-1)![1].diagrams[0].edges
   expect(edges.some(e=>e.source==='n-actor'&&e.target==='n-payment-provider')).toBe(true)
  },{timeout:4500})
 })
 it('cierre de sesión regresa al login y revoca sesión por API',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:/qa@atlas\.test/}))
  await waitFor(()=>expect(auth.logout).toHaveBeenCalledOnce())
  await screen.findByRole('heading',{name:'Iniciar sesión'})
 })

 it('renombra y describe un diagrama; los cambios se envían al servicio con la versión inicial',async()=>{
  await openEditor()
  fireEvent.change(screen.getByLabelText('Nombre del diagrama'),{target:{value:'Contexto de piloto QA'}})
  fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Mapa verificado en pruebas'}})
  await waitFor(()=>{
   const calls=vi.mocked(projects.saveDocument).mock.calls
   expect(calls.length).toBeGreaterThan(0)
   const updated=calls.at(-1)![1].diagrams.find(d=>d.id==='c1')!
   expect(updated.name).toBe('Contexto de piloto QA')
   expect(updated.description).toBe('Mapa verificado en pruebas')
  },{timeout:4500})
 })
 it('crea un proyecto usando un documento vacío y cambia al nuevo proyecto',async()=>{
  const fresh={id:'p-new',workspace_id:'w-qa',name:'Proyecto del piloto'}
  vi.mocked(projects.createProject).mockResolvedValue(fresh)
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Nuevo proyecto'}))
  const modal=screen.getByRole('dialog',{name:'Crear proyecto'})
  fireEvent.change(within(modal).getByLabelText('Nombre del proyecto'),{target:{value:fresh.name}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  await waitFor(()=>expect(projects.createProject).toHaveBeenCalledOnce())
  const [workspaceId,name,empty]=vi.mocked(projects.createProject).mock.calls[0]
  expect(workspaceId).toBe('w-qa')
  expect(name).toBe(fresh.name)
  expect(empty.diagrams).toEqual([])
  expect(empty.elements).toEqual({})
  await waitFor(()=>expect(screen.getByRole('button',{name:fresh.name})).toBeTruthy())
 })
 it('crea otro espacio de trabajo desde la interfaz administrativa',async()=>{
  const second={id:'w-new',name:'Área de innovación',role:'owner'}
  vi.mocked(workspaces.createWorkspace).mockResolvedValue(second.id)
  vi.mocked(workspaces.listWorkspaces).mockResolvedValueOnce([workspace]).mockResolvedValue([workspace,second])
  await openEditor()
  fireEvent.click(screen.getByTitle('Nuevo espacio'))
  const modal=screen.getByRole('dialog',{name:'Crear espacio de trabajo'})
  fireEvent.change(within(modal).getByLabelText('Nombre de la organización'),{target:{value:second.name}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  await waitFor(()=>expect(workspaces.createWorkspace).toHaveBeenCalledWith(second.name))
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Espacio de trabajo'}) as HTMLSelectElement).value).toBe(second.id))
 })
 it('navega a la vista C2 vinculada desde una caja de C1',async()=>{
  await openEditor()
  // El encabezado C1 puede aparecer antes de que el efecto sincronice
  // displayNodes con los nodos de React Flow. Esperar al nodo, no al título.
  const platform=await screen.findByRole('button',{name:'Plataforma Zercano'})
  fireEvent.click(platform)
  const navigate=await screen.findByRole('button',{name:/Navegar dentro de esta caja/})
  fireEvent.click(navigate)
  expect(await screen.findByRole('heading',{name:'C2 · Contenedores'})).toBeTruthy()
  expect(screen.getByRole('heading',{name:'Detalles del diagrama'})).toBeTruthy()
 })
 it('crea un campo personalizado y preserva su definición en el documento que guarda',async()=>{
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  fireEvent.change(within(modal).getByLabelText('Nombre del campo'),{target:{value:'Código de requisito QA'}})
  fireEvent.change(within(modal).getByLabelText('Aplica a'),{target:{value:'requirement'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Crear campo'}))
  await waitFor(()=>{
   const calls=vi.mocked(projects.saveDocument).mock.calls
   expect(calls.length).toBeGreaterThan(0)
   expect(calls.at(-1)![1].fieldDefinitions.some(f=>f.label==='Código de requisito QA'&&f.forType==='requirement')).toBe(true)
  },{timeout:4500})
 })
 it('permite cambiar la perspectiva sin mutar el documento ni iniciar guardado',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Funcional'}))
  expect(screen.getByRole('button',{name:'Funcional'}).className).toContain('active')
  fireEvent.click(screen.getByRole('button',{name:'Técnica'}))
  expect(screen.getByRole('button',{name:'Técnica'}).className).toContain('active')
  fireEvent.click(screen.getByRole('button',{name:'Mixta'}))
  expect(screen.getByRole('button',{name:'Mixta'}).className).toContain('active')
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('permite ver versiones anteriores sin reemplazar el documento abierto',async()=>{
  vi.mocked(projects.listDocumentVersions).mockResolvedValue([
   {version:2,created_at:'2026-11-12T12:00:00.000Z',updated_by:'u-qa',editor_name:'QA'}
  ])
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Historial · v1'}))
  expect(await screen.findByRole('button',{name:'Consultar v2'})).toBeTruthy()
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Cerrar historial'}))
  expect(screen.queryByRole('dialog',{name:'Historial de versiones'})).toBeNull()
 })
 it('detecta un error de persistencia y NO informa que el guardado finalizó',async()=>{
  vi.mocked(projects.saveDocument).mockRejectedValue(new Error('Conflicto de versión QA'))
  await openEditor()
  fireEvent.change(screen.getByLabelText('Nombre del diagrama'),{target:{value:'Versión en conflicto'}})
  await waitFor(()=>expect(screen.getByText(/Conflicto de versión QA/)).toBeTruthy(),{timeout:4500})
  expect(screen.getByText(/No se guardaron los cambios/)).toBeTruthy()
  expect(screen.getByRole('button',{name:/Recargar desde servidor/})).toBeTruthy()
 })
 it('rechaza un archivo de importación con formato incorrecto antes de enviarlo a la API',async()=>{
  await openEditor()
  const file=new File(['{"incorrecto":true}'],'malo.json',{type:'application/json'})
  Object.defineProperty(file,'text',{value:async()=>'{"incorrecto":true}'})
  const input=document.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input,{target:{files:[file]}})
  await waitFor(()=>expect(screen.getByText(/Formato JSON no compatible/)).toBeTruthy())
  expect(projects.importProject).not.toHaveBeenCalled()
 })
 it('un lector no puede editar nombre, descripción ni eliminar diagramas desde el inspector',async()=>{
  vi.mocked(auth.workspaceAccess).mockResolvedValue(reader)
  vi.mocked(projects.projectAccess).mockResolvedValue(reader)
  await openEditor()
  expect((screen.getByLabelText('Nombre del diagrama') as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).disabled).toBe(true)
  expect(screen.queryByRole('button',{name:'Eliminar diagrama'})).toBeNull()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })

 // Regresiones adicionales: se ejercitan manejadores reales del editor, no el menú de demostración.
 it('edita atributos completos de una caja existente y conserva la identidad del elemento',async()=>{
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Plataforma auditada'}})
  fireEvent.change(screen.getByLabelText('Resumen'),{target:{value:'Resumen funcional QA'}})
  fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Descripción completa QA'}})
  fireEvent.change(screen.getByLabelText('Detalle técnico'),{target:{value:'Fastify y PostgreSQL QA'}})
  fireEvent.change(screen.getByLabelText('Responsable'),{target:{value:'Equipo QA'}})
  fireEvent.change(screen.getByLabelText('Autor'),{target:{value:'Test de regresión'}})
  fireEvent.change(screen.getByLabelText('Estado'),{target:{value:'En QA'}})
  fireEvent.change(screen.getByLabelText('Creación'),{target:{value:'2026-11-10'}})
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   expect(saves.at(-1)![1].elements['platform']).toMatchObject({id:'platform',name:'Plataforma auditada',summary:'Resumen funcional QA',description:'Descripción completa QA',technical:'Fastify y PostgreSQL QA',owner:'Equipo QA',author:'Test de regresión',status:'En QA',createdAt:'2026-11-10'})
  },{timeout:4500})
 })
 it('navega por doble clic del nodo y vuelve con el menú sin alterar el documento',async()=>{
  await openEditor()
  await screen.findByRole('button',{name:'Plataforma Zercano'})
  fireEvent.click(screen.getByRole('button',{name:'Profundizar QA'}))
  expect(screen.getByRole('heading',{name:'C2 · Contenedores'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Tipo C1 C1 · Contexto de Zercano'}))
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('al pulsar el lienzo deselecciona la ficha sin perder el modelo',async()=>{
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  expect(screen.getByRole('heading',{name:'Ficha del elemento'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Deseleccionar QA'}))
  expect(screen.getByRole('heading',{name:'Detalles del diagrama'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('mover una caja cambia solamente sus coordenadas, preservando el elemento compartido',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Mover nodo QA'}))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const saved=saves.at(-1)![1]
   expect(saved.diagrams.find(d=>d.id==='c1')!.nodes.find(n=>n.id==='n-platform')).toMatchObject({x:372,y:184,elementId:'platform'})
   expect(saved.elements['platform'].id).toBe('platform')
  },{timeout:4500})
 })
 it('rechaza conexiones huérfanas, incompletas y autoconexiones antes del guardado',async()=>{
  await openEditor()
  for(const name of ['Autoconexión QA','Conexión huérfana QA','Conexión incompleta QA'])fireEvent.click(screen.getByRole('button',{name}))
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('permite relaciones paralelas a las mismas cajas, también desde puertos superiores e inferiores',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Conectar QA'}))
  fireEvent.click(screen.getByRole('button',{name:'Conectar QA'}))
  fireEvent.click(screen.getByRole('button',{name:'Conectar puertos adicionales QA'}))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const edges=saves.at(-1)![1].diagrams[0].edges.filter(e=>e.source==='n-actor'&&e.target==='n-payment-provider')
   expect(edges).toHaveLength(3)
   expect(new Set(edges.map(e=>e.id)).size).toBe(3)
   expect(edges.some(e=>e.sourceHandle==='top-1'&&e.targetHandle==='bottom-3')).toBe(true)
  },{timeout:4500})
 })
 it('el lector no puede conectar cajas aunque un evento de ReactFlow sea falsificado',async()=>{
  vi.mocked(auth.workspaceAccess).mockResolvedValue(reader)
  vi.mocked(projects.projectAccess).mockResolvedValue(reader)
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Conectar QA'}))
  expect(screen.getByText(/No tienes permiso para crear esta relación/)).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('el lector no puede mover cajas aun si se emite un evento de arrastre',async()=>{
  vi.mocked(auth.workspaceAccess).mockResolvedValue(reader)
  vi.mocked(projects.projectAccess).mockResolvedValue(reader)
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Mover nodo QA'}))
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('oculta y restaura el inspector y permite expandir el lienzo sin guardar cambios',async()=>{
  await openEditor()
  fireEvent.click(screen.getByTitle('Mostrar / ocultar inspector'))
  expect(screen.queryByRole('heading',{name:'Detalles del diagrama'})).toBeNull()
  fireEvent.click(screen.getByTitle('Mostrar / ocultar inspector'))
  expect(screen.getByRole('heading',{name:'Detalles del diagrama'})).toBeTruthy()
  const app=document.querySelector('.layout')!
  fireEvent.click(screen.getByTitle('Ampliar área de trabajo'))
  expect(app.className).toContain('expanded')
  fireEvent.click(screen.getByTitle('Restaurar distribución'))
  expect(app.className).not.toContain('expanded')
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('pantalla completa usa alternativa local si el navegador bloquea la API',async()=>{
  await openEditor()
  const frame=document.querySelector('.canvas-frame')!
  fireEvent.click(screen.getAllByRole('button',{name:'Pantalla completa del diagrama'})[0])
  await waitFor(()=>expect(frame.className).toContain('atlas-fullscreen-fallback'))
  fireEvent.click(screen.getByRole('button',{name:'Salir de pantalla completa'}))
  await waitFor(()=>expect(frame.className).not.toContain('atlas-fullscreen-fallback'))
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('colapsa navegación y alterna minimapa sin guardar cambios',async()=>{
  await openEditor()
  const shell=document.querySelector('.layout')!
  fireEvent.click(screen.getByRole('button',{name:'Ocultar menú lateral'}))
  expect(shell.className).toContain('expanded')
  fireEvent.click(screen.getByRole('button',{name:'Mostrar menú lateral'}))
  expect(shell.className).not.toContain('expanded')
  fireEvent.click(screen.getByRole('button',{name:'Ocultar minimapa'}))
  expect(screen.getByRole('button',{name:'Mostrar minimapa'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Mostrar minimapa'}))
  expect(screen.getByRole('button',{name:'Ocultar minimapa'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('confirma el borrado de un diagrama sin borrar sus elementos reutilizables',async()=>{
  const nativeConfirm=vi.spyOn(window,'confirm')
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Eliminar diagrama'}))
  const confirmation=await screen.findByRole('dialog',{name:'Eliminar diagrama'})
  expect(projects.saveDocument).not.toHaveBeenCalled()
  fireEvent.click(within(confirmation).getByRole('button',{name:'Eliminar diagrama'}))
  expect(nativeConfirm).not.toHaveBeenCalled()
  expect(await screen.findByRole('heading',{name:'C2 · Contenedores'})).toBeTruthy()
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const document=saves.at(-1)![1]
   expect(document.diagrams.some(d=>d.id==='c1')).toBe(false)
   expect(document.elements['platform'].id).toBe('platform')
  },{timeout:4500})
 })
 it('cancelar borrado de un diagrama y de una caja preserva datos',async()=>{
  const nativeConfirm=vi.spyOn(window,'confirm')
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Eliminar diagrama'}))
  let confirmation=await screen.findByRole('dialog',{name:'Eliminar diagrama'})
  fireEvent.click(within(confirmation).getByRole('button',{name:'Cancelar'}))
  expect(screen.queryByRole('dialog',{name:'Eliminar diagrama'})).toBeNull()
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:'Quitar caja de esta vista'}))
  confirmation=await screen.findByRole('dialog',{name:'Quitar caja de la vista'})
  fireEvent.click(within(confirmation).getByRole('button',{name:'Cancelar'}))
  expect(screen.getByRole('button',{name:'Plataforma Zercano'})).toBeTruthy()
  expect(nativeConfirm).not.toHaveBeenCalled()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('quitar una caja de la vista no elimina el elemento del catálogo global',async()=>{
  const nativeConfirm=vi.spyOn(window,'confirm')
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:'Quitar caja de esta vista'}))
  const confirmation=await screen.findByRole('dialog',{name:'Quitar caja de la vista'})
  fireEvent.click(within(confirmation).getByRole('button',{name:'Quitar caja'}))
  expect(nativeConfirm).not.toHaveBeenCalled()
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const document=saves.at(-1)![1]
   expect(document.elements['platform']).toBeTruthy()
   expect(document.diagrams[0].nodes.some(n=>n.elementId==='platform')).toBe(false)
   expect(document.diagrams[0].edges.some(e=>e.source==='n-platform'||e.target==='n-platform')).toBe(false)
  },{timeout:4500})
 })
 it('reutiliza un elemento existente en otra vista sin crear una copia en el catálogo',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Agregar caja'}))
  const dialog=screen.getByRole('dialog',{name:'Agregar caja al diagrama'})
  fireEvent.click(within(dialog).getByRole('button',{name:'Reutilizar existente'}))
  fireEvent.change(within(dialog).getByLabelText('Buscar elemento del proyecto'),{target:{value:'Aplicación web'}})
  fireEvent.click(within(dialog).getByRole('button',{name:/Aplicación web/}))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const document=saves.at(-1)![1]
   expect(document.diagrams[0].nodes.some(n=>n.elementId==='app-web')).toBe(true)
   expect(Object.keys(document.elements)).toHaveLength(Object.keys(demoDocument().elements).length)
  },{timeout:4500})
 })
 it('agrega un enlace HTTPS validado a un elemento y permite retirarlo',async()=>{
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:/^Agregar$/}))
  const modal=screen.getByRole('dialog',{name:'Agregar enlace externo'})
  fireEvent.change(within(modal).getByLabelText('Etiqueta del enlace'),{target:{value:'Documento de arquitectura'}})
  fireEvent.change(within(modal).getByLabelText('URL HTTPS'),{target:{value:'https://example.com/arquitectura'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Agregar enlace'}))
  expect(screen.getByText('Documento de arquitectura')).toBeTruthy()
  fireEvent.click(screen.getByTitle('Quitar enlace'))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   expect(saves.at(-1)![1].elements['platform'].links).toEqual([])
  },{timeout:4500})
 })
 it('rechaza enlaces JavaScript para evitar ejecución en ventanas externas',async()=>{
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:/^Agregar$/}))
  const modal=screen.getByRole('dialog',{name:'Agregar enlace externo'})
  fireEvent.change(within(modal).getByLabelText('Etiqueta del enlace'),{target:{value:'Enlace inseguro'}})
  fireEvent.change(within(modal).getByLabelText('URL HTTPS'),{target:{value:'javascript:alert(1)'}})
  expect(within(modal).getByRole('button',{name:'Agregar enlace'})).toHaveProperty('disabled',true)
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('conserva campos y valores de lista al editar un requerimiento compartido',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Tipo TRACE Trazabilidad · Pago'}))
  fireEvent.click(await screen.findByRole('button',{name:'HU-021 · Confirmar pago'}))
  fireEvent.change(screen.getByLabelText('Prioridad'),{target:{value:'Crítica'}})
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   expect(saves.at(-1)![1].elements['hu-pay'].fields['f-priority']).toBe('Crítica')
  },{timeout:4500})
 })
 it('registra campos booleanos y permite editarlos dentro de una ficha',async()=>{
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  fireEvent.change(within(modal).getByLabelText('Nombre del campo'),{target:{value:'Aprobado para piloto'}})
  fireEvent.change(within(modal).getByLabelText('Tipo de dato'),{target:{value:'boolean'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Crear campo'}))
  fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}))
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  const field=document.querySelector<HTMLInputElement>('.inspector .switch-field input[type="checkbox"]')
  expect(field).not.toBeNull()
  fireEvent.click(field!)
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const doc=saves.at(-1)![1]
   const fieldId=doc.fieldDefinitions.find(f=>f.label==='Aprobado para piloto')!.id
   expect(doc.elements['platform'].fields[fieldId]).toBe(true)
  },{timeout:4500})
 })
 it('elimina una definición de campo solo tras confirmación, sin borrar fichas',async()=>{
  const nativeConfirm=vi.spyOn(window,'confirm')
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  const oldCount=demoDocument().fieldDefinitions.length
  fireEvent.click(within(modal).getAllByTitle('Eliminar campo')[0])
  const confirmation=await screen.findByRole('dialog',{name:'Eliminar campo personalizado'})
  expect(projects.saveDocument).not.toHaveBeenCalled()
  fireEvent.click(within(confirmation).getByRole('button',{name:'Eliminar campo'}))
  expect(nativeConfirm).not.toHaveBeenCalled()
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const doc=saves.at(-1)![1]
   expect(doc.fieldDefinitions).toHaveLength(oldCount-1)
   expect(doc.elements['hu-pay']).toBeTruthy()
  },{timeout:4500})
 })
 it('valida las credenciales en login privado y muestra errores sin abrir registro público',async()=>{
  vi.mocked(auth.session).mockRejectedValue(new Error('No autenticado'))
  vi.mocked(auth.login).mockRejectedValue(new Error('Credenciales inválidas'))
  render(<AtlasEditor/>)
  await screen.findByRole('heading',{name:'Iniciar sesión'})
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@atlas.test'}})
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'Credencial-de-prueba-2026'}})
  fireEvent.click(screen.getByRole('button',{name:'Entrar a ATLAS'}))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Credenciales inválidas')
  expect(screen.queryByText('Crear cuenta')).toBeNull()
 })
 it('una sesión inexistente abre login y un login exitoso carga proyectos autorizados',async()=>{
  vi.mocked(auth.session).mockRejectedValue(new Error('No autenticado'))
  vi.mocked(auth.login).mockResolvedValue(user)
  render(<AtlasEditor/>)
  await screen.findByRole('heading',{name:'Iniciar sesión'})
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@atlas.test'}})
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'Contraseña-muy-segura'}})
  fireEvent.click(screen.getByRole('button',{name:'Entrar a ATLAS'}))
  await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'})
  expect(auth.login).toHaveBeenCalledWith('qa@atlas.test','Contraseña-muy-segura')
  expect(screen.getByText('qa@atlas.test')).toBeTruthy()
 })
 it('una instalación sin diagramas permite crear el primero conservando el documento vacío',async()=>{
  const initial={...demoDocument(),diagrams:[]}
  vi.mocked(projects.loadDocument).mockResolvedValue({document:initial,version:1})
  render(<AtlasEditor/>)
  await screen.findByText('No hay diagramas todavía')
  fireEvent.click(screen.getByRole('button',{name:'Crear mi primer diagrama'}))
  const dialog=screen.getByRole('dialog',{name:'Nuevo diagrama'})
  fireEvent.change(within(dialog).getByLabelText('Nombre del diagrama'),{target:{value:'Mi primer contexto'}})
  fireEvent.click(within(dialog).getByRole('button',{name:/^Crear$/}))
  expect(screen.getByRole('heading',{name:'Mi primer contexto'})).toBeTruthy()
 })
 it('la API rechazada durante creación de proyecto genera aviso sin cambiar de proyecto',async()=>{
  vi.mocked(projects.createProject).mockRejectedValue(new Error('No se pudo crear proyecto'))
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Nuevo proyecto'}))
  const modal=screen.getByRole('dialog',{name:'Crear proyecto'})
  fireEvent.change(within(modal).getByLabelText('Nombre del proyecto'),{target:{value:'Intento de proyecto'}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  expect(await screen.findByText(/No se pudo crear proyecto/)).toBeTruthy()
  expect(screen.getByRole('button',{name:'Proyecto QA'})).toBeTruthy()
 })
 it('la API rechazada durante creación de espacio no altera la membresía actual',async()=>{
  vi.mocked(workspaces.createWorkspace).mockRejectedValue(new Error('Sin acceso para crear espacios'))
  await openEditor()
  fireEvent.click(screen.getByTitle('Nuevo espacio'))
  const modal=screen.getByRole('dialog',{name:'Crear espacio de trabajo'})
  fireEvent.change(within(modal).getByLabelText('Nombre de la organización'),{target:{value:'Área no autorizada'}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  expect(await screen.findByText(/Sin acceso para crear espacios/)).toBeTruthy()
  expect((screen.getByRole('combobox',{name:'Espacio de trabajo'}) as HTMLSelectElement).value).toBe('w-qa')
 })
 it('permite seleccionar PNG/JPG e informa la marca de agua que decide la API',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Exportar'}))
  const modal=screen.getByRole('dialog',{name:'Exportar desde ATLAS'})
  expect(await within(modal).findByText(/Sin licencia comercial: imagen con marca de agua/)).toBeTruthy()
  fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:'jpg'}})
  expect(within(modal).getByRole('button',{name:'Descargar JPG'})).toBeTruthy()
  expect(projects.exportDiagramImage).not.toHaveBeenCalled()
 })
 it('informa un fallo de exportación sin perder el documento local',async()=>{
  vi.mocked(projects.exportProject).mockRejectedValue(new Error('Exportación bloqueada'))
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Exportar'}))
  const modal=screen.getByRole('dialog',{name:'Exportar desde ATLAS'})
  fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:'json'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Descargar JSON'}))
  expect(await screen.findByText(/Exportación: Exportación bloqueada/)).toBeTruthy()
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
 })
 it('recorre y persiste los siete tipos de campos configurables de un elemento',async()=>{
  const model=demoDocument()
  model.fieldDefinitions.push(
   {id:'qa-text',label:'Texto QA',forType:'all',kind:'text'},
   {id:'qa-long',label:'Largo QA',forType:'all',kind:'textarea'},
   {id:'qa-link',label:'URL QA',forType:'all',kind:'url'},
   {id:'qa-date',label:'Fecha QA',forType:'all',kind:'date'},
   {id:'qa-num',label:'Número QA',forType:'all',kind:'number'},
   {id:'qa-choice',label:'Lista QA',forType:'all',kind:'select',options:['Pendiente','Aprobado']},
   {id:'qa-bool',label:'Booleano QA',forType:'all',kind:'boolean'}
  )
  vi.mocked(projects.loadDocument).mockResolvedValue({document:model,version:1})
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  for(const [label,value] of [
   ['Texto QA','Datos verificados'],['Largo QA','Descripción funcional ampliada'],
   ['URL QA','https://atlas.example/qa'],['Fecha QA','2026-11-11'],
   ['Número QA','7'],['Lista QA','Aprobado']
  ])fireEvent.change(screen.getByLabelText(label),{target:{value}})
  const checkbox=document.querySelector<HTMLInputElement>('.inspector .switch-field input[type="checkbox"]')
  expect(checkbox).not.toBeNull()
  fireEvent.click(checkbox!)
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const fields=saves.at(-1)![1].elements['platform'].fields
   expect(fields).toMatchObject({'qa-text':'Datos verificados','qa-long':'Descripción funcional ampliada','qa-link':'https://atlas.example/qa','qa-date':'2026-11-11','qa-num':'7','qa-choice':'Aprobado','qa-bool':true})
  },{timeout:4500})
 })
 it('oculta el campo técnico a un rol funcional, incluso si puede editar metadatos',async()=>{
  const functional:WorkspaceAccess={roleId:'r-functional',roleKey:'functional',roleName:'Funcional QA',permissions:['project.read','diagram.view.c1','element.view.system','element.edit.system','diagram.edit.c1']}
  vi.mocked(auth.workspaceAccess).mockResolvedValue(functional)
  vi.mocked(projects.projectAccess).mockResolvedValue(functional)
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  expect(screen.queryByLabelText('Detalle técnico')).toBeNull()
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).disabled).toBe(false)
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('puede mostrar detalle técnico sin autorizar modificarlo',async()=>{
  const limited:WorkspaceAccess={roleId:'r-technical-read',roleKey:'technical-read',roleName:'Revisor técnico QA',permissions:['project.read','diagram.view.c1','element.view.system','element.edit.system','element.technical.view']}
  vi.mocked(auth.workspaceAccess).mockResolvedValue(limited)
  vi.mocked(projects.projectAccess).mockResolvedValue(limited)
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  expect((screen.getByLabelText('Detalle técnico') as HTMLTextAreaElement).disabled).toBe(true)
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).disabled).toBe(false)
 })
 it('un usuario sin espacios ve los primeros pasos sin acceder a proyectos ajenos',async()=>{
  vi.mocked(workspaces.listWorkspaces).mockResolvedValue([])
  render(<AtlasEditor/>)
  await screen.findByRole('heading',{name:'Crea tu primer espacio'})
  expect(screen.queryByRole('button',{name:'Proyecto QA'})).toBeNull()
  expect(projects.loadDocument).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Crear espacio'})).toBeTruthy()
 })
 it('un workspace sin proyectos permite crear su primero sin mostrar datos ficticios',async()=>{
  vi.mocked(projects.listProjects).mockResolvedValue([])
  render(<AtlasEditor/>)
  await screen.findByRole('heading',{name:'Crea tu primer proyecto'})
  expect(screen.queryByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeNull()
  expect(screen.getByRole('button',{name:'Crear proyecto'})).toBeTruthy()
 })
 it('cuando la API de proyectos falla se informa el error y no se inventa una vista',async()=>{
  vi.mocked(projects.listProjects).mockRejectedValue(new Error('Conexión rechazada al listar proyectos'))
  render(<AtlasEditor/>)
  await screen.findByText(/Conexión rechazada al listar proyectos/)
  expect(projects.loadDocument).not.toHaveBeenCalled()
 })
 it('los filtros de procesos permiten ocultar y recuperar grupos sin escribir en PostgreSQL',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Tipo PROCESS Proceso · Autenticación y pagos'}))
  expect(screen.getByRole('heading',{name:'Proceso · Autenticación y pagos'})).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Dependencias'))
  const graph=screen.getByTestId('graph-renderer')
  const initial=graph.querySelectorAll('button').length
  const payments=screen.getByLabelText('Pagos') as HTMLInputElement
  fireEvent.click(payments)
  expect(payments.checked).toBe(false)
  expect(graph.querySelectorAll('button').length).toBeLessThan(initial)
  fireEvent.click(payments)
  expect(payments.checked).toBe(true)
  expect(graph.querySelectorAll('button')).toHaveLength(initial)
  fireEvent.click(screen.getByLabelText('Dependencias'))
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('crear un campo de selección conserva sus alternativas filtradas',async()=>{
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  fireEvent.change(within(modal).getByLabelText('Nombre del campo'),{target:{value:'Estado de pruebas QA'}})
  fireEvent.change(within(modal).getByLabelText('Tipo de dato'),{target:{value:'select'}})
  fireEvent.change(within(modal).getByLabelText('Opciones separadas por coma'),{target:{value:'Abierto, , En QA, Cerrado'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Crear campo'}))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   expect(saves.at(-1)![1].fieldDefinitions.find(f=>f.label==='Estado de pruebas QA')?.options).toEqual(['Abierto','En QA','Cerrado'])
  },{timeout:4500})
 })
 it('cancelar la eliminación de un campo no altera las definiciones del proyecto',async()=>{
  const nativeConfirm=vi.spyOn(window,'confirm')
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  fireEvent.click(within(modal).getAllByTitle('Eliminar campo')[0])
  const confirmation=await screen.findByRole('dialog',{name:'Eliminar campo personalizado'})
  fireEvent.click(within(confirmation).getByRole('button',{name:'Cancelar'}))
  expect(screen.queryByRole('dialog',{name:'Eliminar campo personalizado'})).toBeNull()
  expect(within(modal).getAllByTitle('Eliminar campo')).toHaveLength(demoDocument().fieldDefinitions.length)
  expect(projects.saveDocument).not.toHaveBeenCalled()
  expect(nativeConfirm).not.toHaveBeenCalled()
 })
 it('la importación validada usa la versión actual y recarga el documento autorizado',async()=>{
  const fixture=demoDocument()
  vi.mocked(projects.importProject).mockResolvedValue(5)
  await openEditor()
  const file=new File([JSON.stringify({document:fixture})],'modelo-atlas.json',{type:'application/json'})
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify({document:fixture})})
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!,{target:{files:[file]}})
  const modal=await screen.findByRole('dialog',{name:'Confirmar importación'})
  fireEvent.click(within(modal).getByRole('button',{name:'Importar documento'}))
  await waitFor(()=>expect(projects.importProject).toHaveBeenCalledWith('p-qa',expect.objectContaining({schema:1}),1))
  await waitFor(()=>expect(screen.getByText(/Importación validada y guardada/)).toBeTruthy())
  expect(projects.loadDocument).toHaveBeenCalledTimes(2)
 })
 it('cancelar una importación autorizada evita escribir sobre el documento',async()=>{
  await openEditor()
  const file=new File([JSON.stringify(demoDocument())],'modelo.json',{type:'application/json'})
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify(demoDocument())})
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!,{target:{files:[file]}})
  const modal=await screen.findByRole('dialog',{name:'Confirmar importación'})
  fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}))
  expect(projects.importProject).not.toHaveBeenCalled()
 })
 it('bloquea el cambio de espacio cuando hay cambios locales sin guardar',async()=>{
  const other={id:'w-other',name:'Otro espacio QA',role:'owner'}
  vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace,other])
  await openEditor()
  fireEvent.change(screen.getByLabelText('Nombre del diagrama'),{target:{value:'Cambios no guardados todavía'}})
  const select=screen.getByRole('combobox',{name:'Espacio de trabajo'}) as HTMLSelectElement
  fireEvent.change(select,{target:{value:'w-other'}})
  expect(select.value).toBe('w-qa')
  expect(screen.getByText(/Primero espera a que se guarden los cambios/)).toBeTruthy()
 })

})
