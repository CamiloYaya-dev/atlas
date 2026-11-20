vi.mock('./capture-diagram',()=>({captureDiagramPng:vi.fn()}))
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import type {ReactNode} from 'react'
import {demoDocument} from '@novzi/fixtures'
import {createElement,emptyDoc} from '@novzi/contracts'
import type {Diagram,ElementType,ProjectDocument} from '@novzi/contracts'
import type {WorkspaceAccess} from '../security/types'
import NovziEditor from './NovziEditor'
import {useReactFlow} from '@xyflow/react'
import {captureDiagramPng} from './capture-diagram'
import * as auth from '../security/api'
import * as workspaces from '../workspaces/api'
import * as organizations from '../organizations/api'
import * as projects from '../projects/api'
import * as audit from '../audit/api'

// The mock renders actual filtered graph nodes, while events reach the real
// NovziEditor handlers. Only XYFlow's canvas renderer is replaced by buttons.
vi.mock('@xyflow/react',async()=>{
 const React=await import('react')
 return {
  ReactFlowProvider:({children}:{children:ReactNode})=><>{children}</>,
  ReactFlow:({nodes=[],edges=[],onNodeClick,onNodeDoubleClick,onNodeDragStop,onPaneClick,onConnect,onEdgeClick,nodesConnectable,onSelectionChange,selectionOnDrag}: {
   nodes?:Array<{id:string;data:{element?:{name:string};elementId?:string;onResize?:(id:string,w:number,h:number,x?:number,y?:number)=>void}}>,
   edges?:Array<{id:string;label?:string;source:string;target:string}>,
   onNodeClick?:(e:unknown,n:unknown)=>void,
   onNodeDoubleClick?:(e:unknown,n:unknown)=>void,
   onNodeDragStop?:(e:unknown,n:unknown,draggedNodes?:unknown[])=>void,
   onPaneClick?:()=>void,
   onConnect?:(c:{source:string|null;target:string|null;sourceHandle?:string;targetHandle?:string})=>void,
   onEdgeClick?:(e:unknown,edge:unknown)=>void,
   nodesConnectable?:boolean
   selectionOnDrag?:boolean
   onSelectionChange?:(value:{nodes:unknown[];edges:unknown[]})=>void
  })=><div className="react-flow" data-testid="graph-renderer" data-relations-enabled={String(nodesConnectable)}>
   {nodes.map(n=><button type="button" key={n.id} onClick={()=>onNodeClick?.({},n)}>{n.data.element?.name||n.id}</button>)}
   {nodes.some(n=>n.id==='qa10-source')&&nodes.some(n=>n.id==='qa10-target')&&<><button type="button" onClick={()=>onConnect?.({source:'qa10-source',target:'qa10-target',sourceHandle:'right',targetHandle:'left'})}>Conectar extremos QA10</button><button type="button" onClick={()=>onConnect?.({source:'qa10-source',target:'qa10-target',sourceHandle:'right',targetHandle:'top'})}>Conexión destino vertical QA10</button></>}
   {nodes.some(n=>n.id==='qa10-child')&&<button type="button" onClick={()=>onNodeDragStop?.({}, {id:'qa10-child',parentId:'qa10-parent',position:{x:40,y:180}})}>Mover acoplado QA10</button>}
   {selectionOnDrag&&nodes.length>=2&&<button type="button" onClick={()=>onSelectionChange?.({nodes:[],edges:[]})}>Limpiar selección QA10</button>}
   {nodes.some(n=>n.id==='qa09-resize')&&<><button type="button" onClick={()=>nodes.find(n=>n.id==='qa09-resize')?.data.onResize?.('qa09-resize',12,20)}>Redimensionar inválido QA09</button><button type="button" onClick={()=>nodes.find(n=>n.id==='qa09-resize')?.data.onResize?.('qa09-resize',360,220,40,60)}>Redimensionar válido QA09</button></>}
   {selectionOnDrag&&nodes.length>=2&&<button type="button" onClick={()=>onSelectionChange?.({nodes:nodes.slice(0,2),edges:[]})}>Seleccionar dos QA</button>}
   {selectionOnDrag&&nodes.length>=2&&<button type="button" onClick={()=>{const moved=nodes.slice(0,2).map((n,i)=>({id:n.id,position:{x:450+i*220,y:290+i*60}}));onNodeDragStop?.({},moved[0],moved)}}>Mover dos cajas QA08</button>}
   {selectionOnDrag&&edges.length>0&&<button type="button" onClick={()=>onSelectionChange?.({nodes:[],edges:[edges[0]]})}>Seleccionar relación QA08</button>}
   {nodes.some(n=>n.id==='qa08-child')&&<button type="button" onClick={()=>onNodeDragStop?.({}, {id:'qa08-child',position:{x:100,y:100}})}>Arrastrar a contenedor QA08</button>}
   {nodes.some(n=>n.id==='qa08-invalid-a')&&<button type="button" onClick={()=>onConnect?.({source:'qa08-invalid-a',target:'qa08-invalid-b'})}>Conectar UML incompatible QA08</button>}

   {nodes.some(n=>n.id==='qa-aa')&&<><button type="button" onClick={()=>onConnect?.({source:'qa-aa',target:'qa-bb',sourceHandle:'seq-right-1',targetHandle:'seq-left-1'})}>Mensaje QA 1</button><button type="button" onClick={()=>onConnect?.({source:'qa-bb',target:'qa-aa',sourceHandle:'seq-left-3',targetHandle:'seq-right-3'})}>Mensaje QA 2</button><button type="button" onClick={()=>onConnect?.({source:'qa-aa',target:'qa-bb',sourceHandle:'top-2',targetHandle:'seq-left-1'})}>Mensaje vertical QA</button></>}
   {edges.length>0&&<button type="button" data-edge-id={edges[0].id} onClick={()=>onEdgeClick?.({},edges[0])}>Editar relación QA</button>}
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-payment-provider'})}>Conectar QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-payment-provider',sourceHandle:'top-1',targetHandle:'bottom-3'})}>Conectar puertos adicionales QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-actor'})}>Autoconexión QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-ghost',target:'n-payment-provider'})}>Conexión huérfana QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:null})}>Conexión incompleta QA</button>
   <button type="button" onClick={()=>onNodeDoubleClick?.({},nodes.find(n=>n.data.elementId==='platform')||nodes[0])}>Profundizar QA</button>
   <button type="button" onClick={()=>onNodeDragStop?.({}, {id:'n-platform',position:{x:372.4,y:183.6}})}>Mover nodo QA</button>
   <button type="button" onClick={()=>onPaneClick?.()}>Deseleccionar QA</button>
  </div>,
  useReactFlow:vi.fn(()=>({getNode:()=>null,fitView:async()=>true,getViewport:()=>({x:0,y:0,zoom:1})})),
  useNodesState:(initial:unknown[])=>{const [nodes,setNodes]=React.useState(initial);return[nodes,setNodes,()=>{}]},
  useEdgesState:(initial:unknown[])=>{const [edges,setEdges]=React.useState(initial);return[edges,setEdges,()=>{}]},
  Background:()=>null,Controls:()=>null,MiniMap:()=>null,Handle:()=>null,
  NodeResizer:()=>null,Position:{Left:'left',Right:'right'},MarkerType:{ArrowClosed:'arrowclosed'},ConnectionMode:{Loose:'loose',Strict:'strict'}
 }
})
vi.mock('../security/api',()=>({session:vi.fn(),login:vi.fn(),logout:vi.fn(),workspaceAccess:vi.fn(),workspaceRoles:vi.fn(),workspaceMembers:vi.fn(),usersList:vi.fn()}))
vi.mock('../organizations/api',()=>({listOrganizations:vi.fn(),createOrganization:vi.fn(),createOrganizationWorkspace:vi.fn(),organizationMembers:vi.fn(),myOrganizationInvitations:vi.fn(),listOrganizationInvitations:vi.fn(),cancelOrganizationInvitation:vi.fn(),inviteToOrganization:vi.fn(),acceptOrganizationInvitation:vi.fn(),declineOrganizationInvitation:vi.fn(),createOrganizationUser:vi.fn(),updateOrganizationMember:vi.fn(),removeOrganizationMember:vi.fn(),organizationAccessTree:vi.fn(),organizationMemberGrants:vi.fn(),assignOrganizationGrants:vi.fn(),removeOrganizationGrant:vi.fn(),organizationRoles:vi.fn(),organizationCreateRole:vi.fn(),organizationUpdateRole:vi.fn()}))
vi.mock('../workspaces/api',()=>({listWorkspaces:vi.fn(),createWorkspace:vi.fn(),renameWorkspace:vi.fn(),deleteWorkspace:vi.fn()}))
vi.mock('../projects/api',()=>({listProjects:vi.fn(),createProject:vi.fn(),loadDocument:vi.fn(),loadProjectVersion:vi.fn(),saveDocument:vi.fn(),exportProject:vi.fn(),sendPresence:vi.fn(),workspaceLicense:vi.fn(),exportDiagramImage:vi.fn(),setWorkspaceLicense:vi.fn(),importProject:vi.fn(),listDocumentVersions:vi.fn(),loadDocumentVersion:vi.fn(),renameProject:vi.fn(),restoreDocumentVersion:vi.fn(),listRestoreBranches:vi.fn(),createRestoreBranch:vi.fn(),previewRestoreBranch:vi.fn(),applyRestoreBranch:vi.fn(),discardRestoreBranch:vi.fn(),projectAccess:vi.fn(),deleteProject:vi.fn(),projectMembers:vi.fn(),projectCandidates:vi.fn(),assignProjectMember:vi.fn(),removeProjectMember:vi.fn()}))
vi.mock('../audit/api',()=>({listAuditEvents:vi.fn()}))

const owner:WorkspaceAccess={roleId:'r-owner',roleKey:'owner',roleName:'Propietario',permissions:[]}
const reader:WorkspaceAccess={roleId:'r-reader',roleKey:'viewer',roleName:'Lector',permissions:['project.read','diagram.view.c1','element.view.actor','element.view.system','element.view.external']}
const organization={id:'o-qa',name:'Zercano',role:'owner' as const,created_by:'u-qa',workspace_count:1}
const workspace={id:'w-qa',name:'Espacio QA',role:'owner',organization_id:'o-qa'}
const project={id:'p-qa',name:'Proyecto QA',workspace_id:'w-qa'}
const user={id:'u-qa',email:'qa@novzi.test',name:'QA',platformAdmin:true}

afterEach(()=>{vi.restoreAllMocks()})
beforeEach(()=>{
 localStorage.removeItem('novzi.navigation.collapsed')
 localStorage.removeItem('novzi.minimap.visible')
 localStorage.removeItem('novzi.tutorial.progress.v1')
 vi.resetAllMocks()
 vi.mocked(useReactFlow).mockImplementation(()=>({getNode:()=>undefined,fitView:async()=>true,getViewport:()=>({x:0,y:0,zoom:1})} as unknown as ReturnType<typeof useReactFlow>))
 vi.mocked(auth.workspaceRoles).mockResolvedValue([])
 vi.mocked(auth.workspaceMembers).mockResolvedValue([])
 vi.mocked(auth.usersList).mockResolvedValue([])
 // resetAllMocks elimina las implementaciones configuradas: restablecer la captura para cada caso.
 vi.mocked(captureDiagramPng).mockResolvedValue('cG5n')
 vi.mocked(auth.session).mockResolvedValue(user)
 vi.mocked(auth.workspaceAccess).mockResolvedValue(owner)
 vi.mocked(auth.logout).mockResolvedValue(undefined)
 vi.mocked(organizations.listOrganizations).mockResolvedValue([organization])
 vi.mocked(organizations.organizationMembers).mockResolvedValue([])
 vi.mocked(organizations.organizationAccessTree).mockResolvedValue([])
 vi.mocked(organizations.organizationMemberGrants).mockResolvedValue({workspaces:[],projects:[]})
 vi.mocked(organizations.myOrganizationInvitations).mockResolvedValue([])
 vi.mocked(organizations.listOrganizationInvitations).mockResolvedValue([])
 vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace])
 vi.mocked(projects.listProjects).mockResolvedValue([project])
 vi.mocked(projects.projectAccess).mockResolvedValue(owner)
 vi.mocked(projects.workspaceLicense).mockResolvedValue({workspaceId:'w-qa',planCode:'free',licenseActive:false,status:'free',features:{'diagram.export.png':true,'diagram.export.jpg':true,'diagram.export.clean':false,'diagram.export.advanced':false},expiresAt:null})
 vi.mocked(projects.loadDocument).mockResolvedValue({document:demoDocument(),version:1})
 vi.mocked(projects.saveDocument).mockResolvedValue(2)
 vi.mocked(projects.sendPresence).mockResolvedValue({ok:true})
 vi.mocked(projects.listDocumentVersions).mockResolvedValue([])
 vi.mocked(projects.listRestoreBranches).mockResolvedValue([])
 vi.mocked(projects.renameProject).mockResolvedValue(project)
 vi.mocked(projects.projectMembers).mockResolvedValue([])
 vi.mocked(projects.projectCandidates).mockResolvedValue({users:[],roles:[]})
 vi.mocked(audit.listAuditEvents).mockResolvedValue({items:[],nextCursor:null})
})
// Abrir explícitamente la carpeta de la vista a seleccionar: la navegación
// agrupa por tipo y contrae automáticamente grupos no activos.
function ensureDiagramFolderOpen(label:string){
 const collapsed=screen.queryByRole('button',{name:`Expandir carpeta ${label}`})
 if(collapsed)fireEvent.click(collapsed)
 expect(screen.getByRole('button',{name:`Contraer carpeta ${label}`})).toBeTruthy()
}
async function openEditor(){
 render(<NovziEditor/>)
 await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'})
 // Las pruebas de interacción seleccionan diagramas de varios tipos. El menú ahora
 // usa carpetas contraídas por tipo; abrirlas en la preparación mantiene las
 // selecciones reales sin modificar la experiencia de usuario de producción.
 for(const button of screen.queryAllByRole('button',{name:/^Expandir carpeta /}))fireEvent.click(button)
}

// Wait for project initialization and the actual projected graph before sending
// selection events. The heading can precede the passive diagram reset.
async function openAreaSelectionQA(control:'Seleccionar dos QA'|'Seleccionar relación QA08'='Seleccionar dos QA'){
 await act(async()=>{render(<NovziEditor/>)})
 await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'},{timeout:4500})
 const graph=within(await screen.findByTestId('graph-renderer'))
 await graph.findByRole('button',{name:'Usuario final'},{timeout:4500})
 await graph.findByRole('button',{name:'Plataforma Zercano'},{timeout:4500})
 const toolbar=within(screen.getByRole('toolbar',{name:'Acciones del diagrama'}))
 const toggle=await toolbar.findByRole('button',{name:'Seleccionar área del diagrama'},{timeout:4500})
 expect(toggle.getAttribute('aria-pressed')).toBe('false')
 await act(async()=>{fireEvent.click(toggle)})
 expect(toggle.getAttribute('aria-pressed')).toBe('true')
 const selection=await graph.findByRole('button',{name:control},{timeout:4500})
 await act(async()=>{fireEvent.click(selection)})
 const remove=await toolbar.findByRole('button',{name:'Eliminar selección del diagrama'},{timeout:4500})
 expect(remove.textContent).toContain(control==='Seleccionar dos QA'?'Eliminar (2)':'Eliminar (1)')
}

describe('Editor conectado a API — recorridos de comportamiento',()=>{
 it('muestra el tutorial de NOVZI desde el editor sin modificar el proyecto',async()=>{
  localStorage.removeItem('novzi.tutorial.complete.v1')
  await openEditor()
  const graph=screen.getByTestId('graph-renderer')
  fireEvent.click(screen.getByRole('button',{name:'Abrir tutorial desde el menú lateral'}))
  expect(screen.getByRole('dialog',{name:'Bienvenido a NOVZI'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Aprender NOVZI'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  expect(screen.getByRole('dialog',{name:'1. Organización = espacio de trabajo'})).toBeTruthy()
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  fireEvent.click(screen.getByRole('button',{name:'Cerrar tutorial'}))
  expect(screen.queryByTestId('novzi-guided-tutorial')).toBeNull()
  expect(projects.saveDocument).not.toHaveBeenCalled()
  expect(projects.importProject).not.toHaveBeenCalled()
 })
 it('tutorial permanece disponible al abrir un formulario y reanuda al cerrarlo',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Abrir tutorial desde el menú lateral'}))
  // Ir directamente desde el temario evita seis rerenders pesados de React Flow
  // en CI; seguimos verificando el formulario real y la reanudación.
  fireEvent.click(screen.getByRole('button',{name:/Temario/}))
  fireEvent.click(within(screen.getByRole('navigation',{name:'Temario del tutorial'})).getByRole('button',{name:/Agrega elementos de distintos tipos/}))
  expect(screen.getByRole('dialog',{name:'6. Agrega elementos de distintos tipos'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Agregar caja'}))
  expect(screen.getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy()
  expect(screen.queryByTestId('novzi-guided-tutorial')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}))
  expect(screen.getByRole('dialog',{name:'6. Agrega elementos de distintos tipos'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)

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
  expect(localStorage.getItem('novzi.navigation.collapsed')).toBe('1')
  fireEvent.click(screen.getByRole('button',{name:'Mostrar menú lateral'}))
  expect(layout.classList.contains('expanded')).toBe(false)
  expect(screen.getByTestId('graph-renderer')).toBe(graph)
  expect(localStorage.getItem('novzi.navigation.collapsed')).toBe('0')
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
  await waitFor(()=>expect(frame.className).toContain('novzi-fullscreen-fallback'))
  fireEvent.click(within(actions).getByRole('button',{name:'Agregar caja'}))
  expect(within(frame).getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy()
  fireEvent.click(within(frame).getByRole('button',{name:'Cancelar'}))
  expect(frame.querySelector('[role="dialog"]')).toBeNull()
  fireEvent.click(within(actions).getByRole('button',{name:'Salir de pantalla completa'}))
  await waitFor(()=>expect(frame.className).not.toContain('novzi-fullscreen-fallback'))
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
  fireEvent.click(screen.getByRole('button',{name:/qa@novzi\.test/}))
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
  const second={id:'w-new',name:'Área de innovación',role:'owner',organization_id:'o-qa'}
  vi.mocked(organizations.createOrganizationWorkspace).mockResolvedValue(second.id)
  vi.mocked(workspaces.listWorkspaces).mockResolvedValueOnce([workspace]).mockResolvedValue([workspace,second])
  await openEditor()
  fireEvent.click(screen.getByTitle('Nuevo espacio'))
  const modal=screen.getByRole('dialog',{name:'Crear espacio de trabajo'})
  fireEvent.change(within(modal).getByLabelText('Nombre del espacio'),{target:{value:second.name}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  await waitFor(()=>expect(organizations.createOrganizationWorkspace).toHaveBeenCalledWith('o-qa',second.name))
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
  ensureDiagramFolderOpen('C1 · Contexto')
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
  await waitFor(()=>expect(frame.className).toContain('novzi-fullscreen-fallback'))
  fireEvent.click(screen.getByRole('button',{name:'Salir de pantalla completa'}))
  await waitFor(()=>expect(frame.className).not.toContain('novzi-fullscreen-fallback'))
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
  render(<NovziEditor/>)
  await screen.findByRole('heading',{name:'Iniciar sesión'})
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@novzi.test'}})
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'Credencial-de-prueba-2026'}})
  fireEvent.click(screen.getByRole('button',{name:'Entrar a NOVZI'}))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Credenciales inválidas')
  expect(screen.queryByText('Crear cuenta')).toBeNull()
 })
 it('una sesión inexistente abre login y un login exitoso carga proyectos autorizados',async()=>{
  vi.mocked(auth.session).mockRejectedValue(new Error('No autenticado'))
  vi.mocked(auth.login).mockResolvedValue(user)
  render(<NovziEditor/>)
  await screen.findByRole('heading',{name:'Iniciar sesión'})
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@novzi.test'}})
  fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'Contraseña-muy-segura'}})
  fireEvent.click(screen.getByRole('button',{name:'Entrar a NOVZI'}))
  await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'})
  expect(auth.login).toHaveBeenCalledWith('qa@novzi.test','Contraseña-muy-segura')
  expect(screen.getByText('qa@novzi.test')).toBeTruthy()
 })
 it('una instalación sin diagramas permite crear el primero conservando el documento vacío',async()=>{
  const initial={...demoDocument(),diagrams:[]}
  vi.mocked(projects.loadDocument).mockResolvedValue({document:initial,version:1})
  render(<NovziEditor/>)
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
  vi.mocked(organizations.createOrganizationWorkspace).mockRejectedValue(new Error('Sin acceso para crear espacios'))
  await openEditor()
  fireEvent.click(screen.getByTitle('Nuevo espacio'))
  const modal=screen.getByRole('dialog',{name:'Crear espacio de trabajo'})
  fireEvent.change(within(modal).getByLabelText('Nombre del espacio'),{target:{value:'Área no autorizada'}})
  fireEvent.click(within(modal).getByRole('button',{name:/^Crear$/}))
  expect(await screen.findByText(/Sin acceso para crear espacios/)).toBeTruthy()
  expect((screen.getByRole('combobox',{name:'Espacio de trabajo'}) as HTMLSelectElement).value).toBe('w-qa')
 })
 it('permite seleccionar PNG/JPG e informa la marca de agua que decide la API',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Exportar'}))
  const modal=screen.getByRole('dialog',{name:'Exportar desde NOVZI'})
  expect(await within(modal).findByText(/Sin licencia comercial: imagen con marca de agua/)).toBeTruthy()
  fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:'jpg'}})
  expect(within(modal).getByRole('button',{name:'Descargar JPG'})).toBeTruthy()
  expect(projects.exportDiagramImage).not.toHaveBeenCalled()
 })
 it('informa un fallo de exportación sin perder el documento local',async()=>{
  vi.mocked(projects.exportProject).mockRejectedValue(new Error('Exportación bloqueada'))
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Exportar'}))
  const modal=screen.getByRole('dialog',{name:'Exportar desde NOVZI'})
  fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:'project-json'}})
  fireEvent.click(within(modal).getByRole('button',{name:'Descargar JSON del proyecto'}))
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
   ['URL QA','https://novzi.example/qa'],['Fecha QA','2026-11-11'],
   ['Número QA','7'],['Lista QA','Aprobado']
  ])fireEvent.change(screen.getByLabelText(label),{target:{value}})
  const checkbox=document.querySelector<HTMLInputElement>('.inspector .switch-field input[type="checkbox"]')
  expect(checkbox).not.toBeNull()
  fireEvent.click(checkbox!)
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const fields=saves.at(-1)![1].elements['platform'].fields
   expect(fields).toMatchObject({'qa-text':'Datos verificados','qa-long':'Descripción funcional ampliada','qa-link':'https://novzi.example/qa','qa-date':'2026-11-11','qa-num':'7','qa-choice':'Aprobado','qa-bool':true})
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
  render(<NovziEditor/>)
  await screen.findByRole('heading',{name:'Crea tu primer espacio'})
  expect(screen.queryByRole('button',{name:'Proyecto QA'})).toBeNull()
  expect(projects.loadDocument).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Crear espacio'})).toBeTruthy()
 })
 it('un workspace sin proyectos permite crear su primero sin mostrar datos ficticios',async()=>{
  vi.mocked(projects.listProjects).mockResolvedValue([])
  render(<NovziEditor/>)
  await screen.findByRole('heading',{name:'Crea tu primer proyecto'})
  expect(screen.queryByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeNull()
  expect(screen.getByRole('button',{name:'Crear proyecto'})).toBeTruthy()
 })
 it('cuando la API de proyectos falla se informa el error y no se inventa una vista',async()=>{
  vi.mocked(projects.listProjects).mockRejectedValue(new Error('Conexión rechazada al listar proyectos'))
  render(<NovziEditor/>)
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
  const file=new File([JSON.stringify({document:fixture})],'modelo-novzi.json',{type:'application/json'})
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify({document:fixture})})
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!,{target:{files:[file]}})
  const modal=await screen.findByRole('dialog',{name:'Confirmar importación'})
  fireEvent.click(within(modal).getByRole('button',{name:'Importar documento'}))
  await waitFor(()=>expect(projects.importProject).toHaveBeenCalledWith('p-qa',expect.objectContaining({schema:1}),1,{mode:'project'}))
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

