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
   onConnect?:(c:{source:string|null;target:string|null})=>void,
   onEdgeClick?:(e:unknown,edge:unknown)=>void,
   nodesConnectable?:boolean
  })=><div data-testid="graph-renderer" data-relations-enabled={String(nodesConnectable)}>
   {nodes.map(n=><button type="button" key={n.id} onClick={()=>onNodeClick?.({},n)}>{n.data.element?.name||n.id}</button>)}
   {edges.length>0&&<button type="button" onClick={()=>onEdgeClick?.({},edges[0])}>Editar relación QA</button>}
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-payment-provider'})}>Conectar QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:'n-actor'})}>Autoconexión QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-ghost',target:'n-payment-provider'})}>Conexión huérfana QA</button>
   <button type="button" onClick={()=>onConnect?.({source:'n-actor',target:null})}>Conexión incompleta QA</button>
   <button type="button" onClick={()=>onNodeDoubleClick?.({},nodes.find(n=>n.data.elementId==='platform')||nodes[0])}>Profundizar QA</button>
   <button type="button" onClick={()=>onNodeDragStop?.({}, {id:'n-platform',position:{x:372.4,y:183.6}})}>Mover nodo QA</button>
   <button type="button" onClick={()=>onPaneClick?.()}>Deseleccionar QA</button>
  </div>,
  useNodesState:(initial:unknown[])=>{const [nodes,setNodes]=React.useState(initial);return[nodes,setNodes,()=>{}]},
  Background:()=>null,Controls:()=>null,MiniMap:()=>null,Handle:()=>null,
  Position:{Left:'left',Right:'right'},MarkerType:{ArrowClosed:'arrowclosed'}
 }
})
vi.mock('../security/api',()=>({session:vi.fn(),login:vi.fn(),logout:vi.fn(),workspaceAccess:vi.fn()}))
vi.mock('../workspaces/api',()=>({listWorkspaces:vi.fn(),createWorkspace:vi.fn(),renameWorkspace:vi.fn(),deleteWorkspace:vi.fn()}))
vi.mock('../projects/api',()=>({listProjects:vi.fn(),createProject:vi.fn(),loadDocument:vi.fn(),saveDocument:vi.fn(),exportProject:vi.fn(),importProject:vi.fn(),listDocumentVersions:vi.fn(),loadDocumentVersion:vi.fn(),renameProject:vi.fn(),restoreDocumentVersion:vi.fn(),projectAccess:vi.fn(),deleteProject:vi.fn(),projectMembers:vi.fn(),projectCandidates:vi.fn(),assignProjectMember:vi.fn(),removeProjectMember:vi.fn()}))
vi.mock('../audit/api',()=>({listAuditEvents:vi.fn()}))

const owner:WorkspaceAccess={roleId:'r-owner',roleKey:'owner',roleName:'Propietario',permissions:[]}
const reader:WorkspaceAccess={roleId:'r-reader',roleKey:'viewer',roleName:'Lector',permissions:['project.read','diagram.view.c1','element.view.actor','element.view.system','element.view.external']}
const workspace={id:'w-qa',name:'Espacio QA',role:'owner'}
const project={id:'p-qa',name:'Proyecto QA',workspace_id:'w-qa'}
const user={id:'u-qa',email:'qa@atlas.test',name:'QA',platformAdmin:true}

afterEach(()=>{vi.restoreAllMocks()})
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(auth.session).mockResolvedValue(user)
 vi.mocked(auth.workspaceAccess).mockResolvedValue(owner)
 vi.mocked(auth.logout).mockResolvedValue(undefined)
 vi.mocked(workspaces.listWorkspaces).mockResolvedValue([workspace])
 vi.mocked(projects.listProjects).mockResolvedValue([project])
 vi.mocked(projects.projectAccess).mockResolvedValue(owner)
 vi.mocked(projects.loadDocument).mockResolvedValue({document:demoDocument(),version:1})
 vi.mocked(projects.saveDocument).mockResolvedValue(2)
 vi.mocked(projects.listDocumentVersions).mockResolvedValue([])
 vi.mocked(projects.renameProject).mockResolvedValue(project)
 vi.mocked(audit.listAuditEvents).mockResolvedValue({items:[],nextCursor:null})
})
async function openEditor(){
 render(<AtlasEditor/>)
 await screen.findByRole('heading',{name:'C1 · Contexto de Zercano'})
}