// The same real editor is mounted with the existing API/React Flow boundary mocks.
// These assertions cover accepted/rejected mutations and the actual autosave payload.
describe('Regresión funcional de UML y selección de área',()=>{
 it('crea tres mensajes de secuencia, prohíbe conexión vertical y persiste identidades',async()=>{
  const doc=demoDocument();const elements:[string,ElementType][]=[['qa-a','uml-lifeline'],['qa-b','uml-lifeline'],['qa-aa','uml-activation'],['qa-bb','uml-activation']]
  for(const [id,type] of elements)doc.elements[id]={...createElement(id,type),id}
  const seq:Diagram={id:'qa-seq',name:'Secuencia de QA',type:'uml-sequence',description:'',createdAt:'2026-11-14',nodes:[{id:'qa-a',elementId:'qa-a',x:0,y:0,width:170,height:500},{id:'qa-b',elementId:'qa-b',x:400,y:0,width:170,height:500},{id:'qa-aa',elementId:'qa-aa',x:61,y:70,width:48,height:320,parentNodeId:'qa-a'},{id:'qa-bb',elementId:'qa-bb',x:61,y:70,width:48,height:320,parentNodeId:'qa-b'}],edges:[]}
  doc.diagrams.push(seq);vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor()
  fireEvent.click(screen.getByRole('button',{name:/Secuencia de QA/}));await screen.findByRole('heading',{name:'Secuencia de QA'})
  fireEvent.click(await screen.findByRole('button',{name:'Mensaje QA 1'}));fireEvent.click(screen.getByRole('button',{name:'Mensaje QA 2'}));fireEvent.click(screen.getByRole('button',{name:'Mensaje QA 1'}));fireEvent.click(screen.getByRole('button',{name:'Mensaje vertical QA'}))
  expect(screen.getByText(/únicamente por sus lados/)).toBeTruthy()
  await waitFor(()=>{const last=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];const edges=last?.diagrams.find(d=>d.id===seq.id)?.edges||[];expect(edges).toHaveLength(3);expect(new Set(edges.map(e=>e.id)).size).toBe(3);expect(edges.every(e=>e.sourceHandle?.startsWith('seq-')&&e.targetHandle?.startsWith('seq-'))).toBe(true)},{timeout:4500})
 })
 it('selección por área: cancelar conserva datos y confirmar quita el grupo sin borrar catálogo',async()=>{
  const doc=demoDocument();const first=doc.diagrams[0].nodes.slice(0,2);const nativeConfirm=vi.spyOn(window,'confirm')
  await openAreaSelectionQA();fireEvent.click(screen.getByRole('button',{name:'Eliminar selección del diagrama'}))
  let modal=screen.getByRole('dialog',{name:'Eliminar selección del diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Eliminar selección del diagrama'}));modal=screen.getByRole('dialog',{name:'Eliminar selección del diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Eliminar selección'}))
  await waitFor(()=>{const last=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(last).toBeDefined();for(const n of first){expect(last!.diagrams[0].nodes.some(x=>x.id===n.id)).toBe(false);expect(last!.elements[n.elementId]).toBeDefined()}},{timeout:4500});expect(nativeConfirm).not.toHaveBeenCalled()
 })
})

describe('Colaboración en vivo y guardado seguro',()=>{
 it('procesa presencia y revisiones válidas, ignora eventos dañados y cierra el canal al desmontar',async()=>{
  const streams:QAEventStream[]=[]
  class QAEventStream extends EventTarget{
   onopen:(()=>void)|null=null;onerror:(()=>void)|null=null;close=vi.fn()
   constructor(public url:string,public options?:EventSourceInit){super();streams.push(this)}
   emit(name:string,value:unknown){this.dispatchEvent(new MessageEvent(name,{data:JSON.stringify(value)}))}
  }
  vi.stubGlobal('EventSource',QAEventStream)
  try{
   const view=render(<NovziEditor/>);await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'});await waitFor(()=>expect(streams.length).toBeGreaterThan(0));const stream=streams.at(-1)!
   expect(stream.options?.withCredentials).toBe(true);act(()=>stream.onopen?.());expect(await screen.findByText('0 personas en línea')).toBeTruthy()
   act(()=>{stream.emit('presence',{participants:[{clientId:'other',userId:'other-user',name:'Colaborador QA',diagramId:null,elementId:null}]});stream.dispatchEvent(new MessageEvent('presence',{data:'bad-json'}));stream.emit('version',{version:1})})
   expect(await screen.findByText('1 persona en línea')).toBeTruthy();await waitFor(()=>expect(projects.sendPresence).toHaveBeenCalled())
   const remote=demoDocument();remote.diagrams[0].name='Revisión remota QA';vi.mocked(projects.loadDocument).mockResolvedValueOnce({document:remote,version:2});act(()=>stream.emit('version',{version:2}));expect(await screen.findByRole('heading',{name:'Revisión remota QA'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
   act(()=>stream.onerror?.());expect(await screen.findByText('Sin conexión en vivo · respaldo cada 12 s')).toBeTruthy();view.unmount();expect(stream.close).toHaveBeenCalledOnce()
  }finally{vi.unstubAllGlobals()}
 },15000)
 it('un conflicto de versión conserva cambios y no reintenta sobrescritura automáticamente',async()=>{
  vi.mocked(projects.saveDocument).mockRejectedValue(new Error('Conflicto de colaboración'))
  await openEditor();fireEvent.click(screen.getByRole('button',{name:'Mover nodo QA'}));expect(await screen.findByText('No se guardaron los cambios.')).toBeTruthy();expect(projects.saveDocument).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:'Mover nodo QA'}));expect(screen.getByText('No se guardaron los cambios.')).toBeTruthy();expect(projects.saveDocument).toHaveBeenCalledTimes(1)
 },15000)
})

describe('Regresión de edición y persistencia',()=>{
 it('configura un filtro propio, rechaza duplicados, renombra y retira la categoría sin borrar cajas',async()=>{
  await openEditor();const initial=demoDocument().diagrams[0]
  fireEvent.click(screen.getByRole('button',{name:'Filtros'}))
  const modal=screen.getByRole('dialog',{name:/Filtros:/})
  const add=within(modal).getByLabelText('Nueva categoría')
  fireEvent.change(add,{target:{value:'Categoría QA'}});fireEvent.click(within(modal).getByRole('button',{name:'Agregar filtro'}))
  fireEvent.change(add,{target:{value:'categoría qa'}});fireEvent.click(within(modal).getByRole('button',{name:'Agregar filtro'}))
  expect(screen.getByText(/Ya existe un filtro con ese nombre/)).toBeTruthy()
  const rename=within(modal).getByLabelText('Nombre de filtro Categoría QA')
  fireEvent.change(rename,{target:{value:'Categoría nueva'}});fireEvent.click(within(rename.parentElement!).getByRole('button',{name:'Guardar'}))
  await waitFor(()=>expect(within(modal).getByLabelText('Nombre de filtro Categoría nueva')).toBeTruthy())
  fireEvent.click(within(modal).getByRole('button',{name:'Eliminar filtro Categoría nueva'}))
  const confirm=screen.getByRole('dialog',{name:'Eliminar filtro'});fireEvent.click(within(confirm).getByRole('button',{name:'Quitar filtro'}))
  await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1].diagrams[0];expect(saved).toBeDefined();expect(saved!.filters?.some(f=>f.label==='Categoría nueva')??false).toBe(false);expect(saved!.nodes.map(n=>n.id)).toEqual(initial.nodes.map(n=>n.id))},{timeout:4500})
 })
 it('eliminar relación requiere confirmación y conserva los dos extremos',async()=>{
  const original=demoDocument(),snapshot=structuredClone(original),initial=snapshot.diagrams[0],edge=initial.edges[0]
  vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1})
  await openEditor()
  // El encabezado puede estar montado antes del useEffect que sincroniza React Flow.
  // Esperar la relación visible REAL del fixture, no insertar un botón artificial.
  const openRelation=async()=>{
   const button=await screen.findByRole('button',{name:'Editar relación QA'},{timeout:4500})
   expect(button.getAttribute('data-edge-id')).toBe(edge.id)
   fireEvent.click(button)
   const dialog=await screen.findByRole('dialog',{name:'Configurar relación'})
   fireEvent.click(within(dialog).getByRole('button',{name:'Eliminar relación'}))
   return screen.findByRole('dialog',{name:'Eliminar relación'})
  }
  let modal=await openRelation()
  fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}))
  expect(projects.saveDocument).not.toHaveBeenCalled()
  expect(original).toEqual(snapshot)
  modal=await openRelation()
  fireEvent.click(within(modal).getByRole('button',{name:'Eliminar relación'}))
  await waitFor(()=>{
   const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1]
   expect(saved).toBeDefined()
   expect(saved!.diagrams[0].edges).toEqual(initial.edges.filter(e=>e.id!==edge.id))
   expect(saved!.diagrams[0].nodes).toEqual(initial.nodes)
   expect(saved!.elements).toEqual(snapshot.elements)
   expect(saved!.diagrams.slice(1)).toEqual(snapshot.diagrams.slice(1))
  },{timeout:4500})
  expect(projects.saveDocument).toHaveBeenCalledTimes(1)
 },15000)
})

it('seleccionar área con teclado protege los campos de texto y pide confirmación para Supr',async()=>{
 await openAreaSelectionQA()
 const input=screen.getByLabelText('Nombre del diagrama');input.focus();expect(document.activeElement).toBe(input);fireEvent.keyDown(input,{key:'Delete'});expect(screen.queryByRole('dialog',{name:'Eliminar selección del diagrama'})).toBeNull();input.blur();expect(document.activeElement).not.toBe(input)
 fireEvent.keyDown(document,{key:'Delete'});const modal=await screen.findByRole('dialog',{name:'Eliminar selección del diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(screen.queryByRole('dialog',{name:'Eliminar selección del diagrama'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)
it('fragmentos combinados conservan operador y guardas en documento persistido',async()=>{
 const doc=demoDocument();const frame={...createElement('Fragmento QA','uml-frame'),id:'frame-qa',uml:{classifier:'alt'},summary:'[ok]\n[else]'};doc.elements[frame.id]=frame
 doc.diagrams.push({id:'qa-frag',name:'Fragmentos QA',type:'uml-sequence',description:'',createdAt:'2026-11-14',nodes:[{id:'qa-frame',elementId:frame.id,x:100,y:100,width:400,height:240}],edges:[]})
 vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:/Fragmentos QA/}));fireEvent.click(await within(screen.getByTestId('graph-renderer')).findByRole('button',{name:'Fragmento QA'}));fireEvent.change(screen.getByLabelText('Operador del fragmento UML'),{target:{value:'loop'}});fireEvent.change(screen.getByLabelText('Guardas del fragmento combinado'),{target:{value:'[i < 10]'}})
 await waitFor(()=>{const e=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1].elements[frame.id];expect(e?.uml?.classifier).toBe('loop');expect(e?.summary).toBe('[i < 10]')},{timeout:4500})
})

it('edita protocolo, sentido, trazo y recorrido sin modificar extremos ni otras relaciones',async()=>{
 const original=demoDocument(),snapshot=structuredClone(original),initial=snapshot.diagrams[0],edge=initial.edges[0]
 vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1})
 await openEditor()
 const button=await screen.findByRole('button',{name:'Editar relación QA'},{timeout:4500})
 expect(button.getAttribute('data-edge-id')).toBe(edge.id);fireEvent.click(button)
 const modal=await screen.findByRole('dialog',{name:'Configurar relación'})
 fireEvent.change(within(modal).getByLabelText('Nombre o protocolo de la relación'),{target:{value:'HTTPS QA'}})
 fireEvent.change(within(modal).getByLabelText('Dirección'),{target:{value:'both'}})
 fireEvent.change(within(modal).getByLabelText('Trazo'),{target:{value:'dashed'}})
 fireEvent.change(within(modal).getByLabelText('Recorrido'),{target:{value:'straight'}})
 fireEvent.click(within(modal).getByRole('button',{name:'Guardar relación'}))
 await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved).toBeDefined();expect(saved!.diagrams[0].edges[0]).toMatchObject({...edge,label:'HTTPS QA',direction:'both',lineStyle:'dashed',pathStyle:'straight'});expect(saved!.diagrams[0].edges.slice(1)).toEqual(initial.edges.slice(1));expect(saved!.diagrams[0].nodes).toEqual(initial.nodes);expect(saved!.elements).toEqual(snapshot.elements)},{timeout:4500})
},15000)
it('cancelar el editor de una relación descarta sus cambios sin persistirlos',async()=>{
 await openEditor()
 fireEvent.click(await screen.findByRole('button',{name:'Editar relación QA'},{timeout:4500}))
 const modal=await screen.findByRole('dialog',{name:'Configurar relación'})
 const input=within(modal).getByLabelText('Nombre o protocolo de la relación') as HTMLInputElement,original=input.value
 fireEvent.change(input,{target:{value:'No guardar QA'}});fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}))
 fireEvent.click(await screen.findByRole('button',{name:'Editar relación QA'},{timeout:4500}))
 expect((screen.getByLabelText('Nombre o protocolo de la relación') as HTMLInputElement).value).toBe(original)
 expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)


it('licencia no disponible impide descargar imagen, pero permite cancelar sin cambios',async()=>{
 vi.mocked(projects.workspaceLicense).mockRejectedValue(new Error('Licencia no disponible QA'));await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'})
 await screen.findByText(/Estado de licencia: Licencia no disponible QA/);expect((within(modal).getByRole('button',{name:'Descargar PNG'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.exportDiagramImage).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)
it('descarga una copia JSON autorizada sin mutar ni guardar el documento',async()=>{
 const doc=demoDocument();vi.mocked(projects.exportProject).mockResolvedValue({format:'NOVZI',exportedAt:'2026-11-14',document:doc})
 const originalCreate=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),originalRevoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');const create=vi.fn(()=> 'blob:qa-json'),revoke=vi.fn(),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
 Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke})
 try{await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:'project-json'}});fireEvent.click(within(modal).getByRole('button',{name:'Descargar JSON del proyecto'}));await waitFor(()=>expect(create).toHaveBeenCalledOnce());expect(projects.exportProject).toHaveBeenCalledWith(project.id);expect(click).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledWith('blob:qa-json');expect(projects.saveDocument).not.toHaveBeenCalled()}
 finally{if(originalCreate)Object.defineProperty(URL,'createObjectURL',originalCreate);else Reflect.deleteProperty(URL,'createObjectURL');if(originalRevoke)Object.defineProperty(URL,'revokeObjectURL',originalRevoke);else Reflect.deleteProperty(URL,'revokeObjectURL')}
},15000)


for(const [mode,format,documentFormat] of [['embedded','png','pdf'],['both','jpg','docx']] as const){
 it(`exportación PRO ${mode}: respeta campos, licencia, versión y descarga ${format}`,async()=>{
  const doc=demoDocument();vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1})
  vi.mocked(projects.workspaceLicense).mockResolvedValue({workspaceId:workspace.id,planCode:'pro',licenseActive:true,status:'active',features:{'diagram.export.png':true,'diagram.export.jpg':true,'diagram.export.clean':true,'diagram.export.advanced':true},expiresAt:null})
  const blob=new Blob(['QA']);vi.mocked(projects.exportDiagramImage).mockResolvedValue({blob,exportId:'qa-export'})
  const originalCreate=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),originalRevoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');const create=vi.fn(()=> 'blob:qa-export'),revoke=vi.fn();let filename='';vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download})
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke})
  try{await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});await within(modal).findByText(/Licencia activa: sin marca de agua/)
   fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:format}});fireEvent.change(within(modal).getByLabelText('Contenido de exportación'),{target:{value:mode}})
   if(mode==='both')fireEvent.change(within(modal).getByLabelText('Formato de las fichas'),{target:{value:documentFormat}})
   fireEvent.click(within(modal).getByRole('button',{name:'Todos en imagen'}));fireEvent.click(within(modal).getByRole('button',{name:'Descargar '+format.toUpperCase()}))
   await screen.findByText(/Imagen exportada y firmada correctamente/);expect(captureDiagramPng).toHaveBeenCalledOnce();expect(captureDiagramPng).toHaveBeenCalledWith(expect.any(HTMLElement),expect.objectContaining({'n-platform':expect.any(Array)}));expect(projects.exportDiagramImage).toHaveBeenCalledWith(project.id,doc.diagrams[0].id,format,1,'cG5n',expect.objectContaining({mode,fields:expect.any(Object),...(mode==='both'?{documentFormat}:{})}));expect(create).toHaveBeenCalledWith(blob);expect(filename.endsWith(mode==='both'?'_Fichas.zip':'.png')).toBe(true);expect(projects.saveDocument).not.toHaveBeenCalled()
   await waitFor(()=>expect(revoke).toHaveBeenCalledWith('blob:qa-export'),{timeout:4500})
  }finally{if(originalCreate)Object.defineProperty(URL,'createObjectURL',originalCreate);else Reflect.deleteProperty(URL,'createObjectURL');if(originalRevoke)Object.defineProperty(URL,'revokeObjectURL',originalRevoke);else Reflect.deleteProperty(URL,'revokeObjectURL')}
 },15000)
}

// QA04: real inspector actions, preserved identities and scoped persistence.
it('redimensiona una caja desde inspector, rechaza dimensiones inválidas y conserva catálogo',async()=>{
 const original=demoDocument();vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1});await openEditor()
 const node=original.diagrams[0].nodes.find(n=>n.id==='n-platform')!;fireEvent.click(await screen.findByRole('button',{name:original.elements[node.elementId].name}))
 const size=screen.getByRole('region',{name:'Dimensiones de caja'}),width=within(size).getByLabelText('Ancho (px)'),height=within(size).getByLabelText('Alto (px)'),apply=within(size).getByRole('button',{name:'Aplicar tamaño'}) as HTMLButtonElement
 fireEvent.change(width,{target:{value:'0'}});expect(apply.disabled).toBe(true);expect(projects.saveDocument).not.toHaveBeenCalled()
 fireEvent.change(width,{target:{value:'320'}});fireEvent.change(height,{target:{value:'180'}});expect(apply.disabled).toBe(false);fireEvent.click(apply)
 await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams[0].nodes.find(n=>n.id===node.id)).toMatchObject({width:320,height:180,elementId:node.elementId});expect(saved?.elements).toEqual(original.elements);expect(saved?.diagrams.slice(1)).toEqual(original.diagrams.slice(1))},{timeout:4500})
},15000)
it('asigna propiedades de relación UML de clases y preserva extremos',async()=>{
 const original=demoDocument();for(const id of ['qa-class-a','qa-class-b'])original.elements[id]={...createElement(id,'uml-class'),id}
 const diagram:Diagram={id:'qa-classes',type:'uml-class',name:'Clases QA04',description:'',createdAt:'2026-11-14',nodes:[{id:'qa-na',elementId:'qa-class-a',x:0,y:0},{id:'qa-nb',elementId:'qa-class-b',x:300,y:0}],edges:[{id:'qa-e',source:'qa-na',target:'qa-nb',relationKind:'association'}]};original.diagrams.push(diagram)
 vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:/Clases QA04/}));await screen.findByRole('heading',{name:'Clases QA04'})
 await waitFor(()=>expect(screen.getByRole('button',{name:'Editar relación QA'}).getAttribute('data-edge-id')).toBe('qa-e'))
 fireEvent.click(screen.getByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'})
 for(const [name,value] of [['Multiplicidad origen UML','1'],['Multiplicidad destino UML','0..*'],['Rol origen UML','cliente'],['Rol destino UML','pedidos']])fireEvent.change(within(modal).getByLabelText(name),{target:{value}})
 fireEvent.click(within(modal).getByRole('button',{name:'Guardar relación'}));await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams.find(d=>d.id===diagram.id)?.edges[0]).toMatchObject({id:'qa-e',source:'qa-na',target:'qa-nb',sourceMultiplicity:'1',targetMultiplicity:'0..*',sourceRole:'cliente',targetRole:'pedidos',relationKind:'association'});expect(saved?.elements).toEqual(original.elements)},{timeout:4500})
},15000)
it('permite cambiar iconos UML de despliegue sin cambiar los identificadores',async()=>{
 const original=demoDocument();for(const [id,type] of [['qa-device','uml-device'],['qa-runtime','uml-execution']] as const)original.elements[id]={...createElement(id,type),id}
 const diagram:Diagram={id:'qa-deploy',type:'uml-deployment',name:'Despliegue QA04',description:'',createdAt:'2026-11-14',nodes:[{id:'qa-dev-node',elementId:'qa-device',x:0,y:0},{id:'qa-run-node',elementId:'qa-runtime',x:400,y:0}],edges:[]};original.diagrams.push(diagram)
 vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:/Despliegue QA04/}));fireEvent.click(await screen.findByRole('button',{name:'qa-device'}));fireEvent.change(screen.getByLabelText('Icono del dispositivo UML'),{target:{value:'network'}})
 fireEvent.click(await screen.findByRole('button',{name:'qa-runtime'}));fireEvent.change(screen.getByLabelText('Tipo de entorno UML'),{target:{value:'docker'}})
 await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.elements['qa-device'].uml?.deviceIcon).toBe('network');expect(saved?.elements['qa-runtime'].uml?.runtimeIcon).toBe('docker');expect(saved?.diagrams.find(d=>d.id===diagram.id)).toEqual(diagram)},{timeout:4500})
},15000)
it('si falla captura visual no se firma ni descarga una imagen inexistente',async()=>{
 vi.mocked(captureDiagramPng).mockRejectedValue(new Error('Captura no disponible QA04'));await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});await waitFor(()=>expect((within(modal).getByRole('button',{name:'Descargar PNG'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(within(modal).getByRole('button',{name:'Descargar PNG'}));expect(await screen.findByText(/Captura no disponible QA04/)).toBeTruthy();expect(projects.exportDiagramImage).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Exportar desde NOVZI'})).toBeTruthy()
},15000)

it('Academy no crea organización automáticamente y comunica rechazo de API sin perder proyecto abierto',async()=>{
 const key='novzi.academy.lab.v1.'+user.id;localStorage.removeItem(key);vi.mocked(workspaces.createWorkspace).mockRejectedValue(new Error('Organización no disponible QA05'));await openEditor();fireEvent.click(screen.getByRole('button',{name:'Abrir misiones prácticas de NOVZI'}));const academy=await screen.findByRole('dialog',{name:'Misiones prácticas de NOVZI'});const create=within(academy).getByRole('button',{name:/Crear mi organización/}) as HTMLButtonElement;expect(workspaces.createWorkspace).not.toHaveBeenCalled();fireEvent.change(within(academy).getByLabelText('Nombre del espacio de formación'),{target:{value:' '}});expect(create.disabled).toBe(true);fireEvent.change(within(academy).getByLabelText('Nombre del espacio de formación'),{target:{value:'  Academia QA05  '}});fireEvent.click(create);expect(await within(academy).findByText('Organización no disponible QA05')).toBeTruthy();expect(workspaces.createWorkspace).toHaveBeenCalledWith('Academia QA05');expect(localStorage.getItem(key)).toBeNull();expect(projects.createProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled();fireEvent.click(within(academy).getByRole('button',{name:'Cerrar misiones'}));expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
},15000)
it('Academy recupera el laboratorio autorizado y prepara formulario de caja sin guardar hasta confirmación',async()=>{
 const key='novzi.academy.lab.v1.'+user.id;localStorage.setItem(key,JSON.stringify({workspaceId:workspace.id,projectId:project.id}));try{await openEditor();fireEvent.click(screen.getByRole('button',{name:'Abrir misiones prácticas de NOVZI'}));const academy=await screen.findByRole('dialog',{name:'Misiones prácticas de NOVZI'});const recipe=await within(academy).findByRole('button',{name:/Persona solicitante/});await waitFor(()=>expect((recipe as HTMLButtonElement).disabled).toBe(false));fireEvent.click(recipe);const dialog=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});expect(within(dialog).getByDisplayValue('Persona solicitante')).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Misiones prácticas de NOVZI'})).toBeTruthy()}finally{localStorage.removeItem(key)}
},15000)
it('Academy transfiere al tutorial explicativo y cerrar no modifica el documento',async()=>{
 await openEditor();fireEvent.click(screen.getByRole('button',{name:'Abrir misiones prácticas de NOVZI'}));const academy=await screen.findByRole('dialog',{name:'Misiones prácticas de NOVZI'});fireEvent.click(within(academy).getByRole('button',{name:/Primero ver el recorrido explicativo/}));expect(await screen.findByTestId('novzi-guided-tutorial')).toBeTruthy();expect(screen.queryByRole('dialog',{name:'Misiones prácticas de NOVZI'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Cerrar tutorial'}));expect(projects.saveDocument).not.toHaveBeenCalled();expect(projects.createProject).not.toHaveBeenCalled()
},15000)

// QA06: restoration is a real interaction from the editor through VersionHistory.
for(const concurrent of [false,true])it(`restauración histórica ${concurrent?'con actualización concurrente':'correcta'} valida versión de servidor antes de reemplazar el lienzo`,async()=>{
 const original=demoDocument(),restored=demoDocument();restored.diagrams[0].name='Contexto restaurado QA06';const version={version:2,created_at:'2026-11-12T12:00:00.000Z',updated_by:user.id,editor_name:'QA'}
 vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:3});vi.mocked(projects.listDocumentVersions).mockResolvedValue([version]);vi.mocked(projects.loadDocumentVersion).mockImplementation(async(_id,v)=>({...version,version:v,document:restored}));vi.mocked(projects.restoreDocumentVersion).mockResolvedValue({version:4,restoredFrom:2})
 await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Historial · v3'}));fireEvent.click(await screen.findByRole('button',{name:'Consultar v2'}));fireEvent.click(await screen.findByRole('button',{name:'Restaurar v2 como nueva versión'}));const confirm=screen.getByRole('dialog',{name:'Confirmar restauración v2'});fireEvent.change(within(confirm).getByLabelText('Confirmación de versión'),{target:{value:'v2'}});vi.mocked(projects.loadDocument).mockResolvedValueOnce({document:restored,version:concurrent?5:4});fireEvent.click(within(confirm).getByRole('button',{name:'Crear versión restaurada'}));await waitFor(()=>expect(projects.restoreDocumentVersion).toHaveBeenCalledWith(project.id,2,3))
 if(concurrent){expect(await screen.findByText(/Se restauró la versión, pero ya se detectó otra actualización/)).toBeTruthy();expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(screen.getByRole('dialog',{name:'Historial de versiones'})).toBeTruthy()}else{expect(await screen.findByRole('heading',{name:'Contexto restaurado QA06'})).toBeTruthy();expect(await screen.findByRole('button',{name:'Historial · v4'})).toBeTruthy();expect(screen.queryByRole('dialog',{name:'Historial de versiones'})).toBeNull()}
 expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)

it('importación rechazada conserva la vista y el diálogo permite cancelar sin guardado',async()=>{
 const model=demoDocument();vi.mocked(projects.importProject).mockRejectedValue(new Error('Versión obsoleta QA06'));await openEditor();const file=new File([JSON.stringify(model)],'modelo.json',{type:'application/json'});Object.defineProperty(file,'text',{value:async()=>JSON.stringify(model)});fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!,{target:{files:[file]}});const modal=await screen.findByRole('dialog',{name:'Confirmar importación'});fireEvent.click(within(modal).getByRole('button',{name:'Importar documento'}));expect(await screen.findByText(/Versión obsoleta QA06/)).toBeTruthy();expect(projects.importProject).toHaveBeenCalledWith(project.id,model,1,{mode:'project'});expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.loadDocument).toHaveBeenCalledTimes(1);fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)

it('exportación JSON rechazada informa error y no crea una descarga ficticia',async()=>{
 vi.mocked(projects.exportProject).mockRejectedValue(new Error('Exportación denegada QA06'));const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});fireEvent.change(within(modal).getByLabelText('Formato de exportación'),{target:{value:'project-json'}});fireEvent.click(within(modal).getByRole('button',{name:'Descargar JSON del proyecto'}));expect(await screen.findByText(/Exportación: Exportación denegada QA06/)).toBeTruthy();expect(projects.exportProject).toHaveBeenCalledWith(project.id);expect(click).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled();expect(screen.queryByRole('dialog',{name:'Exportar desde NOVZI'})).toBeNull()
},15000)

// QA07: cover editor integration across actual modal callbacks and persistence boundaries.
it('el menú móvil puede cerrarse mediante el fondo o el botón sin modificar el proyecto',async()=>{
 await openEditor();const aside=document.querySelector<HTMLElement>('.sidebar')!;const menu=document.querySelector<HTMLButtonElement>('.mobile-menu')!;fireEvent.click(menu);expect(aside.classList.contains('open')).toBe(true);fireEvent.click(document.querySelector<HTMLElement>('.mobile-scrim')!);expect(aside.classList.contains('open')).toBe(false);fireEvent.click(menu);fireEvent.click(aside.querySelector<HTMLButtonElement>('.sidebar-close')!);expect(aside.classList.contains('open')).toBe(false);expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('Escape restaura la pantalla completa alternativa sin escribir el modelo',async()=>{
 await openEditor()
 const frame=document.querySelector<HTMLElement>('.canvas-frame')!
 const actions=within(frame).getByLabelText('Acciones del diagrama')
 const requestFullscreen=vi.fn(async()=>{throw new Error('Fullscreen API rechazada en QA07')})
 Object.defineProperty(frame,'requestFullscreen',{configurable:true,value:requestFullscreen})
 fireEvent.click(within(actions).getByRole('button',{name:'Pantalla completa del diagrama'}))
 await waitFor(()=>expect(frame.classList.contains('novzi-fullscreen-fallback')).toBe(true))
 expect(requestFullscreen).toHaveBeenCalledOnce()
 expect(within(actions).getByRole('button',{name:'Salir de pantalla completa'})).toBeTruthy()
 fireEvent.keyDown(document,{key:'Escape'})
 await waitFor(()=>expect(frame.classList.contains('novzi-fullscreen-fallback')).toBe(false))
 expect(within(actions).getByRole('button',{name:'Pantalla completa del diagrama'})).toBeTruthy()
 expect(within(actions).queryByRole('button',{name:'Salir de pantalla completa'})).toBeNull()
 expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('el login pendiente deshabilita el envío y un rechazo textual aparece en el formulario',async()=>{
 vi.mocked(auth.session).mockRejectedValue(new Error('Sin sesión'));let rejectLogin!:(reason:string)=>void;vi.mocked(auth.login).mockImplementation(()=>new Promise((_resolve,reject)=>{rejectLogin=reject}));render(<NovziEditor/>);await screen.findByRole('heading',{name:'Iniciar sesión'});fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@novzi.test'}});fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'QA-no-es-una-clave-real'}});fireEvent.click(screen.getByRole('button',{name:'Entrar a NOVZI'}));const pending=await screen.findByRole('button',{name:'Validando...'}) as HTMLButtonElement;expect(pending.disabled).toBe(true);fireEvent.click(pending);expect(auth.login).toHaveBeenCalledOnce();await act(async()=>rejectLogin('Autenticación textual QA07'));expect((await screen.findByRole('alert')).textContent).toBe('Autenticación textual QA07');expect((screen.getByRole('button',{name:'Entrar a NOVZI'}) as HTMLButtonElement).disabled).toBe(false);expect(projects.loadDocument).not.toHaveBeenCalled()
})
it('renombrar el espacio actual actualiza la navegación sin cambiar el proyecto',async()=>{
 vi.mocked(workspaces.renameWorkspace).mockResolvedValue({id:workspace.id,name:'Espacio renombrado QA07'});await openEditor();fireEvent.click(screen.getByTitle('Administrar espacio'));const modal=await screen.findByRole('dialog',{name:'Administrar espacio: Espacio QA'});fireEvent.change(within(modal).getByLabelText('Nombre del espacio'),{target:{value:'Espacio renombrado QA07'}});fireEvent.click(within(modal).getByRole('button',{name:'Guardar nombre'}));expect(await screen.findByRole('dialog',{name:'Administrar espacio: Espacio renombrado QA07'})).toBeTruthy();expect(workspaces.renameWorkspace).toHaveBeenCalledWith(workspace.id,'Espacio renombrado QA07');expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('eliminar el único proyecto exige su nombre exacto y deja vacío el espacio',async()=>{
 vi.mocked(projects.deleteProject).mockResolvedValue({ok:true});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Administrar proyecto'}));fireEvent.click(within(await screen.findByRole('dialog',{name:'Administrar proyecto: Proyecto QA'})).getByRole('button',{name:'Eliminar proyecto definitivamente'}));const modal=await screen.findByRole('dialog',{name:'Eliminar proyecto: Proyecto QA'});const confirm=within(modal).getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement;expect(confirm.disabled).toBe(true);fireEvent.change(within(modal).getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:project.name}});fireEvent.click(confirm);expect(await screen.findByRole('heading',{name:'Crea tu primer proyecto'})).toBeTruthy();expect(projects.deleteProject).toHaveBeenCalledWith(project.id);expect(screen.queryByRole('button',{name:project.name})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('eliminar la organización con proyectos exige reconocer la eliminación en cascada',async()=>{
 vi.mocked(workspaces.deleteWorkspace).mockResolvedValue({ok:true,deletedProjects:1});await openEditor();fireEvent.click(screen.getByTitle('Administrar espacio'));fireEvent.click(within(await screen.findByRole('dialog',{name:'Administrar espacio: Espacio QA'})).getByRole('button',{name:'Eliminar espacio…'}));const modal=await screen.findByRole('dialog',{name:'Eliminar espacio: Espacio QA'});fireEvent.change(within(modal).getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:workspace.name}});const confirm=within(modal).getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement;expect(confirm.disabled).toBe(true);fireEvent.click(within(modal).getByRole('checkbox'));expect(confirm.disabled).toBe(false);fireEvent.click(confirm);expect(await screen.findByRole('heading',{name:'Crea tu primer espacio'})).toBeTruthy();expect(workspaces.deleteWorkspace).toHaveBeenCalledWith(workspace.id,workspace.name,true);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('la copia de recuperación conserva el borrador no guardado, y cancelar recarga mantiene los cambios',async()=>{
 vi.mocked(projects.saveDocument).mockRejectedValue(new Error('Conflicto de colaboración QA07'));const descriptor=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),revokeDescriptor=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');const create=vi.fn((_blob:Blob)=>'blob:qa07-recovery'),revoke=vi.fn();const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke})
 try{await openEditor();fireEvent.click(screen.getByRole('button',{name:'Mover nodo QA'}));await screen.findByText('No se guardaron los cambios.');fireEvent.click(screen.getByRole('button',{name:'Descargar mis cambios'}));expect(create).toHaveBeenCalledOnce();const blob=create.mock.calls[0][0];const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob)});const parsed=JSON.parse(content);expect(parsed.format).toBe('NOVZI-LOCAL-UNSAVED');expect(parsed.expectedVersion).toBe(1);expect(parsed.document).toEqual(JSON.parse(JSON.stringify(vi.mocked(projects.saveDocument).mock.calls[0][1])));expect(click).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledWith('blob:qa07-recovery');fireEvent.click(screen.getByRole('button',{name:'Recargar desde servidor'}));const modal=await screen.findByRole('dialog',{name:'Descartar borrador local'});fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(screen.queryByRole('dialog',{name:'Descartar borrador local'})).toBeNull();expect(screen.getByText('No se guardaron los cambios.')).toBeTruthy();expect(projects.loadDocument).toHaveBeenCalledTimes(1)}finally{if(descriptor)Object.defineProperty(URL,'createObjectURL',descriptor);else Reflect.deleteProperty(URL,'createObjectURL');if(revokeDescriptor)Object.defineProperty(URL,'revokeObjectURL',revokeDescriptor);else Reflect.deleteProperty(URL,'revokeObjectURL')}
},15000)
it('un subpaquete se crea dentro del paquete seleccionado y persiste su visibilidad UML',async()=>{
 const initial=demoDocument(),element={...createElement('Paquete QA07','uml-package'),id:'qa07-package'};initial.elements[element.id]=element;const diagram:Diagram={id:'qa07-packages',type:'uml-package',name:'Paquetes QA07',description:'',createdAt:'2026-11-14',nodes:[{id:'qa07-parent',elementId:element.id,x:0,y:0}],edges:[]};initial.diagrams.push(diagram);vi.mocked(projects.loadDocument).mockResolvedValue({document:initial,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:/Paquetes QA07/}));fireEvent.click(await screen.findByRole('button',{name:'Paquete QA07'}));fireEvent.change(screen.getByLabelText('Visibilidad UML del elemento'),{target:{value:'protected'}});fireEvent.click(screen.getByRole('button',{name:'Crear subpaquete dentro de este paquete'}));await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.elements[element.id].uml?.visibility).toBe('protected');const sub=Object.values(saved?.elements||{}).find(e=>e.name==='Nuevo subpaquete');expect(sub?.type).toBe('uml-subpackage');expect(saved?.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.elementId===sub?.id)?.parentNodeId).toBe('qa07-parent')},{timeout:4500})
},15000)
it('un subpaquete sin contenedor no se crea ni guarda',async()=>{
 const initial=demoDocument();initial.diagrams.push({id:'qa07-empty-package',type:'uml-package',name:'Paquetes vacíos QA07',description:'',createdAt:'2026-11-14',nodes:[],edges:[]});vi.mocked(projects.loadDocument).mockResolvedValue({document:initial,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:/Paquetes vacíos QA07/}));fireEvent.click(await screen.findByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.change(within(modal).getByLabelText('Nombre de la caja'),{target:{value:'Subpaquete huérfano QA07'}});fireEvent.change(within(modal).getByLabelText('Tipo de elemento'),{target:{value:'uml-subpackage'}});fireEvent.click(within(modal).getByRole('button',{name:'Agregar al lienzo'}));expect(await screen.findByText(/Primero crea o selecciona un Paquete o Model/)).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy()
})
it('el guardado canónico del servidor actualiza el documento y la versión del editor',async()=>{
 vi.mocked(projects.saveDocument).mockImplementation(async(_id,snapshot,_version,onCommitted)=>{const canonical=structuredClone(snapshot);canonical.diagrams[0].name='Contexto canónico QA07';onCommitted?.(canonical,2);return 2});await openEditor();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Descripción enviada QA07'}});expect(await screen.findByRole('heading',{name:'Contexto canónico QA07'},{timeout:4500})).toBeTruthy();expect(await screen.findByRole('button',{name:'Historial · v2'})).toBeTruthy();expect(screen.getByLabelText('Descripción')).toHaveProperty('value','Descripción enviada QA07');expect(projects.saveDocument).toHaveBeenCalledOnce()
},15000)
it('el guardado en curso fusiona cambios independientes del servidor con la edición local siguiente',async()=>{
 let finish!:()=>void;vi.mocked(projects.saveDocument).mockImplementationOnce((_id,snapshot,_version,onCommitted)=>new Promise(resolve=>{finish=()=>{const canonical=structuredClone(snapshot);canonical.elements.platform.summary='Resumen remoto QA07';onCommitted?.(canonical,2);resolve(2)}})).mockResolvedValue(3)
 await openEditor();fireEvent.change(screen.getByLabelText('Nombre del diagrama'),{target:{value:'Contexto en curso QA07'}});await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalledOnce(),{timeout:4500});expect(screen.getByText('Guardando...')).toBeTruthy();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Edición mientras guarda QA07'}});expect(projects.saveDocument).toHaveBeenCalledOnce();await act(async()=>finish());await waitFor(()=>{const calls=vi.mocked(projects.saveDocument).mock.calls;expect(calls).toHaveLength(2);expect(calls[1][2]).toBe(2);expect(calls[1][1].diagrams[0]).toMatchObject({name:'Contexto en curso QA07',description:'Edición mientras guarda QA07'});expect(calls[1][1].elements.platform.summary).toBe('Resumen remoto QA07')},{timeout:4500});expect(await screen.findByRole('button',{name:'Historial · v3'})).toBeTruthy()
},15000)
it('las categorías de una caja se asignan y retiran sin editar las fichas compartidas',async()=>{
 const original=demoDocument();original.diagrams[0].filters=[{id:'qa07-filter',label:'Categoría de prueba QA07'}];original.diagrams[0].nodes=original.diagrams[0].nodes.map(n=>({...n,filterIds:[]}));vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1});vi.mocked(projects.saveDocument).mockResolvedValueOnce(2).mockResolvedValueOnce(3);await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}));const input=screen.getByLabelText('Asignar Categoría de prueba QA07') as HTMLInputElement;expect(input.checked).toBe(false);fireEvent.click(input);await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams[0].nodes.find(n=>n.elementId==='platform')?.filterIds).toEqual(['qa07-filter']);expect(saved?.elements).toEqual(original.elements)},{timeout:4500});await screen.findByRole('button',{name:'Historial · v2'});fireEvent.click(screen.getByLabelText('Asignar Categoría de prueba QA07'));await waitFor(()=>{const calls=vi.mocked(projects.saveDocument).mock.calls;expect(calls).toHaveLength(2);expect(calls[1][1].diagrams[0].nodes.find(n=>n.elementId==='platform')?.filterIds).toEqual([]);expect(calls[1][1].elements).toEqual(original.elements)},{timeout:4500})
},15000)
it('renombrar un filtro a vacío o a otra categoría existente no altera el documento',async()=>{
 const original=demoDocument();original.diagrams[0].filters=[{id:'qa07-a',label:'Categoría A QA07'},{id:'qa07-b',label:'Categoría B QA07'}];vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Filtros'}));const modal=screen.getByRole('dialog',{name:/Filtros:/});const rename=within(modal).getByLabelText('Nombre de filtro Categoría A QA07');const action=within(rename.parentElement!).getByRole('button',{name:'Guardar'});fireEvent.change(rename,{target:{value:' '}});fireEvent.click(action);expect(await screen.findByText('El nombre del filtro no puede quedar vacío')).toBeTruthy();fireEvent.change(rename,{target:{value:'categoría b qa07'}});fireEvent.click(action);expect(await screen.findByText('Ya existe otro filtro con ese nombre')).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled();fireEvent.click(within(modal).getByRole('button',{name:'Cerrar filtros'}));expect(screen.queryByRole('dialog',{name:/Filtros:/})).toBeNull()
},15000)
it('no permite exportar una imagen de un borrador mientras el guardado está pendiente',async()=>{
 let finish!:(version:number)=>void;vi.mocked(projects.saveDocument).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));await openEditor();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Borrador QA07'}});fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});await within(modal).findByText(/Sin licencia comercial: imagen con marca de agua/);const download=within(modal).getByRole('button',{name:'Descargar PNG'}) as HTMLButtonElement;expect(download.disabled).toBe(true);fireEvent.click(download);expect(captureDiagramPng).not.toHaveBeenCalled();expect(projects.exportDiagramImage).not.toHaveBeenCalled();await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalledOnce(),{timeout:4500});await act(async()=>finish(2));await waitFor(()=>expect(download.disabled).toBe(false));fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.exportDiagramImage).not.toHaveBeenCalled()
},15000)