describe('Editor conectado a API — recorridos de comportamiento',()=>{
 it('propietario renombra el proyecto sin modificar el documento ni reiniciar el editor',async()=>{
  vi.spyOn(window,'prompt').mockReturnValue('Proyecto renombrado QA')
  vi.mocked(projects.renameProject).mockResolvedValue({...project,name:'Proyecto renombrado QA'})
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Renombrar'}))
  await waitFor(()=>expect(projects.renameProject).toHaveBeenCalledWith('p-qa','Proyecto renombrado QA'))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Proyecto renombrado QA'})).toBeTruthy())
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('autorizado accede al panel de auditoría desde el editor',async()=>{
  vi.mocked(audit.listAuditEvents).mockResolvedValue({items:[{id:'1',event_type:'project.renamed',actor_name:'QA',actor_email:null,resource_id:'p-qa',resource_name:'Proyecto QA',detail:{name:'Proyecto QA'},created_at:'2026-11-12T12:00:00Z'}],nextCursor:null})
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Actividad'}))
  expect(await screen.findByRole('dialog',{name:'Actividad y auditoría'})).toBeTruthy()
  expect(await screen.findByText('Proyecto renombrado')).toBeTruthy()
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
  const prompt=vi.spyOn(window,'prompt').mockReturnValue('Etiqueta actualizada')
  await openEditor()
  await waitFor(()=>expect(screen.getByRole('button',{name:'Editar relación QA'})).toBeTruthy())
  fireEvent.click(screen.getByRole('button',{name:'Editar relación QA'}))
  expect(prompt).toHaveBeenCalled()
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
  fireEvent.click(screen.getByRole('button',{name:'C1 · Contexto de Zercano'}))
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
 it('no duplica una relación si el usuario intenta conectar dos veces los mismos nodos',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Conectar QA'}))
  fireEvent.click(screen.getByRole('button',{name:'Conectar QA'}))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const edges=saves.at(-1)![1].diagrams[0].edges
   expect(edges.filter(e=>e.source==='n-actor'&&e.target==='n-payment-provider')).toHaveLength(1)
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
  fireEvent.click(screen.getByTitle('Ampliar lienzo'))
  expect(app.className).toContain('expanded')
  fireEvent.click(screen.getByTitle('Ampliar lienzo'))
  expect(app.className).not.toContain('expanded')
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('confirma el borrado de un diagrama sin borrar sus elementos reutilizables',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true)
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Eliminar diagrama'}))
  expect(screen.getByRole('heading',{name:'C2 · Contenedores'})).toBeTruthy()
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   const document=saves.at(-1)![1]
   expect(document.diagrams.some(d=>d.id==='c1')).toBe(false)
   expect(document.elements['platform'].id).toBe('platform')
  },{timeout:4500})
 })
 it('cancelar borrado de un diagrama y de una caja preserva datos',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(false)
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Eliminar diagrama'}))
  expect(screen.getByRole('heading',{name:'C1 · Contexto de Zercano'})).toBeTruthy()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:'Quitar caja de esta vista'}))
  expect(screen.getByRole('button',{name:'Plataforma Zercano'})).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('quitar una caja de la vista no elimina el elemento del catálogo global',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true)
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:'Quitar caja de esta vista'}))
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
  vi.spyOn(window,'prompt').mockReturnValueOnce('Documento de arquitectura').mockReturnValueOnce('https://example.com/arquitectura')
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:/^Agregar$/}))
  expect(screen.getByText('Documento de arquitectura')).toBeTruthy()
  fireEvent.click(screen.getByTitle('Quitar enlace'))
  await waitFor(()=>{
   const saves=vi.mocked(projects.saveDocument).mock.calls
   expect(saves.length).toBeGreaterThan(0)
   expect(saves.at(-1)![1].elements['platform'].links).toEqual([])
  },{timeout:4500})
 })
 it('rechaza enlaces JavaScript para evitar ejecución en ventanas externas',async()=>{
  vi.spyOn(window,'prompt').mockReturnValueOnce('Enlace inseguro').mockReturnValueOnce('javascript:alert(1)')
  await openEditor()
  fireEvent.click(await screen.findByRole('button',{name:'Plataforma Zercano'}))
  fireEvent.click(screen.getByRole('button',{name:/^Agregar$/}))
  expect(screen.getByText(/URL inválida/)).toBeTruthy()
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('conserva campos y valores de lista al editar un requerimiento compartido',async()=>{
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Trazabilidad · Pago'}))
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
  vi.spyOn(window,'confirm').mockReturnValue(true)
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  const oldCount=demoDocument().fieldDefinitions.length
  fireEvent.click(within(modal).getAllByTitle('Eliminar campo')[0])
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
 it('informa un fallo de exportación sin perder el documento local',async()=>{
  vi.mocked(projects.exportProject).mockRejectedValue(new Error('Exportación bloqueada'))
  await openEditor()
  fireEvent.click(screen.getByRole('button',{name:'Exportar'}))
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
  fireEvent.click(screen.getByRole('button',{name:'Proceso · Autenticación y pagos'}))
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
  vi.spyOn(window,'confirm').mockReturnValue(false)
  await openEditor()
  fireEvent.click(screen.getByTitle('Configuración de campos'))
  const modal=screen.getByRole('dialog',{name:'Campos personalizados por tipo de elemento'})
  fireEvent.click(within(modal).getAllByTitle('Eliminar campo')[0])
  expect(within(modal).getAllByTitle('Eliminar campo')).toHaveLength(demoDocument().fieldDefinitions.length)
  expect(projects.saveDocument).not.toHaveBeenCalled()
 })
 it('la importación validada usa la versión actual y recarga el documento autorizado',async()=>{
  const fixture=demoDocument()
  vi.mocked(projects.importProject).mockResolvedValue(5)
  vi.spyOn(window,'confirm').mockReturnValue(true)
  await openEditor()
  const file=new File([JSON.stringify({document:fixture})],'modelo-atlas.json',{type:'application/json'})
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify({document:fixture})})
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!,{target:{files:[file]}})
  await waitFor(()=>expect(projects.importProject).toHaveBeenCalledWith('p-qa',expect.objectContaining({schema:1}),1))
  await waitFor(()=>expect(screen.getByText(/Importación validada y guardada/)).toBeTruthy())
  expect(projects.loadDocument).toHaveBeenCalledTimes(2)
 })
 it('cancelar una importación autorizada evita escribir sobre el documento',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(false)
  await openEditor()
  const file=new File([JSON.stringify(demoDocument())],'modelo.json',{type:'application/json'})
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify(demoDocument())})
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!,{target:{files:[file]}})
  await waitFor(()=>expect(window.confirm).toHaveBeenCalled())
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