// QA08: real Academy actions reaching the editor, not mock callback assertions.
function qa08AcademyFixture():ProjectDocument{
 const doc:ProjectDocument={schema:1,elements:{},diagrams:[],fieldDefinitions:[]}
 const addElement=(id:string,type:ElementType,name=id,technical='')=>{
  doc.elements[id]={id,type,name,technical,summary:'',description:'',owner:'',author:'NOVZI',status:'Borrador',createdAt:'2026-11-12',updatedAt:'2026-11-12',links:[],fields:{}}
 }
 const addDiagram=(id:string,type:Diagram['type'],elementIds:string[],edges:[number,number][]=[]):Diagram=>{
  const diagram:Diagram={id,type,name:id,description:'',createdAt:'2026-11-12',nodes:elementIds.map((elementId,i)=>({id:`${id}-n${i}`,elementId,x:100*i,y:0})),edges:edges.map(([source,target],i)=>({id:`${id}-e${i}`,source:`${id}-n${source}`,target:`${id}-n${target}`}))}
  doc.diagrams.push(diagram);return diagram
 }
 for(const [id,type,name,technical] of [
  ['actor','actor','Persona solicitante',''],['system','system','Plataforma de solicitudes',''],['process','process','Gestionar solicitud',''],
  ['activity1','activity','Registrar solicitud',''],['activity2','activity','Revisar solicitud',''],
  ['hu','requirement','HU-01 · Registrar solicitudes',''],['rf','requirement','RF-01 · Validar campos',''],['uc','usecase','CU-01 · Registrar solicitud',''],
  ['web','container','Aplicación web',''],['api','service','API de solicitudes',''],['db','database','Base de datos',''],
  ['component','component','Gestor de solicitudes','Fastify + PostgreSQL'],['endpoint','endpoint','POST /solicitudes',''],['controller','component','SolicitudController','Controller TypeScript'],['service-class','component','SolicitudService','Servicio de dominio']
 ] as [string,ElementType,string,string][])addElement(id,type,name,technical)
 addDiagram('c1','c1',['actor','system','process'],[[0,1],[1,2]]).name='C1 · Contexto de Zercano'
 addDiagram('process-diagram','process',['activity1','activity2','hu'],[[0,1]])
 addDiagram('trace','trace',['hu','rf','uc','component'],[[0,2],[1,2],[0,3]])
 addDiagram('c2','c2',['web','api','db'],[[0,1],[1,2]])
 addDiagram('c3','c3',['component','endpoint'],[[0,1]])
 addDiagram('c4','c4',['controller','service-class'],[[0,1]])
 doc.elements.process.childDiagramId='process-diagram'
 doc.elements.system.childDiagramId='c2'
 doc.elements.api.childDiagramId='c3'
 doc.elements.component.childDiagramId='c4'
 // Two distinct, user-created field definitions; seeded fields do not earn badges.
 doc.fieldDefinitions.push({id:'training-channel',label:'Canal de solicitud',forType:'requirement',kind:'select',options:['Web','Móvil','API']})
 doc.fieldDefinitions.push({id:'training-protocol',label:'Protocolo de integración',forType:'endpoint',kind:'text'})
 Object.assign(doc.elements.hu,{summary:'Un usuario registra una solicitud',description:'El sistema valida los datos y permite guardar.',owner:'Producto',fields:{'training-channel':'Web'}})
 Object.assign(doc.elements.endpoint,{summary:'Crear solicitudes',description:'Recibe y valida el cuerpo JSON de la solicitud.',owner:'Backend',technical:'HTTPS POST /solicitudes',fields:{'training-protocol':'HTTPS'}})
 return doc
}

const qa08LabKey='novzi.academy.lab.v1.'+user.id
async function openQA08Academy(){
 fireEvent.click(screen.getByRole('button',{name:'Abrir misiones prácticas de NOVZI'}))
 return screen.findByRole('dialog',{name:'Misiones prácticas de NOVZI'})
}
function qa08Check(id:string){return within(document.querySelector(`[data-academy-check="${id}"]`) as HTMLElement)}
async function inQA08Lab(doc:ProjectDocument){
 localStorage.setItem(qa08LabKey,JSON.stringify({workspaceId:workspace.id,projectId:project.id}))
 vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();return openQA08Academy()
}
// jsdom has no scrolling implementation. Keep the real inspector and verify
// that the editor asks the relevant DOM target to scroll, without moving data.
function qa08Scroll(){
 const prior=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView')
 const scroll=vi.fn(function(this:HTMLElement,_options?:ScrollIntoViewOptions){return undefined})
 Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll})
 return {scroll,restore:()=>{if(prior)Object.defineProperty(HTMLElement.prototype,'scrollIntoView',prior);else Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView')}}
}
describe('QA08 · Academy integrada con editor',()=>{
 afterEach(()=>localStorage.removeItem(qa08LabKey))
 it('crea únicamente la organización de formación y conserva su identidad hasta el segundo paso',async()=>{
  localStorage.removeItem(qa08LabKey)
  const lab={id:'w-lab-08',name:'Laboratorio QA08',role:'owner'}
  vi.mocked(workspaces.listWorkspaces).mockResolvedValueOnce([workspace]).mockResolvedValue([workspace,lab])
  vi.mocked(workspaces.createWorkspace).mockResolvedValue(lab.id)
  vi.mocked(projects.listProjects).mockImplementation(async id=>id===lab.id?[]:[project])
  await openEditor();const academy=await openQA08Academy()
  fireEvent.change(within(academy).getByLabelText('Nombre del espacio de formación'),{target:{value:'Laboratorio QA08'}})
  fireEvent.click(within(academy).getByRole('button',{name:/Crear mi organización/}))
  expect(await within(academy).findByRole('button',{name:/Crear mi proyecto de práctica/})).toBeTruthy()
  expect(workspaces.createWorkspace).toHaveBeenCalledWith(lab.name)
  expect(JSON.parse(localStorage.getItem(qa08LabKey)!)).toEqual({workspaceId:lab.id})
  expect(projects.createProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('crea proyecto vacío después de un fallo recuperable y registra exclusivamente el laboratorio',async()=>{
  localStorage.setItem(qa08LabKey,JSON.stringify({workspaceId:workspace.id}))
  const lab={id:'p-lab-08',name:'Prácticas QA08',workspace_id:workspace.id}
  const empty=emptyDoc()
  vi.mocked(projects.createProject).mockRejectedValueOnce('No disponible QA08').mockResolvedValueOnce(lab)
  vi.mocked(projects.loadDocument).mockImplementation(async id=>({document:id===lab.id?empty:demoDocument(),version:1}))
  await openEditor();const academy=await openQA08Academy();const create=await within(academy).findByRole('button',{name:/Crear mi proyecto de práctica/})
  fireEvent.change(within(academy).getByLabelText('Nombre del proyecto de formación'),{target:{value:lab.name}})
  fireEvent.click(create);expect((await within(academy).findByRole('alert')).textContent).toContain('No disponible QA08')
  expect(JSON.parse(localStorage.getItem(qa08LabKey)!)).toEqual({workspaceId:workspace.id})
  fireEvent.click(within(academy).getByRole('button',{name:/Crear mi proyecto de práctica/}))
  await waitFor(()=>expect(qa08Check('c1').getByRole('button',{name:'Crear C1'})).toBeTruthy())
  expect(projects.createProject).toHaveBeenNthCalledWith(2,workspace.id,lab.name,empty)
  expect(JSON.parse(localStorage.getItem(qa08LabKey)!)).toEqual({workspaceId:workspace.id,projectId:lab.id})
  expect(projects.loadDocument).toHaveBeenCalledWith(lab.id);expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('vuelve al proyecto de estudio del mismo espacio sin escribir sobre el proyecto anterior',async()=>{
  const lab={id:'p-lab-08b',name:'Prácticas QA08B',workspace_id:workspace.id}
  localStorage.setItem(qa08LabKey,JSON.stringify({workspaceId:workspace.id,projectId:lab.id}))
  vi.mocked(projects.listProjects).mockResolvedValue([project,lab])
  const model=demoDocument();model.diagrams[0].name='Contexto laboratorio QA08'
  vi.mocked(projects.loadDocument).mockImplementation(async id=>({document:id===lab.id?model:demoDocument(),version:1}))
  await openEditor();const academy=await openQA08Academy();fireEvent.click(await within(academy).findByRole('button',{name:'Abrir laboratorio'}))
  expect(await screen.findByRole('heading',{name:'Contexto laboratorio QA08'})).toBeTruthy()
  expect(projects.loadDocument).toHaveBeenCalledWith(lab.id);expect(projects.createProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('selecciona organización de estudio distinta antes de ofrecer crear su proyecto',async()=>{
  const lab={id:'w-lab-08c',name:'Academia separada QA08',role:'owner'}
  localStorage.setItem(qa08LabKey,JSON.stringify({workspaceId:lab.id}))
  vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace,lab])
  vi.mocked(projects.listProjects).mockImplementation(async id=>id===lab.id?[]:[project])
  await openEditor();const academy=await openQA08Academy();fireEvent.click(await within(academy).findByRole('button',{name:/Ir a la organización de práctica/}))
  expect(await within(academy).findByRole('button',{name:/Crear mi proyecto de práctica/})).toBeTruthy()
  expect(projects.listProjects).toHaveBeenCalledWith(lab.id);expect(projects.createProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('prepara el formulario de diagrama de misión sin crear nada al cancelar',async()=>{
  const doc=qa08AcademyFixture();doc.diagrams=doc.diagrams.filter(d=>d.type!=='process')
  await inQA08Lab(doc);fireEvent.click(qa08Check('process').getByRole('button',{name:'Crear PROCESS'}))
  const dialog=await screen.findByRole('dialog',{name:'Nuevo diagrama'});expect(within(dialog).getByDisplayValue('02 · Flujo de solicitudes')).toBeTruthy()
  expect(within(dialog).getByLabelText('Tipo de visualización')).toHaveProperty('value','process')
  fireEvent.click(within(dialog).getByRole('button',{name:'Cancelar'}));expect(screen.queryByRole('dialog',{name:'Nuevo diagrama'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('navega y abre reutilización de la HU desde su misión sin duplicar el catálogo',async()=>{
  const doc=qa08AcademyFixture();const process=doc.diagrams.find(d=>d.type==='process')!;process.nodes=process.nodes.filter(n=>n.elementId!=='hu');process.edges=[]
  await inQA08Lab(doc);fireEvent.click(qa08Check('process').getByRole('button',{name:'Ir al diagrama'}));expect(await screen.findByRole('heading',{name:process.name})).toBeTruthy()
  fireEvent.click(qa08Check('functional-reuse').getByRole('button',{name:'Reutilizar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});expect(within(modal).getByLabelText('Buscar elemento del proyecto')).toBeTruthy()
  fireEvent.change(within(modal).getByLabelText('Buscar elemento del proyecto'),{target:{value:'HU-01'}});fireEvent.click(within(modal).getByRole('button',{name:/HU-01/}))
  await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.elements).toEqual(doc.elements);expect(saved?.diagrams.find(d=>d.id===process.id)?.nodes.some(n=>n.elementId==='hu')).toBe(true)},{timeout:4500})
 },15000)
 it.each(['functional','technical'] as const)('selecciona la ficha %s y resalta su configuración de campos sin guardar por sí solo',async kind=>{
  const doc=qa08AcademyFixture(),element=doc.elements[kind==='functional'?'hu':'endpoint'];element.description='';element.fields={}
  const {scroll,restore}=qa08Scroll()
  try{
   const academy=await inQA08Lab(doc);if(kind==='technical')fireEvent.click(within(academy).getByRole('button',{name:'Arquitecto técnico: pendiente'}))
   fireEvent.click(qa08Check(`${kind}-inspector`).getByRole('button',{name:'Seleccionar la caja'}))
   const inspector=within(document.querySelector('.inspector') as HTMLElement);expect(inspector.getByLabelText('Nombre')).toHaveProperty('value',element.name)
   fireEvent.click(qa08Check(`${kind}-field`).getByRole('button',{name:'Muéstrame dónde'}))
   expect(document.querySelector('[data-academy-field-settings]')?.classList.contains('academy-field-pulse')).toBe(true)
   await waitFor(()=>expect(scroll).toHaveBeenCalledWith({block:'center',behavior:'smooth'}))
   fireEvent.click(inspector.getByRole('button',{name:'Configurar campos personalizados'}));expect(await screen.findByRole('dialog',{name:'Campos personalizados por tipo de elemento'})).toBeTruthy()
   expect(projects.saveDocument).not.toHaveBeenCalled()
  }finally{restore()}
 },15000)
 it('una misión de campos o ficha sin HU presente informa el prerrequisito sin crear fichas',async()=>{
  const doc=qa08AcademyFixture();const trace=doc.diagrams.find(d=>d.type==='trace')!;const removed=trace.nodes.find(n=>n.elementId==='hu')!.id;trace.nodes=trace.nodes.filter(n=>n.id!==removed);trace.edges=trace.edges.filter(e=>e.source!==removed&&e.target!==removed)
  await inQA08Lab(doc);fireEvent.click(qa08Check('functional-field').getByRole('button',{name:'Muéstrame dónde'}));expect(await screen.findByText('Primero crea la caja indicada por la misión.')).toBeTruthy()
  fireEvent.click(qa08Check('functional-inspector').getByRole('button',{name:'Seleccionar la caja'}));expect(await screen.findByText('Primero crea la caja de práctica correspondiente.')).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('la guía de arquitectura dirige a la API de C2 y resalta el vínculo sin modificarlo',async()=>{
  const doc=qa08AcademyFixture();delete doc.elements.api.childDiagramId;const {scroll,restore}=qa08Scroll()
  try{
   const academy=await inQA08Lab(doc);fireEvent.click(within(academy).getByRole('button',{name:'Arquitecto técnico: pendiente'}))
   const guide=within(academy).getByRole('group',{name:'Guía para enlazar los niveles C1 a C4'});fireEvent.click(within(guide).getByRole('button',{name:'Seleccionar caja de C2'}))
   expect(await screen.findByRole('heading',{name:'c2'})).toBeTruthy();const inspector=within(document.querySelector('.inspector') as HTMLElement);expect(inspector.getByLabelText('Nombre')).toHaveProperty('value',doc.elements.api.name)
   expect(document.querySelector('[data-academy-view-link]')?.classList.contains('academy-link-highlight')).toBe(true);await waitFor(()=>expect(scroll).toHaveBeenCalledWith({block:'center',behavior:'smooth'}));expect(projects.saveDocument).not.toHaveBeenCalled()
  }finally{restore()}
 },15000)
 it('completa la integración abriendo la matriz mixta sin duplicar diagramas ni guardar',async()=>{
  const academy=await inQA08Lab(qa08AcademyFixture());fireEvent.click(within(academy).getByRole('button',{name:'Arquitectura conectada: pendiente'}));fireEvent.click(within(academy).getByRole('button',{name:/Abrir trazabilidad en modo mixto/}))
  expect(await screen.findByRole('heading',{name:'trace'})).toBeTruthy();expect(await within(academy).findByRole('button',{name:'Arquitectura conectada: conseguida'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
})

// QA08 · Real graph commands; only the XYFlow event source is simulated.
it('QA08 desplaza dos nodos en una única revisión, preservando fichas y relaciones',async()=>{
 const initial=demoDocument();await openAreaSelectionQA();fireEvent.click(screen.getByRole('button',{name:'Mover dos cajas QA08'}))
 await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams[0].nodes.slice(0,2).map(n=>({x:n.x,y:n.y}))).toEqual([{x:450,y:290},{x:670,y:350}]);expect(saved?.diagrams[0].edges).toEqual(initial.diagrams[0].edges);expect(saved?.elements).toEqual(initial.elements)},{timeout:4500});expect(projects.saveDocument).toHaveBeenCalledOnce()
},15000)
it('QA08 la selección de una relación no permite eliminarla a un usuario con permiso de layout solamente',async()=>{
 vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:[...reader.permissions,'diagram.layout.c1']})
 await openAreaSelectionQA('Seleccionar relación QA08');fireEvent.click(screen.getByRole('button',{name:'Eliminar selección del diagrama'}))
 expect(await screen.findByText('No tienes permiso para eliminar alguna relación seleccionada')).toBeTruthy();expect(screen.queryByRole('dialog',{name:'Eliminar selección del diagrama'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)
it('QA08 elimina solamente una relación seleccionada, no sus extremos ni catálogo',async()=>{
 const initial=demoDocument();await openAreaSelectionQA('Seleccionar relación QA08');fireEvent.click(screen.getByRole('button',{name:'Eliminar selección del diagrama'}));const modal=screen.getByRole('dialog',{name:'Eliminar selección del diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Eliminar selección'}))
 await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams[0].nodes).toEqual(initial.diagrams[0].nodes);expect(saved?.diagrams[0].edges).toEqual(initial.diagrams[0].edges.slice(1));expect(saved?.elements).toEqual(initial.elements)},{timeout:4500})
},15000)
it('QA08 acopla por arrastre una clase al paquete UML y permite desvincularla desde el inspector',async()=>{
 const doc=demoDocument();const parent={...createElement('Paquete de dominio QA08','uml-package'),id:'qa08-element-package'},child={...createElement('Clase QA08','uml-class'),id:'qa08-element-class'};doc.elements[parent.id]=parent;doc.elements[child.id]=child
 const diagram:Diagram={id:'qa08-class',name:'Clases QA08',type:'uml-class',description:'',createdAt:'2026-11-14',nodes:[{id:'qa08-parent',elementId:parent.id,x:0,y:0,width:780,height:520},{id:'qa08-child',elementId:child.id,x:1000,y:600}],edges:[]};doc.diagrams.push(diagram)
 vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});vi.mocked(projects.saveDocument).mockResolvedValueOnce(2).mockResolvedValueOnce(3)
 await openEditor();fireEvent.click(screen.getByRole('button',{name:/Clases QA08/}));fireEvent.click(await screen.findByRole('button',{name:'Arrastrar a contenedor QA08'}))
 await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.id==='qa08-child')).toMatchObject({parentNodeId:'qa08-parent',x:100,y:100})},{timeout:4500});await screen.findByRole('button',{name:'Historial · v2'})
 fireEvent.click(within(screen.getByTestId('graph-renderer')).getByRole('button',{name:child.name}));fireEvent.change(screen.getByLabelText('Contenedor UML'),{target:{value:''}})
 await waitFor(()=>{const calls=vi.mocked(projects.saveDocument).mock.calls;expect(calls).toHaveLength(2);expect(calls[1][1].diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.id==='qa08-child')?.parentNodeId).toBeUndefined();expect(calls[1][1].elements).toEqual(doc.elements)},{timeout:4500})
},15000)
it('QA08 rechaza relaciones UML que nacen de un nodo final de actividad',async()=>{
 const doc=demoDocument();const end={...createElement('Final QA08','uml-end'),id:'qa08-end'},action={...createElement('Acción QA08','uml-action'),id:'qa08-action'};doc.elements[end.id]=end;doc.elements[action.id]=action
 doc.diagrams.push({id:'qa08-activity',name:'Actividades QA08',type:'uml-activity',description:'',createdAt:'2026-11-14',nodes:[{id:'qa08-invalid-a',elementId:end.id,x:0,y:0},{id:'qa08-invalid-b',elementId:action.id,x:320,y:0}],edges:[]})
 vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:/Actividades QA08/}));fireEvent.click(await screen.findByRole('button',{name:'Conectar UML incompatible QA08'}));expect(await screen.findByText(/Estos tipos de elementos no tienen una relación UML válida/)).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)
it('QA08 preserva cambios incompatibles del mismo campo durante autoguardado y bloquea otro envío',async()=>{
 let finish!:()=>void
 vi.mocked(projects.saveDocument).mockImplementationOnce((_id,snapshot,_version,onCommitted)=>new Promise(resolve=>{finish=()=>{const remote=structuredClone(snapshot);remote.diagrams[0].description='Cambio remoto sobre la misma descripción';onCommitted?.(remote,2);resolve(2)}}))
 await openEditor();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Primer borrador QA08'}});await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalledOnce(),{timeout:4500})
 fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Segundo borrador QA08'}});await act(async()=>finish())
 expect(await screen.findByText('No se guardaron los cambios.')).toBeTruthy();expect(screen.getByLabelText('Descripción')).toHaveProperty('value','Segundo borrador QA08');expect(screen.getByRole('alert').textContent).toContain('Conflicto de colaboración')
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100))});expect(projects.saveDocument).toHaveBeenCalledOnce()
},15000)

class QA08EventStream extends EventTarget{
 static streams:QA08EventStream[]=[]
 onopen:(()=>void)|null=null;onerror:(()=>void)|null=null;close=vi.fn()
 constructor(public url:string,public options?:EventSourceInit){super();QA08EventStream.streams.push(this)}
 emit(name:string,value:unknown){this.dispatchEvent(new MessageEvent(name,{data:JSON.stringify(value)}))}
}
async function qa08OpenStream(){
 QA08EventStream.streams=[];vi.stubGlobal('EventSource',QA08EventStream);await openEditor();await waitFor(()=>expect(QA08EventStream.streams.length).toBeGreaterThan(0));const stream=QA08EventStream.streams.at(-1)!;act(()=>stream.onopen?.());return stream
}
describe('QA08 · eventos remotos y permisos',()=>{
 afterEach(()=>vi.unstubAllGlobals())
 it('descarta mensajes inválidos, versiones no enteras y lecturas obsoletas antes de cambiar el documento',async()=>{
  const stream=await qa08OpenStream();const count=vi.mocked(projects.loadDocument).mock.calls.length
  act(()=>{stream.dispatchEvent(new MessageEvent('version',{data:'no-json'}));stream.emit('version',{version:1.8});stream.emit('version',{version:1});stream.emit('presence',{participants:null})})
  expect(projects.loadDocument).toHaveBeenCalledTimes(count)
  vi.mocked(projects.loadDocument).mockResolvedValueOnce({document:demoDocument(),version:1});await act(async()=>stream.emit('version',{version:4}));expect(projects.loadDocument).toHaveBeenCalledTimes(count+1);expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
  vi.mocked(projects.loadDocument).mockResolvedValueOnce(null);await act(async()=>stream.emit('version',{version:4}));expect(projects.loadDocument).toHaveBeenCalledTimes(count+2);expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('ante fallo temporal de lectura remota mantiene SSE conectado y conserva la versión del proyecto',async()=>{
  const stream=await qa08OpenStream();vi.mocked(projects.loadDocument).mockRejectedValueOnce(new Error('API remota no disponible QA08'));await act(async()=>stream.emit('version',{version:2}));expect(await screen.findByText('0 personas en línea')).toBeTruthy();expect(screen.queryByText(/Sin conexión en vivo/)).toBeNull();expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(screen.getByRole('button',{name:'Historial · v1'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
 it('ignora revisión cuando hay un borrador o escritura en curso',async()=>{
  const stream=await qa08OpenStream();const count=vi.mocked(projects.loadDocument).mock.calls.length;let finish!:(v:number)=>void;vi.mocked(projects.saveDocument).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Borrador concurrente QA08'}});act(()=>stream.emit('version',{version:8}));expect(projects.loadDocument).toHaveBeenCalledTimes(count)
  await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalledOnce(),{timeout:4500});act(()=>stream.emit('version',{version:9}));expect(projects.loadDocument).toHaveBeenCalledTimes(count);await act(async()=>finish(2));expect(screen.getByLabelText('Descripción')).toHaveProperty('value','Borrador concurrente QA08')
 },15000)
 it('una modificación local posterior a una lectura remota impide reemplazar el borrador',async()=>{
  const stream=await qa08OpenStream();let finish!:(v:{document:ProjectDocument;version:number})=>void;vi.mocked(projects.loadDocument).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  act(()=>stream.emit('version',{version:2}));fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Borrador después de lectura QA08'}});const remote=demoDocument();remote.diagrams[0].description='Descripción remota QA08';await act(async()=>finish({document:remote,version:2}));expect(screen.getByLabelText('Descripción')).toHaveProperty('value','Borrador después de lectura QA08')
  await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalledOnce(),{timeout:4500});expect(vi.mocked(projects.saveDocument).mock.calls[0][1].diagrams[0].description).toBe('Borrador después de lectura QA08');expect(vi.mocked(projects.saveDocument).mock.calls[0][2]).toBe(1)
 },15000)
 it('actualiza presencia de otros colaboradores y envía la selección al endpoint efímero',async()=>{
  const stream=await qa08OpenStream();fireEvent.click(within(screen.getByTestId('graph-renderer')).getByRole('button',{name:'Plataforma Zercano'}));act(()=>stream.emit('presence',{participants:[{clientId:'r1',userId:'other1',name:'Ana QA08',diagramId:'c1',elementId:'platform'},{clientId:'r2',userId:'other2',name:'Luis QA08',diagramId:'c1',elementId:null},{clientId:'self',userId:user.id,name:'QA',diagramId:'c1',elementId:'platform'}]}))
  expect(await screen.findByText(/Ana QA08, Luis QA08 están viendo este diagrama/)).toBeTruthy();expect(screen.getByText(/Ana QA08 en la caja Plataforma Zercano/)).toBeTruthy();await waitFor(()=>expect(projects.sendPresence).toHaveBeenCalledWith(project.id,expect.any(String),'c1','platform'));expect(projects.saveDocument).not.toHaveBeenCalled()
 },15000)
})

// QA09 — remaining real editor callbacks and permission boundaries.
it('QA09 redimensionar por evento del lienzo valida límites y conserva la ficha',async()=>{
 const doc=demoDocument(),node={...doc.diagrams[0].nodes[0],id:'qa09-resize'};doc.diagrams[0].nodes=[node,...doc.diagrams[0].nodes.slice(1)];doc.diagrams[0].edges=doc.diagrams[0].edges.map(e=>({...e,source:e.source==='n-actor'?node.id:e.source,target:e.target==='n-actor'?node.id:e.target}));vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1})
 await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Redimensionar inválido QA09'}));expect(await screen.findByText(/Ancho\/alto: entre 48 y 4000/)).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Redimensionar válido QA09'}));await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams[0].nodes.find(n=>n.id===node.id)).toMatchObject({width:360,height:220,x:40,y:60});expect(saved?.elements).toEqual(doc.elements)},{timeout:4500})
},15000)
it('QA09 enfoca la caja de destino cuando el renderizador la registra',async()=>{
 const doc=demoDocument();const target=doc.diagrams.find(d=>d.id===doc.elements.platform.childDiagramId)!;doc.elements.platform.childNodeId=target.nodes[0].id;vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});const fitView=vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);vi.mocked(useReactFlow).mockReturnValue({getNode:()=>({id:target.nodes[0].id}),fitView,getViewport:()=>({x:0,y:0,zoom:1})} as unknown as ReturnType<typeof useReactFlow>)
 await openEditor();await within(await screen.findByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'});fireEvent.click(await screen.findByRole('button',{name:'Profundizar QA'}));await screen.findByRole('heading',{name:target.name});await waitFor(()=>expect(fitView).toHaveBeenCalledTimes(2),{timeout:4500});expect(fitView).toHaveBeenLastCalledWith(expect.objectContaining({nodes:[{id:target.nodes[0].id}]}));expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)
it('QA09 permisos de organización rechazados no impiden leer un proyecto autorizado',async()=>{
 vi.mocked(auth.workspaceAccess).mockRejectedValue(new Error('Permiso organización QA09'));await openEditor();expect(await screen.findByText(/No se pudieron cargar permisos: Permiso organización QA09/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Actividad'})).toBeNull();expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 permisos de proyecto rechazados bloquean edición aunque se cargue el documento',async()=>{
 vi.mocked(projects.projectAccess).mockRejectedValue(new Error('Permiso proyecto QA09'));await openEditor();expect(await screen.findByText(/Acceso al proyecto: Permiso proyecto QA09/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Agregar caja'})).toBeNull();expect(screen.getByLabelText('Nombre del diagrama')).toHaveProperty('disabled',true);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 catálogo de organizaciones fallido no inventa proyectos',async()=>{
 vi.mocked(workspaces.listWorkspaces).mockRejectedValue(new Error('Catálogo QA09'));render(<NovziEditor/>);expect(await screen.findByText(/Error al cargar espacios: Catálogo QA09/)).toBeTruthy();expect(await screen.findByRole('heading',{name:'Crea tu primer espacio'})).toBeTruthy();expect(projects.listProjects).not.toHaveBeenCalled();expect(projects.loadDocument).not.toHaveBeenCalled()
})
it('QA09 documento ausente inicializa un modelo vacío sin guardar automáticamente',async()=>{
 vi.mocked(projects.loadDocument).mockResolvedValue(null);render(<NovziEditor/>);expect(await screen.findByRole('heading',{name:'No hay diagramas todavía'})).toBeTruthy();expect(screen.queryByTestId('graph-renderer')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 error de lectura no sustituye el proyecto por un modelo inventado',async()=>{
 vi.mocked(projects.loadDocument).mockRejectedValue(new Error('Documento QA09'));render(<NovziEditor/>);expect(await screen.findByText(/Error al cargar diagrama: Documento QA09/)).toBeTruthy();expect(screen.queryByTestId('graph-renderer')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 cambiar proyecto guardado carga otro documento y versionado independiente',async()=>{
 const other={id:'p-qa09',name:'Segundo proyecto QA09',workspace_id:workspace.id},doc=demoDocument();doc.diagrams[0].name='Contexto aislado QA09';vi.mocked(projects.listProjects).mockResolvedValue([project,other]);vi.mocked(projects.loadDocument).mockImplementation(async id=>id===other.id?{document:doc,version:8}:{document:demoDocument(),version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:other.name}));expect(await screen.findByRole('heading',{name:'Contexto aislado QA09'})).toBeTruthy();expect(await screen.findByRole('button',{name:'Historial · v8'})).toBeTruthy();expect(projects.loadDocument).toHaveBeenLastCalledWith(other.id);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 el panel de licencia usa la organización activa y cierra sin mutar el modelo',async()=>{
 await openEditor();fireEvent.click(screen.getByRole('button',{name:'Licencia'}));const modal=await screen.findByRole('dialog',{name:'Licencia y suscripción NOVZI'});expect(await within(modal).findByText('FREE · Sin licencia comercial')).toBeTruthy();expect(within(modal).getByText(workspace.name)).toBeTruthy();expect(projects.workspaceLicense).toHaveBeenCalledWith(workspace.id);fireEvent.click(within(modal).getAllByRole('button',{name:'Cerrar'})[0]);expect(screen.queryByRole('dialog',{name:'Licencia y suscripción NOVZI'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 cerrar actividad vuelve al lienzo y no registra una escritura',async()=>{
 await openEditor();fireEvent.click(screen.getByRole('button',{name:'Actividad'}));const modal=await screen.findByRole('dialog');fireEvent.click(within(modal).getAllByRole('button',{name:'Cerrar'})[0]);expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 exportación de diccionario bloquea cierre durante generación y no embebe campos',async()=>{
 vi.mocked(projects.workspaceLicense).mockResolvedValue({workspaceId:workspace.id,planCode:'pro',licenseActive:true,status:'active',features:{'diagram.export.png':true,'diagram.export.jpg':true,'diagram.export.clean':true,'diagram.export.advanced':true},expiresAt:null})
 let finish!:(value:{blob:Blob;exportId:string})=>void;vi.mocked(projects.exportDiagramImage).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const createDesc=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),revokeDesc=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');let filename='';const revoke=vi.fn();Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(()=> 'blob:qa09')});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download})
 try{await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});await within(modal).findByText(/Licencia activa: sin marca de agua/);fireEvent.change(within(modal).getByLabelText('Contenido de exportación'),{target:{value:'dictionary'}});fireEvent.change(within(modal).getByLabelText('Formato de las fichas'),{target:{value:'html'}});fireEvent.click(within(modal).getByRole('button',{name:'Descargar PNG'}));await waitFor(()=>expect(projects.exportDiagramImage).toHaveBeenCalledOnce());expect(captureDiagramPng).toHaveBeenCalledWith(expect.any(HTMLElement),{});expect(within(modal).getByRole('button',{name:'Cancelar'})).toHaveProperty('disabled',true);fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));expect(screen.getByRole('dialog',{name:'Exportar desde NOVZI'})).toBeTruthy();expect(projects.exportDiagramImage).toHaveBeenCalledWith(project.id,'c1','png',1,'cG5n',expect.objectContaining({mode:'dictionary',documentFormat:'html'}));await act(async()=>finish({blob:new Blob(['QA']),exportId:'qa09'}));expect(await screen.findByText(/Imagen exportada y firmada correctamente/)).toBeTruthy();expect(filename.endsWith('_Fichas.zip')).toBe(true);await waitFor(()=>expect(revoke).toHaveBeenCalledWith('blob:qa09'),{timeout:4500});expect(projects.saveDocument).not.toHaveBeenCalled()}
 finally{if(createDesc)Object.defineProperty(URL,'createObjectURL',createDesc);else Reflect.deleteProperty(URL,'createObjectURL');if(revokeDesc)Object.defineProperty(URL,'revokeObjectURL',revokeDesc);else Reflect.deleteProperty(URL,'revokeObjectURL')}
},15000)
it('QA09 lee relación con permiso de borrado pero no de edición y permite cancelar',async()=>{
 const restricted:WorkspaceAccess={...reader,permissions:[...reader.permissions,'relation.delete.mixed','relation.delete.functional','relation.delete.technical']};vi.mocked(projects.projectAccess).mockResolvedValue(restricted);await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'});expect(within(modal).getByLabelText('Nombre o protocolo de la relación')).toHaveProperty('disabled',true);expect(within(modal).queryByRole('button',{name:'Guardar relación'})).toBeNull();fireEvent.click(within(modal).getByRole('button',{name:'Eliminar relación'}));const confirmation=await screen.findByRole('dialog',{name:'Eliminar relación'});fireEvent.click(within(confirmation).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 cerrar filtros por el control de cabecera no modifica categorías',async()=>{
 await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Filtros'}));const modal=await screen.findByRole('dialog',{name:/Filtros:/});fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));expect(screen.queryByRole('dialog',{name:/Filtros:/})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 usuarios y accesos están centralizados en organización y cerrar no guarda el documento',async()=>{
 await openEditor();expect(screen.queryByRole('button',{name:'Administrar accesos del espacio'})).toBeNull();expect(screen.queryByRole('button',{name:'Cuentas de la plataforma'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Usuarios y accesos de la organización'}));const modal=await screen.findByRole('dialog',{name:'Usuarios y accesos de la organización'});await waitFor(()=>expect(organizations.organizationAccessTree).toHaveBeenCalledWith(organization.id));await waitFor(()=>expect(organizations.listOrganizationInvitations).toHaveBeenCalledWith(organization.id));expect(within(modal).queryByRole('alert')).toBeNull();fireEvent.click(within(modal).getByText('Cerrar',{selector:'button'}));expect(screen.queryByRole('dialog')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 seleccionar caja de destino enlaza una aparición sin alterar catálogos de otras vistas',async()=>{
 const doc=demoDocument(),target=doc.diagrams.find(d=>d.id===doc.elements.platform.childDiagramId)!;vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(await within(screen.getByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'}));const link=screen.getByLabelText('Vista vinculada (doble clic)');const destination=screen.getByLabelText('Caja de destino (opcional)');fireEvent.change(destination,{target:{value:target.nodes[0].id}});await waitFor(()=>expect(vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1].elements.platform.childNodeId).toBe(target.nodes[0].id),{timeout:4500});await screen.findByRole('button',{name:'Historial · v2'});vi.mocked(projects.saveDocument).mockResolvedValueOnce(3);fireEvent.change(link,{target:{value:''}});await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.elements.platform.childNodeId).toBeUndefined();expect(saved?.elements.platform.childDiagramId).toBeUndefined();expect(saved?.diagrams).toEqual(doc.diagrams)}, {timeout:4500})
},15000)
it('QA09 navega a un elemento relacionado de otra vista usando identidad del catálogo',async()=>{
 const doc=demoDocument(),a=doc.diagrams[0].nodes.find(n=>n.elementId==='platform')!;const target={...createElement('Relacionado QA09','system'),id:'qa09-related'};doc.elements[target.id]=target;doc.diagrams.push({id:'qa09-remote-view',type:'custom',name:'Vista relacionada QA09',description:'',createdAt:'2026-11-14',nodes:[{...a,id:'qa09-reused'},{id:'qa09-related-node',elementId:target.id,x:300,y:200}],edges:[{id:'qa09-link',source:'qa09-reused',target:'qa09-related-node',label:'Consulta'}]});vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(await within(screen.getByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'}));fireEvent.click(await screen.findByRole('button',{name:target.name}));expect(await screen.findByRole('heading',{name:'Vista relacionada QA09'})).toBeTruthy();expect(screen.getByLabelText('Nombre')).toHaveProperty('value',target.name);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 preferencias de navegador denegadas no bloquean el editor ni guardan modelo',async()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Storage denegado')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Storage denegado')});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Ocultar menú lateral'}));expect(screen.getByRole('button',{name:'Mostrar menú lateral'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Ocultar minimapa'}));expect(screen.getByRole('button',{name:'Mostrar minimapa'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 importación que retorna documento vacío conserva la revisión confirmada sin escritura extra',async()=>{
 await openEditor();vi.mocked(projects.importProject).mockResolvedValue(9);vi.mocked(projects.loadDocument).mockResolvedValueOnce(null);const input=document.querySelector('input[type=file]')!;const file=new File(['{}'],'qa09.json',{type:'application/json'});Object.defineProperty(file,'text',{value:async()=>JSON.stringify({document:demoDocument()})});fireEvent.change(input,{target:{files:[file]}});const modal=await screen.findByRole('dialog',{name:'Confirmar importación'});fireEvent.click(within(modal).getByRole('button',{name:'Importar documento'}));await screen.findByText('Importación validada y guardada');expect(projects.importProject).toHaveBeenCalledWith(project.id,expect.any(Object),1,{mode:'project'});expect(screen.queryByTestId('graph-renderer')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA09 tipo de vista puede cambiarse sin cambiar identidad ni fichas',async()=>{
 const doc=demoDocument();await openEditor();fireEvent.change(screen.getByLabelText('Tipo de vista'),{target:{value:'custom'}});await waitFor(()=>{const saved=vi.mocked(projects.saveDocument).mock.calls.at(-1)?.[1];expect(saved?.diagrams[0]).toMatchObject({id:doc.diagrams[0].id,type:'custom',nodes:doc.diagrams[0].nodes,edges:doc.diagrams[0].edges});expect(saved?.elements).toEqual(doc.elements)},{timeout:4500})
},15000)
it('QA09 rechaza archivo sin contenido seleccionado sin llamar a importación',async()=>{
 await openEditor();const input=document.querySelector('input[type=file]')!;fireEvent.change(input,{target:{files:[]}});expect(screen.queryByRole('dialog',{name:'Confirmar importación'})).toBeNull();expect(projects.importProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
})

// QA10: alternatives of real commands, permissions and diagram-specific UI.
function qa10View(type:Diagram['type'],items:{id:string;type:ElementType;name:string;parentNodeId?:string}[],edges:Diagram['edges']=[]){
 const doc=demoDocument();const diagram:Diagram={id:'qa10-view',type,name:'Vista específica QA10',description:'',createdAt:'2026-11-14',nodes:[],edges}
 for(const [i,item] of items.entries()){
  const elementId='element-'+item.id;doc.elements[elementId]={...createElement(item.name,item.type),id:elementId};diagram.nodes.push({id:item.id,elementId,x:item.parentNodeId?40:i*370,y:item.parentNodeId?80:40,...(item.parentNodeId?{parentNodeId:item.parentNodeId}:{})})
 }
 doc.diagrams.push(diagram);return {doc,diagram}
}
async function qa10Open(doc:ProjectDocument){
 vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(await screen.findByRole('button',{name:/Vista específica QA10/}));await screen.findByRole('heading',{name:'Vista específica QA10'});return within(await screen.findByTestId('graph-renderer'))
}
async function qa10Add(type:ElementType,name:string){
 fireEvent.click(await within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).findByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.change(within(modal).getByLabelText('Nombre de la caja'),{target:{value:name}});fireEvent.change(within(modal).getByLabelText('Tipo de elemento'),{target:{value:type}});fireEvent.click(within(modal).getByRole('button',{name:'Agregar al lienzo'}));return modal
}
async function qa10Saved(){await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalled(),{timeout:4500});return vi.mocked(projects.saveDocument).mock.calls.at(-1)![1]}

it('QA10 crea fragmento combinado con operador alt y guardas iniciales',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[]);await qa10Open(doc);await qa10Add('uml-frame','Alternativas QA10');const saved=await qa10Saved();const e=Object.values(saved.elements).find(x=>x.name==='Alternativas QA10');expect(e).toMatchObject({type:'uml-frame',uml:{classifier:'alt'},summary:'[condición]\n[else]'});expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.some(n=>n.elementId===e?.id)).toBe(true)
},15000)
it('QA10 rechaza ejecución nueva sin participante y mantiene formulario',async()=>{
 const {doc}=qa10View('uml-sequence',[]);await qa10Open(doc);const modal=await qa10Add('uml-activation','Ejecución sin participante QA10');expect(await screen.findByText(/Primero crea o selecciona un Participante para acoplar/)).toBeTruthy();expect(modal).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 reutiliza ejecución existente dentro del participante seleccionado',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[{id:'qa10-parent',type:'uml-lifeline',name:'Participante QA10'}]);const reused={...createElement('Ejecución reutilizable QA10','uml-activation'),id:'qa10-reuse'};doc.elements[reused.id]=reused;const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Participante QA10'}));fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));fireEvent.click(within(modal).getByRole('button',{name:/Ejecución reutilizable QA10/}));const saved=await qa10Saved();expect(saved.elements).toEqual(doc.elements);expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.elementId===reused.id)?.parentNodeId).toBe('qa10-parent')
},15000)
it('QA10 reutilizar ejecución sin participante no duplica ni guarda el catálogo',async()=>{
 const {doc}=qa10View('uml-sequence',[]);const reused={...createElement('Ejecución huérfana QA10','uml-activation'),id:'qa10-reuse'};doc.elements[reused.id]=reused;await qa10Open(doc);fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));fireEvent.click(within(modal).getByRole('button',{name:/Ejecución huérfana QA10/}));expect(await screen.findByText(/Primero crea o selecciona un Participante \(línea de vida\)/)).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 reutilizar subpaquete sin paquete no guarda una jerarquía inválida',async()=>{
 const {doc}=qa10View('uml-package',[]);const reused={...createElement('Subpaquete reutilizable QA10','uml-subpackage'),id:'qa10-reuse'};doc.elements[reused.id]=reused;await qa10Open(doc);fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));fireEvent.click(within(modal).getByRole('button',{name:/Subpaquete reutilizable QA10/}));expect(await screen.findByText(/Selecciona un paquete o modelo/)).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 ejecución arrastrada dentro de su participante conserva acoplamiento y ficha',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[{id:'qa10-parent',type:'uml-lifeline',name:'Participante QA10'},{id:'qa10-child',type:'uml-activation',name:'Ejecución QA10',parentNodeId:'qa10-parent'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Mover acoplado QA10'}));const saved=await qa10Saved();const moved=saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.id==='qa10-child');expect(moved?.parentNodeId).toBe('qa10-parent');expect(moved?.y).not.toBe(diagram.nodes[1].y);expect(saved.elements).toEqual(doc.elements)
},15000)
it('QA10 establece dependencia UML de componente a artefacto con notación del estándar',async()=>{
 const {doc,diagram}=qa10View('uml-component',[{id:'qa10-source',type:'component',name:'Origen QA10'},{id:'qa10-target',type:'uml-artifact',name:'Destino QA10'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Conectar extremos QA10'}));const modal=await screen.findByRole('dialog',{name:'Relación UML de componentes'});fireEvent.change(within(modal).getByLabelText('Familia de relación'),{target:{value:'dependency'}});fireEvent.click(within(modal).getByRole('button',{name:'Guardar relación'}));const saved=await qa10Saved();const edge=saved.diagrams.find(d=>d.id===diagram.id)?.edges[0];expect(edge).toMatchObject({source:'qa10-source',target:'qa10-target',relationKind:'dependency',lineStyle:'dashed'});expect(saved.elements).toEqual(doc.elements)
},15000)
it('QA10 destino vertical de ejecución es rechazado sin persistencia',async()=>{
 const {doc}=qa10View('uml-sequence',[{id:'qa10-life-a',type:'uml-lifeline',name:'Participante A QA10'},{id:'qa10-life-b',type:'uml-lifeline',name:'Participante B QA10'},{id:'qa10-source',type:'uml-activation',name:'Ejecución A QA10',parentNodeId:'qa10-life-a'},{id:'qa10-target',type:'uml-activation',name:'Ejecución B QA10',parentNodeId:'qa10-life-b'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Conexión destino vertical QA10'}));expect(await screen.findByText(/únicamente por sus lados/)).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 selección de área ignora pulsación de caja y limpia selección explícita',async()=>{
 await openAreaSelectionQA();const graph=within(screen.getByTestId('graph-renderer'));fireEvent.click(graph.getByRole('button',{name:'Plataforma Zercano'}));expect(screen.queryByLabelText('Nombre')).toBeNull();fireEvent.keyDown(document,{key:'Delete',repeat:true});expect(screen.queryByRole('dialog',{name:'Eliminar selección del diagrama'})).toBeNull();fireEvent.click(graph.getByRole('button',{name:'Seleccionar dos QA'}));fireEvent.click(graph.getByRole('button',{name:'Limpiar selección QA10'}));fireEvent.keyDown(document,{key:'Backspace'});expect(screen.queryByRole('button',{name:'Eliminar selección del diagrama'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 permiso de edición de relación sin eliminación no expone acción destructiva',async()=>{
 vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:[...reader.permissions,'relation.edit.mixed','relation.edit.functional','relation.edit.technical']});await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'});expect(within(modal).queryByRole('button',{name:'Eliminar relación'})).toBeNull();expect(within(modal).getByRole('button',{name:'Guardar relación'})).toBeTruthy();fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));expect(screen.queryByRole('dialog')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 lector no puede abrir relación ni importar mediante evento diferido del archivo',async()=>{
 vi.mocked(projects.projectAccess).mockResolvedValue(reader);await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Editar relación QA'}));expect(screen.queryByRole('dialog',{name:'Configurar relación'})).toBeNull();const file=new File(['{}'],'qa10.json',{type:'application/json'});Object.defineProperty(file,'text',{value:async()=>JSON.stringify(demoDocument())});fireEvent.change(document.querySelector('input[type=file]')!,{target:{files:[file]}});expect(await screen.findByText(/Importación no permitida o guardado pendiente/)).toBeTruthy();expect(projects.importProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 exportación de un proyecto sin diagramas ofrece JSON y deshabilita imágenes',async()=>{
 vi.mocked(projects.loadDocument).mockResolvedValue({document:emptyDoc(),version:1});render(<NovziEditor/>);await screen.findByRole('heading',{name:'No hay diagramas todavía'});fireEvent.click(await screen.findByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});expect(within(modal).getByLabelText('Formato de exportación')).toHaveProperty('value','project-json');expect(within(modal).getByRole('button',{name:'Descargar JSON del proyecto'})).toHaveProperty('disabled',false);expect(within(modal).getByRole('option',{name:/PNG/})).toHaveProperty('disabled',true);expect(within(modal).getByRole('option',{name:/JPG/})).toHaveProperty('disabled',true);fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));expect(projects.exportProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 un rechazo textual del guardado mantiene borrador sin exponer copia a quien no puede exportar',async()=>{
 vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:[...reader.permissions,'diagram.edit.c1']});vi.mocked(projects.saveDocument).mockRejectedValue('Error de transporte QA10');await openEditor();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Borrador protegido QA10'}});expect(await screen.findByText(/Error de transporte QA10/,{},{timeout:4500})).toBeTruthy();expect(screen.queryByRole('button',{name:'Descargar mis cambios'})).toBeNull();expect(screen.getByLabelText('Descripción')).toHaveProperty('value','Borrador protegido QA10');expect(projects.saveDocument).toHaveBeenCalledOnce()
},15000)
it('QA10 una revisión remota elimina la vista actual y selecciona la siguiente sin escritura local',async()=>{
 const stream=await qa08OpenStream();try{const remote=demoDocument();remote.diagrams=remote.diagrams.slice(1);const next=remote.diagrams[0];vi.mocked(projects.loadDocument).mockResolvedValueOnce({document:remote,version:2});await act(async()=>stream.emit('version',{version:2}));expect(await screen.findByRole('heading',{name:next.name})).toBeTruthy();expect(screen.getByRole('button',{name:'Historial · v2'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()}finally{vi.unstubAllGlobals()}
})
it('QA10 presencia antigua sin userId se distingue por clientId, también ante un ping fallido',async()=>{
 const stream=await qa08OpenStream();try{vi.mocked(projects.sendPresence).mockRejectedValue(new Error('Presencia no disponible'));const clientId=new URL(stream.url,'http://localhost').searchParams.get('clientId');act(()=>stream.emit('presence',{participants:[{clientId,name:'Yo QA10',diagramId:'c1',elementId:null},{clientId:'peer-legacy',name:'Colega QA10',diagramId:'c1',elementId:null}]}));expect(await screen.findByText(/Colega QA10 está viendo este diagrama/)).toBeTruthy();expect(screen.queryByText(/Yo QA10 está viendo/)).toBeNull();await waitFor(()=>expect(projects.sendPresence).toHaveBeenCalled(),{timeout:4500});expect(projects.saveDocument).not.toHaveBeenCalled()}finally{vi.unstubAllGlobals()}
})
it('QA10 al quitar la única vista conserva el catálogo y vuelve al estado sin diagramas',async()=>{
 const doc=demoDocument();doc.diagrams=doc.diagrams.slice(0,1);vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Eliminar diagrama'}));const modal=await screen.findByRole('dialog',{name:'Eliminar diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Eliminar diagrama'}));expect(await screen.findByRole('heading',{name:'No hay diagramas todavía'})).toBeTruthy();const saved=await qa10Saved();expect(saved.diagrams).toEqual([]);expect(Object.keys(saved.elements).sort()).toEqual(Object.keys(doc.elements).sort())
},15000)
it('QA10 catálogo de máquina de estados muestra símbolos específicos de UML y no cambia el modelo',async()=>{
 const {doc}=qa10View('uml-state',[{id:'qa10-state',type:'uml-state',name:'Estado QA10'}]);const graph=await qa10Open(doc);await graph.findByRole('button',{name:'Estado QA10'});fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});const select=within(modal).getByLabelText('Tipo de elemento');for(const label of ['Elección / unión','Bifurcación / unión','Estado compuesto / región','Historial superficial','Historial profundo','Entrada','Salida','Terminación'])expect(within(select).getByRole('option',{name:label})).toBeTruthy();fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 comunicación UML presenta participantes y marco de interacción',async()=>{
 const {doc}=qa10View('uml-communication',[{id:'qa10-person',type:'actor',name:'Actor QA10'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Actor QA10'}));expect(screen.getByText('Participante',{selector:'.selected-type'})).toBeTruthy();fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});expect(within(modal).getByRole('option',{name:'Marco de interacción'})).toBeTruthy();fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 puerto compuesto arrastrado conserva anclaje al clasificador',async()=>{
 const {doc,diagram}=qa10View('uml-composite',[{id:'qa10-parent',type:'uml-class',name:'Clasificador QA10'},{id:'qa10-child',type:'uml-port',name:'Puerto QA10',parentNodeId:'qa10-parent'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Puerto QA10'}));expect(screen.getByLabelText('Contenedor UML')).toHaveProperty('value','qa10-parent');fireEvent.click(graph.getByRole('button',{name:'Mover acoplado QA10'}));const saved=await qa10Saved();expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.id==='qa10-child')?.parentNodeId).toBe('qa10-parent');expect(saved.elements).toEqual(doc.elements)
},15000)
it('QA10 crear caso de uso dentro del sujeto preserva los demás diagramas',async()=>{
 const {doc,diagram}=qa10View('uml-usecase',[{id:'qa10-parent',type:'uml-subject',name:'Sujeto QA10'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Sujeto QA10'}));expect(screen.getByLabelText('Contenedor UML')).toBeTruthy();await qa10Add('usecase','Registrar petición QA10');const saved=await qa10Saved();const e=Object.values(saved.elements).find(x=>x.name==='Registrar petición QA10');expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.elementId===e?.id)?.parentNodeId).toBe('qa10-parent');expect(saved.diagrams.filter(d=>d.id!==diagram.id)).toEqual(doc.diagrams.filter(d=>d.id!==diagram.id))
},15000)
it('QA10 perfil UML permite seleccionar su contenedor y cambiar visibilidad del estereotipo',async()=>{
 const {doc,diagram}=qa10View('uml-profile',[{id:'qa10-parent',type:'uml-profile',name:'Perfil QA10'},{id:'qa10-stereo',type:'uml-stereotype',name:'Estereotipo QA10',parentNodeId:'qa10-parent'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Estereotipo QA10'}));expect(screen.getByLabelText('Contenedor UML')).toHaveProperty('value','qa10-parent');fireEvent.change(screen.getByLabelText('Visibilidad UML del elemento'),{target:{value:'private'}});const saved=await qa10Saved();expect(saved.elements['element-qa10-stereo'].uml?.visibility).toBe('private');expect(saved.diagrams.find(d=>d.id===diagram.id)).toEqual(diagram)
},15000)
it('QA10 paquete padre no ofrece descendientes como candidatos de contención',async()=>{
 const {doc}=qa10View('uml-package',[{id:'qa10-parent',type:'uml-package',name:'Paquete padre QA10'},{id:'qa10-child',type:'uml-subpackage',name:'Paquete hijo QA10',parentNodeId:'qa10-parent'},{id:'qa10-other',type:'uml-package',name:'Otro paquete QA10'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Paquete padre QA10'}));const container=screen.getByLabelText('Contenedor UML');expect(within(container).queryByRole('option',{name:'Paquete hijo QA10'})).toBeNull();expect(within(container).queryByRole('option',{name:'Paquete padre QA10'})).toBeNull();expect(within(container).getByRole('option',{name:'Otro paquete QA10'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 relación de clase heredada sin notación explícita abre configuración canónica',async()=>{
 const {doc}=qa10View('uml-class',[{id:'qa10-source',type:'uml-class',name:'Origen QA10'},{id:'qa10-target',type:'uml-class',name:'Destino QA10'}],[{id:'qa10-edge',source:'qa10-source',target:'qa10-target'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'});expect(within(modal).getByText('Notación UML 2.5.1')).toBeTruthy();expect(within(modal).queryByLabelText('Dirección')).toBeNull();expect(within(modal).getByLabelText('Nombre o protocolo de la relación')).toHaveProperty('value','');fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 editar relación de caso de uso no presenta multiplicidades de clase',async()=>{
 const {doc}=qa10View('uml-usecase',[{id:'qa10-source',type:'usecase',name:'Caso A QA10'},{id:'qa10-target',type:'usecase',name:'Caso B QA10'}],[{id:'qa10-edge',source:'qa10-source',target:'qa10-target',relationKind:'include'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'});expect(within(modal).getByText('Notación UML 2.5.1')).toBeTruthy();expect(within(modal).queryByLabelText('Multiplicidad origen UML')).toBeNull();fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 permisos de layout sin permiso de edición de diagrama bloquean modificación de filtros',async()=>{
 const doc=demoDocument();doc.diagrams[0].filters=[{id:'qa10-filter',label:'Categoría QA10'}];vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:[...reader.permissions,'diagram.layout.c1']});await openEditor();expect(screen.queryByRole('button',{name:'Filtros'})).toBeNull();const graph=within(screen.getByTestId('graph-renderer'));fireEvent.click(await graph.findByRole('button',{name:'Plataforma Zercano'}));const filters=document.querySelector('.element-filters')!;expect(filters).toBeTruthy();fireEvent.click(within(filters as HTMLElement).getByRole('button',{name:'Configurar'}));const modal=await screen.findByRole('dialog',{name:/Filtros:/});fireEvent.change(within(modal).getByLabelText('Nueva categoría'),{target:{value:'Categoría no autorizada QA10'}});fireEvent.click(within(modal).getByRole('button',{name:'Agregar filtro'}));expect(within(modal).queryByLabelText('Nombre de filtro Categoría no autorizada QA10')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 espacio sin proyecto no concede creación a miembro sin permiso',async()=>{
 vi.mocked(auth.session).mockResolvedValue({...user,platformAdmin:false});vi.mocked(auth.workspaceAccess).mockResolvedValue({...reader,roleName:'Invitado QA10'});vi.mocked(workspaces.listWorkspaces).mockResolvedValue([{...workspace,role:'viewer'}]);vi.mocked(projects.listProjects).mockResolvedValue([]);render(<NovziEditor/>);await screen.findByRole('heading',{name:'Crea tu primer proyecto'});await screen.findByText('Invitado QA10',{selector:'.role-pill'});expect(screen.getByRole('button',{name:'Crear proyecto'})).toHaveProperty('disabled',true);expect(screen.queryByRole('button',{name:'Accesos'})).toBeNull();expect(projects.createProject).not.toHaveBeenCalled()
})
it('QA10 cambio de proyecto bloqueado durante autoguardado conserva el documento activo',async()=>{
 const other={id:'p-qa10',name:'Otro proyecto QA10',workspace_id:workspace.id};vi.mocked(projects.listProjects).mockResolvedValue([project,other]);let finish!:(version:number)=>void;vi.mocked(projects.saveDocument).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));await openEditor();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Cambio sin confirmar QA10'}});await waitFor(()=>expect(projects.saveDocument).toHaveBeenCalledOnce(),{timeout:4500});fireEvent.click(screen.getByRole('button',{name:other.name}));expect(await screen.findByText(/Primero espera a que se guarden los cambios/)).toBeTruthy();expect(projects.loadDocument).toHaveBeenCalledTimes(1);await act(async()=>finish(2));expect(await screen.findByRole('button',{name:'Historial · v2'})).toBeTruthy()
},15000)
it('QA10 error de sesión abre login privado y no consulta organizaciones',async()=>{
 vi.mocked(auth.session).mockRejectedValue(new Error('Sesión vencida QA10'));render(<NovziEditor/>);expect(await screen.findByRole('heading',{name:'Iniciar sesión'})).toBeTruthy();expect(workspaces.listWorkspaces).not.toHaveBeenCalled();expect(projects.loadDocument).not.toHaveBeenCalled()
})
it('QA10 foco en caja no registrada termina los reintentos sin bloquear navegación',async()=>{
 const doc=demoDocument(),target=doc.diagrams.find(d=>d.id===doc.elements.platform.childDiagramId)!;doc.elements.platform.childNodeId=target.nodes[0].id;vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});const getNode=vi.fn(()=>undefined),fitView=vi.fn();vi.mocked(useReactFlow).mockReturnValue({getNode,fitView,getViewport:()=>({x:0,y:0,zoom:1})} as unknown as ReturnType<typeof useReactFlow>);await openEditor();await within(await screen.findByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'});fireEvent.click(await screen.findByRole('button',{name:'Profundizar QA'}));await screen.findByRole('heading',{name:target.name});await waitFor(()=>expect(getNode).toHaveBeenCalledTimes(23),{timeout:4500});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180))});expect(getNode).toHaveBeenCalledTimes(23);expect(fitView).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
},15000)
it('QA10 relación histórica de despliegue se identifica sin reescribir la notación',async()=>{
 const {doc}=qa10View('uml-deployment',[{id:'qa10-source',type:'uml-artifact',name:'Artefacto QA10'},{id:'qa10-target',type:'uml-node',name:'Nodo QA10'}],[{id:'qa10-edge',source:'qa10-source',target:'qa10-target',relationKind:'manifestation'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Relación UML de despliegue'});const select=within(modal).getByLabelText('Tipo de relación UML');expect(select).toHaveProperty('value','manifestation');expect(within(modal).getByRole('note').textContent).toContain('sin registro');fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 la vista técnica de despliegue sin edición presenta icono y metadatos bloqueados',async()=>{
 const {doc}=qa10View('uml-deployment',[{id:'qa10-device',type:'uml-device',name:'Servidor QA10'},{id:'qa10-runtime',type:'uml-execution',name:'Entorno QA10'}]);vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:[...reader.permissions,'diagram.view.uml-deployment','element.view.uml-device','element.view.uml-execution','element.technical.view']});const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Servidor QA10'}));expect(screen.getByLabelText('Contenedor UML')).toHaveProperty('disabled',true);expect(screen.getByLabelText('Icono del dispositivo UML')).toHaveProperty('disabled',true);expect(screen.getByLabelText('Detalle técnico')).toHaveProperty('disabled',true);fireEvent.click(await graph.findByRole('button',{name:'Entorno QA10'}));expect(screen.getByLabelText('Tipo de entorno UML')).toHaveProperty('disabled',true);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 no ofrece reutilización cuando todas las fichas compatibles están en la vista',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[{id:'qa10-life',type:'uml-lifeline',name:'Único participante QA10'}]);doc.elements=Object.fromEntries(diagram.nodes.map(n=>[n.elementId,doc.elements[n.elementId]]));doc.diagrams=[diagram];vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});render(<NovziEditor/>);await screen.findByRole('heading',{name:diagram.name});fireEvent.click(await within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).findByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));expect(within(modal).getByText('No hay más elementos disponibles.')).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA10 exportación simple FREE usa imagen firmada de la revisión guardada',async()=>{
 vi.mocked(projects.exportDiagramImage).mockResolvedValue({blob:new Blob(['QA imagen']),exportId:'qa10-free'});const createDesc=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),revokeDesc=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');const revoke=vi.fn();let filename='';Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(()=> 'blob:qa10-free')});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download});try{await openEditor();fireEvent.click(screen.getByRole('button',{name:'Exportar'}));const modal=await screen.findByRole('dialog',{name:'Exportar desde NOVZI'});await within(modal).findByText(/Sin licencia comercial: imagen con marca de agua/);fireEvent.click(within(modal).getByRole('button',{name:'Descargar PNG'}));await screen.findByText(/Imagen exportada y firmada correctamente/);expect(captureDiagramPng).toHaveBeenCalledWith(expect.any(HTMLElement),{});expect(projects.exportDiagramImage).toHaveBeenCalledWith(project.id,'c1','png',1,'cG5n',undefined);expect(filename.endsWith('.png')).toBe(true);await waitFor(()=>expect(revoke).toHaveBeenCalledWith('blob:qa10-free'),{timeout:4500});expect(projects.saveDocument).not.toHaveBeenCalled()}finally{if(createDesc)Object.defineProperty(URL,'createObjectURL',createDesc);else Reflect.deleteProperty(URL,'createObjectURL');if(revokeDesc)Object.defineProperty(URL,'revokeObjectURL',revokeDesc);else Reflect.deleteProperty(URL,'revokeObjectURL')}
},15000)

// QA11: additional user-visible alternatives, preserving runtime and earlier tests.
it('QA11 primera organización abre formulario y cancelar no crea datos',async()=>{
 vi.mocked(workspaces.listWorkspaces).mockResolvedValue([]);render(<NovziEditor/>);await screen.findByRole('heading',{name:'Crea tu primer espacio'});fireEvent.click(screen.getByRole('button',{name:'Crear espacio'}));const modal=await screen.findByRole('dialog',{name:'Crear espacio de trabajo'});expect(within(modal).getByRole('button',{name:'Crear'})).toHaveProperty('disabled',true);fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(workspaces.createWorkspace).not.toHaveBeenCalled();expect(projects.loadDocument).not.toHaveBeenCalled()
})
it('QA11 primer proyecto abre formulario desde estado vacío',async()=>{
 vi.mocked(projects.listProjects).mockResolvedValue([]);render(<NovziEditor/>);await screen.findByRole('heading',{name:'Crea tu primer proyecto'});const button=screen.getByRole('button',{name:'Crear proyecto'});await waitFor(()=>expect(button).toHaveProperty('disabled',false));fireEvent.click(button);const modal=await screen.findByRole('dialog',{name:'Crear proyecto'});fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.createProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 cambia organización y no reutiliza revisión anterior',async()=>{
 const other={id:'w-qa11',name:'Otra organización QA11',role:'owner'},next={id:'p-qa11',name:'Otro proyecto QA11',workspace_id:other.id},doc=demoDocument();doc.diagrams[0].name='Contexto QA11';vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace,other]);vi.mocked(projects.listProjects).mockImplementation(async id=>id===other.id?[next]:[project]);vi.mocked(projects.loadDocument).mockImplementation(async id=>id===next.id?{document:doc,version:7}:{document:demoDocument(),version:1});await openEditor();fireEvent.change(screen.getByLabelText('Espacio de trabajo'),{target:{value:other.id}});await screen.findByRole('heading',{name:'Contexto QA11'});expect(await screen.findByRole('button',{name:'Historial · v7'})).toBeTruthy();expect(projects.loadDocument).toHaveBeenLastCalledWith(next.id);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 persiste atributos UML desde ficha y conserva posiciones',async()=>{
 const {doc,diagram}=qa10View('uml-class',[{id:'qa11-class',type:'uml-class',name:'Cuenta QA11'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Cuenta QA11'}));fireEvent.click(screen.getByRole('button',{name:'Atributo'}));fireEvent.change(screen.getByLabelText(/^Nombre atributo/),{target:{value:'saldo'}});fireEvent.change(screen.getByLabelText(/^Tipo atributo/),{target:{value:'Decimal'}});const saved=await qa10Saved();expect(saved.elements['element-qa11-class'].uml?.attributes).toEqual([expect.objectContaining({name:'saldo',type:'Decimal'})]);expect(saved.diagrams.find(d=>d.id===diagram.id)).toEqual(diagram);expect(saved.elements.platform).toEqual(doc.elements.platform)
})
it('QA11 cambia asociación a dependencia con notación canónica',async()=>{
 const {doc,diagram}=qa10View('uml-class',[{id:'qa10-source',type:'uml-class',name:'Origen QA11'},{id:'qa10-target',type:'uml-class',name:'Destino QA11'}],[{id:'qa11-edge',source:'qa10-source',target:'qa10-target',relationKind:'association'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'});fireEvent.change(within(modal).getByLabelText('Familia UML'),{target:{value:'Dependencia'}});fireEvent.change(within(modal).getByLabelText('Tipo de relación UML'),{target:{value:'dependency'}});fireEvent.click(within(modal).getByRole('button',{name:'Guardar relación'}));const saved=await qa10Saved();expect(saved.diagrams.find(d=>d.id===diagram.id)?.edges[0]).toMatchObject({id:'qa11-edge',source:'qa10-source',target:'qa10-target',relationKind:'dependency',lineStyle:'dashed'});expect(saved.elements).toEqual(doc.elements)
})
it('QA11 crea ejecución nueva con participante disponible',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[{id:'qa11-life',type:'uml-lifeline',name:'Participante QA11'}]);await qa10Open(doc);await qa10Add('uml-activation','Ejecución nueva QA11');const saved=await qa10Saved();const element=Object.values(saved.elements).find(e=>e.name==='Ejecución nueva QA11');expect(element?.type).toBe('uml-activation');expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.elementId===element?.id)?.parentNodeId).toBe('qa11-life')
})
it('QA11 reutiliza subpaquete dentro de paquete válido',async()=>{
 const {doc,diagram}=qa10View('uml-package',[{id:'qa11-parent',type:'uml-package',name:'Paquete QA11'}]);const element={...createElement('Subpaquete QA11','uml-subpackage'),id:'qa11-reuse'};doc.elements[element.id]=element;const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Paquete QA11'}));fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));fireEvent.change(within(modal).getByLabelText('Buscar elemento del proyecto'),{target:{value:'Subpaquete QA11'}});fireEvent.click(within(modal).getByRole('button',{name:/Subpaquete QA11/}));const saved=await qa10Saved();expect(saved.elements).toEqual(doc.elements);expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.elementId===element.id)?.parentNodeId).toBe('qa11-parent')
})
it('QA11 quitar vínculo de vista elimina destino sin borrar diagramas',async()=>{
 const original=demoDocument();vi.mocked(projects.loadDocument).mockResolvedValue({document:original,version:1});await openEditor();const graph=within(await screen.findByTestId('graph-renderer'));fireEvent.click(await graph.findByRole('button',{name:'Plataforma Zercano'}));fireEvent.change(screen.getByLabelText('Vista vinculada (doble clic)'),{target:{value:''}});expect(screen.queryByLabelText('Caja de destino (opcional)')).toBeNull();expect(screen.queryByRole('button',{name:/Navegar dentro de esta caja/})).toBeNull();const saved=await qa10Saved();expect(saved.elements.platform.childDiagramId).toBeUndefined();expect(saved.elements.platform.childNodeId).toBeUndefined();expect(saved.diagrams).toEqual(original.diagrams)
})
it('QA11 busca catálogo por resumen y regresa a creación',async()=>{
 const doc=demoDocument();const element={...createElement('Elemento único QA11','system'),id:'qa11-search',summary:'Cadena de búsqueda irrepetible QA11'};doc.elements[element.id]=element;vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));const search=within(modal).getByLabelText('Buscar elemento del proyecto');fireEvent.change(search,{target:{value:'irrepetible QA11'}});expect(within(modal).getByRole('button',{name:/Elemento único QA11/})).toBeTruthy();fireEvent.change(search,{target:{value:'sin coincidencias QA11'}});expect(within(modal).queryByRole('button',{name:/Elemento único QA11/})).toBeNull();fireEvent.click(within(modal).getByRole('button',{name:'Crear elemento'}));expect(within(modal).getByRole('button',{name:'Agregar al lienzo'})).toHaveProperty('disabled',true);fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 relación sin etiqueta confirma eliminación con nombre alternativo',async()=>{
 const {doc,diagram}=qa10View('uml-class',[{id:'qa10-source',type:'uml-class',name:'Origen QA11'},{id:'qa10-target',type:'uml-class',name:'Destino QA11'}],[{id:'qa11-empty-edge',source:'qa10-source',target:'qa10-target',relationKind:'association'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Editar relación QA'}));fireEvent.click(within(await screen.findByRole('dialog',{name:'Configurar relación'})).getByRole('button',{name:'Eliminar relación'}));const modal=await screen.findByRole('dialog',{name:'Eliminar relación'});expect(within(modal).getByText(/Sin nombre/)).toBeTruthy();fireEvent.click(within(modal).getByRole('button',{name:'Eliminar relación'}));const saved=await qa10Saved();expect(saved.diagrams.find(d=>d.id===diagram.id)?.edges).toEqual([]);expect(saved.elements).toEqual(doc.elements)
})
it('QA11 crear diagramas muestra ayuda por tipo UML y permite cancelar',async()=>{
 await openEditor();fireEvent.click(screen.getByRole('button',{name:'Crear diagrama'}));const modal=await screen.findByRole('dialog',{name:'Nuevo diagrama'});const type=within(modal).getByLabelText('Tipo de visualización');fireEvent.change(type,{target:{value:'uml-class'}});expect(within(modal).getByText(/El catálogo de cajas y relaciones se adapta/)).toBeTruthy();fireEvent.change(type,{target:{value:'uml-usecase'}});expect(within(modal).getByText(/Para vincular una HU de trazabilidad/)).toBeTruthy();fireEvent.change(type,{target:{value:'custom'}});expect(within(modal).getByText(/Podrás crear filtros propios/)).toBeTruthy();fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 deja intacta navegación al resolver foco de una vista ya abandonada',async()=>{
 const doc=demoDocument(),target=doc.diagrams.find(d=>d.id===doc.elements.platform.childDiagramId)!;doc.elements.platform.childNodeId=target.nodes[0].id;vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});let finish!:(ok:boolean)=>void;const fitView=vi.fn(()=>new Promise<boolean>(resolve=>{finish=resolve}));vi.mocked(useReactFlow).mockReturnValue({getNode:()=>({id:target.nodes[0].id}),fitView,getViewport:()=>({x:0,y:0,zoom:1})} as unknown as ReturnType<typeof useReactFlow>);await openEditor();await within(await screen.findByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'});fireEvent.click(await screen.findByRole('button',{name:'Profundizar QA'}));await screen.findByRole('heading',{name:target.name});await waitFor(()=>expect(fitView).toHaveBeenCalledOnce());ensureDiagramFolderOpen('C1 · Contexto');fireEvent.click(screen.getByRole('button',{name:/C1 · Contexto de Zercano/}));await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'});await act(async()=>finish(true));expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 al eliminar un proyecto con otro disponible abre únicamente el siguiente',async()=>{
 const other={id:'p-qa11',name:'Proyecto restante QA11',workspace_id:workspace.id},doc=demoDocument();doc.diagrams[0].name='Vista restante QA11';vi.mocked(projects.listProjects).mockResolvedValue([project,other]);vi.mocked(projects.loadDocument).mockImplementation(async id=>id===other.id?{document:doc,version:4}:{document:demoDocument(),version:1});vi.mocked(projects.deleteProject).mockResolvedValue({ok:true});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Administrar proyecto'}));fireEvent.click(within(await screen.findByRole('dialog',{name:'Administrar proyecto: Proyecto QA'})).getByRole('button',{name:'Eliminar proyecto definitivamente'}));const modal=await screen.findByRole('dialog',{name:'Eliminar proyecto: Proyecto QA'});fireEvent.change(within(modal).getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:project.name}});fireEvent.click(within(modal).getByRole('button',{name:'Eliminar definitivamente'}));await screen.findByRole('heading',{name:'Vista restante QA11'});expect(await screen.findByRole('button',{name:'Historial · v4'})).toBeTruthy();expect(projects.deleteProject).toHaveBeenCalledWith(project.id);expect(projects.loadDocument).toHaveBeenLastCalledWith(other.id);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 al eliminar organización activa conserva la segunda y carga sus proyectos',async()=>{
 const other={id:'w-qa11',name:'Organización restante QA11',role:'owner'};vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace,other]);vi.mocked(projects.listProjects).mockImplementation(async id=>id===other.id?[]:[project]);vi.mocked(workspaces.deleteWorkspace).mockResolvedValue({ok:true,deletedProjects:1});await openEditor();fireEvent.click(screen.getByTitle('Administrar espacio'));fireEvent.click(within(await screen.findByRole('dialog',{name:'Administrar espacio: Espacio QA'})).getByRole('button',{name:'Eliminar espacio…'}));const modal=await screen.findByRole('dialog',{name:'Eliminar espacio: Espacio QA'});fireEvent.change(within(modal).getByLabelText('Escribe el nombre para confirmar la eliminación'),{target:{value:workspace.name}});fireEvent.click(within(modal).getByRole('checkbox'));fireEvent.click(within(modal).getByRole('button',{name:'Eliminar definitivamente'}));await screen.findByRole('heading',{name:'Crea tu primer proyecto'});await waitFor(()=>expect(projects.listProjects).toHaveBeenLastCalledWith(other.id));expect(screen.getByLabelText('Espacio de trabajo')).toHaveProperty('value',other.id);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 permisos de metadatos sin edición técnica bloquean propiedades UML',async()=>{
 const {doc}=qa10View('uml-deployment',[{id:'qa11-device',type:'uml-device',name:'Servidor QA11'},{id:'qa11-runtime',type:'uml-execution',name:'Entorno QA11'}]);vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:[...reader.permissions,'diagram.view.uml-deployment','element.view.uml-device','element.view.uml-execution','element.edit.uml-device','element.edit.uml-execution','element.technical.view']});const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Servidor QA11'}));expect(screen.getByLabelText('Nombre')).toHaveProperty('disabled',false);expect(screen.getByLabelText('Icono del dispositivo UML')).toHaveProperty('disabled',true);fireEvent.click(await graph.findByRole('button',{name:'Entorno QA11'}));expect(screen.getByLabelText('Tipo de entorno UML')).toHaveProperty('disabled',true);expect(screen.getByLabelText('Detalle técnico')).toHaveProperty('disabled',true);expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 paquete en profundidad máxima no ofrece subpaquete adicional',async()=>{
 const {doc}=qa10View('uml-package',[{id:'qa11-root',type:'uml-package',name:'Raíz QA11'},{id:'qa11-child',type:'uml-subpackage',name:'Nivel uno QA11',parentNodeId:'qa11-root'},{id:'qa11-grandchild',type:'uml-subpackage',name:'Nivel dos QA11',parentNodeId:'qa11-child'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Nivel dos QA11'}));expect(screen.queryByRole('button',{name:'Crear subpaquete dentro de este paquete'})).toBeNull();expect(screen.getByLabelText('Contenedor UML')).toHaveProperty('value','qa11-child');expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 relación válida entre clases nace con asociación sin trazo discontinuo',async()=>{
 const {doc,diagram}=qa10View('uml-class',[{id:'qa10-source',type:'uml-class',name:'Origen QA11'},{id:'qa10-target',type:'uml-class',name:'Destino QA11'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Conectar extremos QA10'}));const dialog=await screen.findByRole('dialog',{name:'Configurar relación'});expect(projects.saveDocument).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar relación'}));const saved=await qa10Saved();const edge=saved.diagrams.find(d=>d.id===diagram.id)?.edges[0];expect(edge).toMatchObject({source:'qa10-source',target:'qa10-target',relationKind:'association'});expect(edge?.lineStyle).not.toBe('dashed');expect(saved.elements).toEqual(doc.elements)
})
it('QA11 relación histórica de paquete conserva etiqueta de notación original',async()=>{
 const {doc}=qa10View('uml-package',[{id:'qa10-source',type:'uml-package',name:'Paquete origen QA11'},{id:'qa10-target',type:'uml-package',name:'Paquete destino QA11'}],[{id:'qa11-old-edge',source:'qa10-source',target:'qa10-target',relationKind:'containment'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Editar relación QA'}));const modal=await screen.findByRole('dialog',{name:'Configurar relación'});const type=within(modal).getByLabelText('Tipo de relación UML');expect(type).toHaveProperty('value','containment');expect(within(type).getByRole('option',{name:/histórica/})).toBeTruthy();fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 fragmento histórico sin operador reconocido presenta alternativa alt y guarda opt',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[{id:'qa11-frame',type:'uml-frame',name:'Fragmento QA11'}]);doc.elements['element-qa11-frame'].uml={classifier:'legacy'};const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Fragmento QA11'}));const operator=screen.getByLabelText('Operador del fragmento UML');expect(operator).toHaveProperty('value','alt');fireEvent.change(operator,{target:{value:'opt'}});const saved=await qa10Saved();expect(saved.elements['element-qa11-frame'].uml?.classifier).toBe('opt');expect(saved.diagrams.find(d=>d.id===diagram.id)).toEqual(diagram)
})
it('QA11 lector consulta enlaces históricos sin destino ejecutable ni acción de borrado',async()=>{
 const doc=demoDocument();doc.elements.platform.links=[{id:'qa11-link',label:'Enlace inválido histórico QA11',url:'javascript:void(0)'}];vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});vi.mocked(projects.projectAccess).mockResolvedValue(reader);await openEditor();fireEvent.click(await within(screen.getByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'}));const link=screen.getByRole('link',{name:'Enlace inválido histórico QA11'});expect(link.getAttribute('href')).toBe('#');expect(screen.queryByTitle('Quitar enlace')).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 panel de campos abre desde cabecera sin modelo cuando la política lo permite',async()=>{
 // The active project grants field.configure, but its document read is still pending.
 let finish!:(value:{document:ProjectDocument;version:number})=>void;vi.mocked(projects.loadDocument).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));render(<NovziEditor/>);const button=await screen.findByTitle('Configuración de campos');fireEvent.click(button);const modal=await screen.findByRole('dialog',{name:'Campos personalizados por tipo de elemento'});expect(within(modal).getByRole('button',{name:'Crear campo'})).toHaveProperty('disabled',true);fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));await act(async()=>finish({document:demoDocument(),version:1}));await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'});expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 permisos de edición funcional no permiten reutilizar ficha no visible',async()=>{
 const doc=demoDocument(),hidden={...createElement('Ficha histórica QA11','system'),id:'qa11-hidden'};doc.elements[hidden.id]=hidden;vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});vi.mocked(projects.projectAccess).mockResolvedValue({...reader,permissions:['project.read','diagram.view.c1','diagram.layout.c1','element.view.actor','element.create.actor']});await openEditor();fireEvent.click(await within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).findByRole('button',{name:'Agregar caja'}));const modal=await screen.findByRole('dialog',{name:'Agregar caja al diagrama'});fireEvent.click(within(modal).getByRole('button',{name:'Reutilizar existente'}));expect(within(modal).queryByRole('button',{name:/Ficha histórica QA11/})).toBeNull();expect(within(modal).getByText('No hay más elementos disponibles.')).toBeTruthy();expect(screen.getByRole('dialog',{name:'Agregar caja al diagrama'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 revisión remota sin diagramas deja explorador vacío y retira ficha seleccionada',async()=>{
 const stream=await qa08OpenStream();try{fireEvent.click(await within(screen.getByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'}));const remote=emptyDoc();vi.mocked(projects.loadDocument).mockResolvedValueOnce({document:remote,version:5});await act(async()=>stream.emit('version',{version:5}));expect(await screen.findByRole('heading',{name:'No hay diagramas todavía'})).toBeTruthy();expect(screen.queryByLabelText('Nombre')).toBeNull();expect(screen.getByRole('button',{name:'Historial · v5'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()}finally{vi.unstubAllGlobals()}
})
it('QA11 respuesta tardía del proyecto anterior no reemplaza la vista activa',async()=>{
 const other={id:'p-qa11',name:'Proyecto rápido QA11',workspace_id:workspace.id},next=demoDocument();next.diagrams[0].name='Vista rápida QA11';vi.mocked(projects.listProjects).mockResolvedValue([project,other]);let finish!:(value:{document:ProjectDocument;version:number})=>void;vi.mocked(projects.loadDocument).mockImplementation(id=>id===project.id?new Promise(resolve=>{finish=resolve}):Promise.resolve({document:next,version:6}));render(<NovziEditor/>);await waitFor(()=>expect(projects.loadDocument).toHaveBeenCalledWith(project.id));fireEvent.click(await screen.findByRole('button',{name:other.name}));await screen.findByRole('heading',{name:'Vista rápida QA11'});await act(async()=>finish({document:demoDocument(),version:99}));expect(screen.getByRole('heading',{name:'Vista rápida QA11'})).toBeTruthy();expect(screen.getByRole('button',{name:'Historial · v6'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 permiso tardío del proyecto anterior no concede edición al nuevo lector',async()=>{
 const other={id:'p-qa11',name:'Proyecto lector QA11',workspace_id:workspace.id},next=demoDocument();next.diagrams[0].name='Vista lector QA11';vi.mocked(projects.listProjects).mockResolvedValue([project,other]);vi.mocked(projects.loadDocument).mockImplementation(async id=>id===other.id?{document:next,version:3}:{document:demoDocument(),version:1});let finish!:(value:WorkspaceAccess)=>void;vi.mocked(projects.projectAccess).mockImplementation(id=>id===project.id?new Promise(resolve=>{finish=resolve}):Promise.resolve(reader));await openEditor();fireEvent.click(screen.getByRole('button',{name:other.name}));await screen.findByRole('heading',{name:'Vista lector QA11'});await screen.findByText('Lector',{selector:'.role-pill'});await act(async()=>finish(owner));expect(screen.getByLabelText('Nombre del diagrama')).toHaveProperty('disabled',true);expect(screen.queryByRole('button',{name:'Agregar caja'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 tras un fallo transitorio guarda el cambio siguiente sin perder el borrador',async()=>{
 vi.mocked(projects.saveDocument).mockRejectedValueOnce(new Error('Red temporal QA11')).mockResolvedValueOnce(2);await openEditor();fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'Descripción local QA11'}});await screen.findByText('No se guardaron los cambios.');fireEvent.change(screen.getByLabelText('Nombre del diagrama'),{target:{value:'Nombre revisado QA11'}});await screen.findByRole('button',{name:'Historial · v2'},{timeout:4500});expect(screen.queryByText('No se guardaron los cambios.')).toBeNull();expect(projects.saveDocument).toHaveBeenCalledTimes(2);const [id,saved,base]=vi.mocked(projects.saveDocument).mock.calls[1];expect(id).toBe(project.id);expect(base).toBe(1);expect(saved.diagrams[0]).toMatchObject({name:'Nombre revisado QA11',description:'Descripción local QA11'})
},15000)
it('QA11 formato URL malformado no habilita guardar enlace externo',async()=>{
 await openEditor();fireEvent.click(await within(screen.getByTestId('graph-renderer')).findByRole('button',{name:'Plataforma Zercano'}));fireEvent.click(screen.getByRole('button',{name:'Agregar'}));const modal=await screen.findByRole('dialog',{name:'Agregar enlace externo'});fireEvent.change(within(modal).getByLabelText('Etiqueta del enlace'),{target:{value:'Documentación QA11'}});fireEvent.change(within(modal).getByLabelText('URL HTTPS'),{target:{value:'http://['}});expect(within(modal).getByRole('button',{name:'Agregar enlace'})).toHaveProperty('disabled',true);fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('QA11 relación de secuencia entre líneas de vida no fuerza puertos de ejecución',async()=>{
 const {doc,diagram}=qa10View('uml-sequence',[{id:'qa10-source',type:'uml-lifeline',name:'Participante A QA11'},{id:'qa10-target',type:'uml-lifeline',name:'Participante B QA11'}]);const graph=await qa10Open(doc);fireEvent.click(await graph.findByRole('button',{name:'Conectar extremos QA10'}));const saved=await qa10Saved();expect(saved.diagrams.find(d=>d.id===diagram.id)?.edges[0]).toMatchObject({source:'qa10-source',target:'qa10-target',relationKind:'message',sourceHandle:'right',targetHandle:'left'});expect(saved.elements).toEqual(doc.elements)
})
it('QA11 cierra panel de proyecto y conserva política si consulta posterior falla',async()=>{
 await openEditor();fireEvent.click(screen.getByRole('button',{name:'Administrar proyecto'}));const modal=await screen.findByRole('dialog',{name:'Administrar proyecto: Proyecto QA'});vi.mocked(projects.projectAccess).mockRejectedValueOnce(new Error('Política no disponible QA11'));fireEvent.click(within(modal).getByLabelText('Cerrar'));await waitFor(()=>expect(projects.projectAccess).toHaveBeenCalledTimes(2));expect(screen.queryByRole('dialog',{name:'Administrar proyecto: Proyecto QA'})).toBeNull();expect(screen.getByLabelText('Nombre del diagrama')).toHaveProperty('disabled',false);expect(projects.saveDocument).not.toHaveBeenCalled()
})

it('AUD-CL-UX UML clases no presenta perspectivas ni diagnóstico; C1 conserva selector y filtros',async()=>{
 const {doc}=qa10View('uml-class',[{id:'qa10-source',type:'uml-association-class',name:'Asociación borrador QA'}]);const graph=await qa10Open(doc);expect(screen.queryByRole('button',{name:'Funcional'})).toBeNull();expect(screen.queryByRole('button',{name:'Mixta'})).toBeNull();expect(screen.queryByRole('button',{name:'Técnica'})).toBeNull();expect(screen.queryByText(/Diagnóstico UML/)).toBeNull();fireEvent.click(await graph.findByRole('button',{name:'Asociación borrador QA'}));expect(screen.getByText('Borrador · Asociación pendiente de vincular')).toBeTruthy();ensureDiagramFolderOpen('C1 · Contexto');fireEvent.click(await within(document.querySelector('.diagram-nav') as HTMLElement).findByRole('button',{name:name=>name.includes(doc.diagrams[0].name)}));await screen.findByRole('heading',{name:doc.diagrams[0].name});expect(screen.getByRole('button',{name:'Funcional'})).toBeTruthy();expect(screen.getByRole('button',{name:'Mixta'})).toBeTruthy();expect(screen.getByRole('button',{name:'Técnica'})).toBeTruthy();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('AUD-CL-UX UML actividad no muestra perspectivas incluso tras navegar desde C1',async()=>{const {doc}=qa10View('uml-activity',[{id:'qa10-source',type:'uml-action',name:'Acción QA'}]);vi.mocked(projects.loadDocument).mockResolvedValue({document:doc,version:1});await openEditor();fireEvent.click(screen.getByRole('button',{name:'Funcional'}));fireEvent.click(await screen.findByRole('button',{name:/Vista específica QA10/}));await screen.findByRole('heading',{name:'Vista específica QA10'});expect(screen.queryByRole('button',{name:'Funcional'})).toBeNull();expect(projects.saveDocument).not.toHaveBeenCalled()})

it('QA10 crear caso de uso: UC-01 inspector funcional y estructural conserva identidad al cambiar selección sin claves duplicadas',async()=>{
 const {doc}=qa10View('uml-usecase',[{id:'qa10-parent',type:'uml-subject',name:'Sujeto QA UC'},{id:'qa10-source',type:'usecase',name:'Caso QA UC'},{id:'qa10-target',type:'actor',name:'Actor QA UC'}]);
 const errors=vi.spyOn(console,'error');
 try{
  const graph=await qa10Open(doc);
  for(const name of ['Sujeto QA UC','Caso QA UC','Actor QA UC','Caso QA UC']){
   fireEvent.click(await graph.findByRole('button',{name}));
   expect(await screen.findByRole('region',{name:'Detalle funcional UML'})).toBeTruthy();
   if(name==='Sujeto QA UC')expect(screen.queryByRole('region',{name:'Estructura UML de clase'})).toBeNull();
   else expect(screen.getByRole('region',{name:'Estructura UML de clase'})).toBeTruthy();
  }
  expect(errors.mock.calls.filter(call=>call.some(value=>typeof value==='string'&&/same key|unique.*key/i.test(value)))).toEqual([]);
  expect(projects.saveDocument).not.toHaveBeenCalled();
 }finally{errors.mockRestore()}
},15000)

it('UC catálogo de casos de uso: crear solo tipos nativos y reutilizar contexto existente',async()=>{
 const {doc,diagram}=qa10View('uml-usecase',[]);
 for(const [id,name,type] of [['uc-context-class','Clase contexto QA','uml-class'],['uc-context-ac','Clase asociación contexto QA','uml-association-class'],['uc-unrelated','Base no compatible QA','database']] as const){doc.elements[id]={...createElement(name,type),id}}
 await qa10Open(doc);fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));
 const modal=within(await screen.findByRole('dialog',{name:'Agregar caja al diagrama'}));
 const values=modal.getAllByRole('option').map(o=>(o as HTMLOptionElement).value).sort();
 expect(values).toEqual(['actor','uml-comment','uml-constraint','uml-subject','usecase'].sort());
 fireEvent.click(modal.getByRole('button',{name:'Reutilizar existente'}));
 expect(modal.queryByRole('button',{name:/Base no compatible QA/})).toBeNull();
 expect(modal.getByRole('button',{name:/Clase asociación contexto QA/})).toBeTruthy();
 fireEvent.click(modal.getByRole('button',{name:/Clase contexto QA/}));
 const saved=await qa10Saved();
 expect(saved.elements).toEqual(doc.elements);
 expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.some(n=>n.elementId==='uc-context-class')).toBe(true);
},15000)
it('UC catálogo casos de uso: clase de asociación permanece creable en UML clases',async()=>{
 const {doc}=qa10View('uml-class',[]);await qa10Open(doc);
 fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));
 const modal=within(await screen.findByRole('dialog',{name:'Agregar caja al diagrama'}));
 expect(modal.getAllByRole('option').map(o=>(o as HTMLOptionElement).value)).toContain('uml-association-class');
 expect(modal.getAllByRole('option').map(o=>(o as HTMLOptionElement).value)).not.toContain('usecase');
 fireEvent.click(modal.getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled();
})
it('UC catálogo AUD-UC-005 ficha aislada recargada reutiliza elementId con nueva ocurrencia',async()=>{
 const {doc,diagram}=qa10View('uml-usecase',[]);doc.elements['isolated-case']={...createElement('Caso aislado AUD-UC-005','usecase'),id:'isolated-case',useCaseCatalog:true};await qa10Open(doc);
 fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=within(await screen.findByRole('dialog',{name:'Agregar caja al diagrama'}));fireEvent.click(modal.getByRole('button',{name:'Reutilizar existente'}));fireEvent.change(modal.getByLabelText('Buscar elemento del proyecto'),{target:{value:'Caso aislado AUD-UC-005'}});fireEvent.click(modal.getByRole('button',{name:/^Caso aislado AUD-UC-005/}));const saved=await qa10Saved();expect(saved.elements['isolated-case']).toEqual(doc.elements['isolated-case']);expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.filter(n=>n.elementId==='isolated-case')).toHaveLength(1);expect(saved.diagrams.find(d=>d.id===diagram.id)?.nodes.find(n=>n.elementId==='isolated-case')?.id).not.toBe('isolated-case');
},15000)
it('UC catálogo AUD-UC-005 borrar ficha es acción explícita con confirmación; cancelar no guarda',async()=>{
 const {doc,diagram}=qa10View('uml-usecase',[]);doc.elements['isolated-case']={...createElement('Caso aislado para eliminar','usecase'),id:'isolated-case',useCaseCatalog:true};await qa10Open(doc);
 fireEvent.click(within(screen.getByRole('toolbar',{name:'Acciones del diagrama'})).getByRole('button',{name:'Agregar caja'}));const modal=within(await screen.findByRole('dialog',{name:'Agregar caja al diagrama'}));fireEvent.click(modal.getByRole('button',{name:'Reutilizar existente'}));fireEvent.click(modal.getByRole('button',{name:'Eliminar del modelo: Caso aislado para eliminar'}));const confirmation=within(await screen.findByRole('dialog',{name:'Eliminar elemento del modelo'}));fireEvent.click(confirmation.getByRole('button',{name:'Cancelar'}));expect(projects.saveDocument).not.toHaveBeenCalled();fireEvent.click(modal.getByRole('button',{name:'Eliminar del modelo: Caso aislado para eliminar'}));fireEvent.click(within(await screen.findByRole('dialog',{name:'Eliminar elemento del modelo'})).getByRole('button',{name:'Eliminar del modelo'}));const saved=await qa10Saved();expect(saved.elements['isolated-case']).toBeUndefined();expect(saved.diagrams.find(d=>d.id===diagram.id)).toEqual(diagram);
},15000)

function importFixtureQA(document:ProjectDocument){
 const file=new File([JSON.stringify(document)],'import-qa.json',{type:'application/json'});Object.defineProperty(file,'text',{value:async()=>JSON.stringify(document)});fireEvent.change(window.document.querySelector<HTMLInputElement>('input[type=file]')!,{target:{files:[file]}})
}
it('IMP importación de diagrama rechaza clases desde casos de uso sin llamar API',async()=>{
 const {doc}=qa10View('uml-usecase',[]);await qa10Open(doc);const source=qa10View('uml-class',[]).diagram;fireEvent.click(await screen.findByRole('button',{name:'Importar diagrama'}));importFixtureQA({...emptyDoc(),diagrams:[source]});await screen.findByText(/Tipo incompatible/);expect(screen.queryByRole('dialog',{name:'Confirmar importación'})).toBeNull();expect(projects.importProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('IMP importación de diagrama filtra tipos, exige elección y conserva vista activa',async()=>{
 const {doc,diagram}=qa10View('uml-usecase',[]);await qa10Open(doc);const candidate={...emptyDoc(),diagrams:[{...diagram,id:'src-1',name:'Primero'},{...diagram,id:'src-2',name:'Segundo'},{...diagram,id:'class-src',type:'uml-class' as const,name:'Clases ajenas'}]};const result=structuredClone(doc);result.diagrams.find(d=>d.id===diagram.id)!.name='Segundo';vi.mocked(projects.importProject).mockResolvedValue(2);vi.mocked(projects.loadDocument).mockResolvedValueOnce({document:result,version:2});fireEvent.click(await screen.findByRole('button',{name:'Importar diagrama'}));importFixtureQA(candidate);const modal=within(await screen.findByRole('dialog',{name:'Confirmar importación'}));const ok=modal.getByRole('button',{name:'Importar documento'}) as HTMLButtonElement;expect(ok.disabled).toBe(true);expect(modal.queryByRole('option',{name:'Clases ajenas'})).toBeNull();fireEvent.change(modal.getByLabelText('Diagrama de origen'),{target:{value:'src-2'}});expect(ok.disabled).toBe(false);fireEvent.click(ok);await screen.findByRole('heading',{name:'Segundo'});expect(projects.importProject).toHaveBeenCalledWith(project.id,candidate,1,{mode:'diagram',targetDiagramId:diagram.id,sourceDiagramId:'src-2'});expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('IMP importación de proyecto avisa sustitución completa y cancelar conserva documento',async()=>{
 await openEditor();fireEvent.click(await screen.findByRole('button',{name:'Importar proyecto'}));importFixtureQA(demoDocument());const modal=within(await screen.findByRole('dialog',{name:'Confirmar importación'}));expect(modal.getByText(/Reemplazar el proyecto completo/)).toBeTruthy();fireEvent.click(modal.getByRole('button',{name:'Cancelar'}));expect(projects.importProject).not.toHaveBeenCalled();expect(projects.saveDocument).not.toHaveBeenCalled()
})
it('IMP lector no puede iniciar importación de diagrama ni proyecto',async()=>{
 vi.mocked(projects.projectAccess).mockResolvedValue(reader);await openEditor();expect(screen.queryByRole('button',{name:'Importar diagrama'})).toBeNull();expect(screen.queryByRole('button',{name:'Importar proyecto'})).toBeNull()
})
