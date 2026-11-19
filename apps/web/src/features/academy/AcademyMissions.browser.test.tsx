import {afterEach,describe,it,expect,vi} from 'vitest'
import {act,fireEvent,render,screen,within} from '@testing-library/react'
import AcademyMissions,{ACADEMY_HINT_STORAGE_KEY,guidanceDirection} from './AcademyMissions'
import type {ComponentProps} from 'react'
import type {Diagram,ElementType,ProjectDocument} from '@novzi/contracts'

function props(overrides:Partial<ComponentProps<typeof AcademyMissions>>={}):ComponentProps<typeof AcademyMissions>{
 return {lab:null,workspaces:[],projects:[],catalogLoading:false,activeWorkspaceId:'',activeProjectId:'',doc:null,saveStatus:'saved',mode:'functional',diagramId:'',busy:false,error:'',onClose:vi.fn(),onStartTour:vi.fn(),onCreateWorkspace:vi.fn(async()=>{}),onCreateProject:vi.fn(async()=>{}),onGoToLab:vi.fn(),onOpenDiagram:vi.fn(),onSelectDiagram:vi.fn(),onOpenNode:vi.fn(),onReuse:vi.fn(),onMixed:vi.fn(),onOpenFields:vi.fn(),onInspectElement:vi.fn(),...overrides}
}

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();window.localStorage.removeItem(ACADEMY_HINT_STORAGE_KEY)})
describe('NOVZI Academy · laboratorio en editor real',()=>{
 it('exige crear la organización antes del proyecto y no ejecuta la API sin clic',()=>{
  const actions=props();render(<AcademyMissions {...actions}/> )
  expect(screen.getByText('Crea tu espacio de formación')).toBeTruthy()
  expect(actions.onCreateWorkspace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:/Crear mi organización/}))
  expect(actions.onCreateWorkspace).toHaveBeenCalledWith('NOVZI · Academia personal')
 })
 it('solicita proyecto sólo dentro del espacio real seleccionado',()=>{
  const actions=props({lab:{workspaceId:'lab-1'},workspaces:[{id:'lab-1',name:'Academia NOVZI',role:'owner'}],activeWorkspaceId:'lab-1'})
  render(<AcademyMissions {...actions}/> )
  expect(screen.getByText('Crea un proyecto de aprendizaje')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Crear mi proyecto/}))
  expect(actions.onCreateProject).toHaveBeenCalledWith('Laboratorio · Solicitudes')
 })
 it('rechaza evaluar otro proyecto, ofreciendo volver al laboratorio',()=>{
  const actions=props({lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia NOVZI',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Prácticas'}],activeWorkspaceId:'w',activeProjectId:'otro'})
  render(<AcademyMissions {...actions}/>)
  expect(screen.queryByText('Modelado funcional')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:/Abrir laboratorio/}))
  expect(actions.onGoToLab).toHaveBeenCalledOnce()
 })
 it('distingue si la tarea está por encima, debajo o visible en el panel',()=>{
  const view={top:100,bottom:400}
  expect(guidanceDirection({top:20,bottom:90},view)).toBe('up')
  expect(guidanceDirection({top:430,bottom:470},view)).toBe('down')
  expect(guidanceDirection({top:250,bottom:300},view)).toBe('visible')
 })
 it('señala la tarea pendiente tras 1 minuto, muestra dirección y no desplaza sin autorización',()=>{
  window.localStorage.setItem(ACADEMY_HINT_STORAGE_KEY,'1')
  vi.useFakeTimers()
  const doc={schema:1 as const,elements:{},diagrams:[],fieldDefinitions:[]}
  const a=props({lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia NOVZI',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Laboratorio'}],activeWorkspaceId:'w',activeProjectId:'p',doc})
  const spy=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
   const rect=this.classList.contains('academy-missions-content')?{top:100,bottom:400}:this.closest?.('[data-academy-check="c1"]')?{top:600,bottom:680}:{top:0,bottom:0}
   return {...rect,left:0,right:350,width:350,height:rect.bottom-rect.top,x:0,y:rect.top,toJSON:()=>({})} as DOMRect
  })
  render(<AcademyMissions {...a}/> )
  const target=document.querySelector('[data-academy-check="c1"]')!
  expect(target.classList.contains('academy-attention')).toBe(false)
  act(()=>vi.advanceTimersByTime(59_000))
  expect(screen.queryByRole('button',{name:/Baja para encontrar tu siguiente acción/})).toBeNull()
  act(()=>vi.advanceTimersByTime(1_001))
  expect(target.classList.contains('academy-attention')).toBe(true)
  expect(screen.getByRole('button',{name:/Baja para encontrar tu siguiente acción/})).toBeTruthy()
  // Merely scrolling doesn't reset an already-active guide.
  act(()=>fireEvent.scroll(window))
  expect(target.classList.contains('academy-attention')).toBe(true)
  spy.mockRestore()
 })
 it('permite desactivar recordatorios y conserva el ajuste',()=>{
  const a=props()
  render(<AcademyMissions {...a}/> )
  fireEvent.change(screen.getByRole('combobox',{name:'Tiempo de inactividad para recibir ayuda'}),{target:{value:'0'}})
  expect(window.localStorage.getItem(ACADEMY_HINT_STORAGE_KEY)).toBe('0')
 })

})


it('recuperación del catálogo protege la creación duplicada y permite abrir el recorrido',()=>{
 const a=props({catalogLoading:true});render(<AcademyMissions {...a}/>);expect(screen.getByText('Recuperando tu laboratorio…')).toBeTruthy();expect(screen.queryByRole('button',{name:/Crear mi organización/})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:/Primero ver el recorrido/}));expect(a.onStartTour).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Cerrar misiones'}));expect(a.onClose).toHaveBeenCalledOnce();expect(a.onCreateWorkspace).not.toHaveBeenCalled()
})
it('valida nombre de organización y entrega el nombre limpio al editor',()=>{
 const a=props();render(<AcademyMissions {...a}/>);const input=screen.getByLabelText('Nombre del espacio de formación'),create=screen.getByRole('button',{name:/Crear mi organización/}) as HTMLButtonElement
 fireEvent.change(input,{target:{value:' '}});expect(create.disabled).toBe(true);fireEvent.change(input,{target:{value:'  Organización QA  '}});expect(create.disabled).toBe(false);fireEvent.click(create);expect(a.onCreateWorkspace).toHaveBeenCalledWith('Organización QA')
})
it('no crea un proyecto en la organización que no está activa',()=>{
 const a=props({lab:{workspaceId:'lab-1'},workspaces:[{id:'lab-1',name:'Academia NOVZI',role:'owner'}],activeWorkspaceId:'otro'});render(<AcademyMissions {...a}/>);fireEvent.click(screen.getByRole('button',{name:/Ir a la organización de práctica/}));expect(a.onGoToLab).toHaveBeenCalledOnce();expect(a.onCreateProject).not.toHaveBeenCalled()
})
it('permite iniciar tareas funcionales, mantiene las otras insignias bloqueadas y no cambia el modelo',()=>{
 const doc={schema:1 as const,elements:{},diagrams:[],fieldDefinitions:[]},a=props({lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Laboratorio'}],activeWorkspaceId:'w',activeProjectId:'p',doc})
 render(<AcademyMissions {...a}/>);fireEvent.click(within(document.querySelector('[data-academy-check="c1"]') as HTMLElement).getByRole('button',{name:'Crear C1'}));expect(a.onOpenDiagram).toHaveBeenCalledWith('c1',expect.any(String))
 fireEvent.click(screen.getByRole('button',{name:'Arquitecto técnico: pendiente'}));expect(screen.getByText(/Termina los ejercicios funcionales/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Arquitectura conectada: pendiente'}));expect(screen.getByText(/La insignia mixta se desbloquea/)).toBeTruthy();expect(doc.diagrams).toEqual([])
})


function academyFixture():ProjectDocument{
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
 addDiagram('c1','c1',['actor','system','process'],[[0,1],[1,2]])
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

function inLab(doc:ProjectDocument,overrides:Partial<ComponentProps<typeof AcademyMissions>>={}){
 return props({lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Laboratorio'}],activeWorkspaceId:'w',activeProjectId:'p',doc,...overrides})
}
it('ejercicios funcionales incompletos permiten seleccionar requisito, configurar campo y reutilizar sin duplicar',()=>{
 const doc=academyFixture();doc.elements.hu.description='';delete doc.elements.hu.fields['training-channel'];doc.diagrams.find(d=>d.type==='process')!.nodes=doc.diagrams.find(d=>d.type==='process')!.nodes.filter(n=>n.elementId!=='hu')
 const a=inLab(doc);render(<AcademyMissions {...a}/>);const row=(id:string)=>within(document.querySelector(`[data-academy-check="${id}"]`) as HTMLElement)
 fireEvent.click(row('functional-inspector').getByRole('button',{name:'Seleccionar la caja'}));expect(a.onInspectElement).toHaveBeenCalledWith('functional')
 fireEvent.click(row('functional-field').getByRole('button',{name:'Muéstrame dónde'}));expect(a.onOpenFields).toHaveBeenCalledWith('functional')
 fireEvent.click(row('functional-reuse').getByRole('button',{name:'Reutilizar caja'}));expect(a.onReuse).toHaveBeenCalledWith('process')
 fireEvent.click(screen.getByRole('button',{name:/Persona solicitante/}));expect(a.onOpenNode).toHaveBeenCalledWith('actor','Persona solicitante','c1')
})
it('ruta técnica desbloqueada señala enlaces faltantes y conserva los enlaces ya guardados',()=>{
 const doc=academyFixture();doc.elements.api.childDiagramId=undefined;doc.elements.endpoint.technical='';delete doc.elements.endpoint.fields['training-protocol']
 const focus=vi.fn(),a=inLab(doc,{onFocusLinkSource:focus});render(<AcademyMissions {...a}/>);fireEvent.click(screen.getByRole('button',{name:'Arquitecto técnico: pendiente'}))
 const guide=screen.getByRole('group',{name:'Guía para enlazar los niveles C1 a C4'});expect(within(guide).getAllByText('Vista vinculada correctamente')).toHaveLength(2)
 fireEvent.click(within(guide).getByRole('button',{name:'Seleccionar caja de C2'}));expect(focus).toHaveBeenCalledWith('c2','service')
 const row=(id:string)=>within(document.querySelector(`[data-academy-check="${id}"]`) as HTMLElement)
 fireEvent.click(row('technical-field').getByRole('button',{name:'Muéstrame dónde'}));expect(a.onOpenFields).toHaveBeenCalledWith('technical')
 fireEvent.click(row('technical-inspector').getByRole('button',{name:'Seleccionar la caja'}));expect(a.onInspectElement).toHaveBeenCalledWith('technical')
})
it('integración completa se acredita únicamente con la perspectiva mixta sobre trazabilidad guardada',()=>{
 const doc=academyFixture(),a=inLab(doc,{mode:'technical',diagramId:'c3'});const view=render(<AcademyMissions {...a}/>);fireEvent.click(screen.getByRole('button',{name:'Arquitectura conectada: pendiente'}))
 fireEvent.click(screen.getByRole('button',{name:/Abrir trazabilidad en modo mixto/}));expect(a.onMixed).toHaveBeenCalledOnce()
 view.rerender(<AcademyMissions {...a} mode="mixed" diagramId="trace"/>);expect(screen.getByRole('button',{name:'Arquitectura conectada: conseguida'})).toBeTruthy();expect(screen.getByText(/Insignia «Arquitectura conectada» conseguida/)).toBeTruthy()
 view.rerender(<AcademyMissions {...a} mode="mixed" diagramId="trace" saveStatus="pending"/>);expect(screen.getByRole('button',{name:'Arquitectura conectada: pendiente'})).toBeTruthy()
})

it('si falta callback de foco, la guía navega al nivel C2 sin escribir el modelo',()=>{
 const doc=academyFixture();doc.elements.api.childDiagramId=undefined
 const a=inLab(doc);render(<AcademyMissions {...a}/>);fireEvent.click(screen.getByRole('button',{name:'Arquitecto técnico: pendiente'}));const guide=screen.getByRole('group',{name:'Guía para enlazar los niveles C1 a C4'});fireEvent.click(within(guide).getByRole('button',{name:'Seleccionar caja de C2'}));expect(a.onSelectDiagram).toHaveBeenCalledWith('c2');expect(a.onOpenNode).not.toHaveBeenCalled()
})
it('los recordatorios siguen funcionando si guardar la preferencia está bloqueado',()=>{
 const a=props();const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('Storage no disponible')});render(<AcademyMissions {...a}/>);const select=screen.getByRole('combobox',{name:'Tiempo de inactividad para recibir ayuda'}) as HTMLSelectElement;fireEvent.change(select,{target:{value:'3'}});expect(select.value).toBe('3');spy.mockRestore()
})
it('guía reacciona al puntero y solo desplaza la tarea al pulsar el recordatorio',()=>{
 window.localStorage.setItem(ACADEMY_HINT_STORAGE_KEY,'1');vi.useFakeTimers();const a=inLab({schema:1,elements:{},diagrams:[],fieldDefinitions:[]})
 const rect=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const r=this.classList.contains('academy-missions-content')?{top:100,bottom:400}:this.closest?.('[data-academy-check="c1"]')?{top:20,bottom:70}:{top:0,bottom:0};return {...r,left:0,right:350,width:350,height:r.bottom-r.top} as DOMRect})
 const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView'),scroll=vi.fn();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll})
 try{const view=render(<AcademyMissions {...a}/>);act(()=>vi.advanceTimersByTime(50_000));fireEvent(window,new MouseEvent('pointermove'));act(()=>vi.advanceTimersByTime(20_000));expect(screen.queryByRole('button',{name:/Sube para encontrar/})).toBeNull();act(()=>vi.advanceTimersByTime(40_001));const button=screen.getByRole('button',{name:/Sube para encontrar/});expect(scroll).not.toHaveBeenCalled();fireEvent.click(button);expect(scroll).toHaveBeenCalledWith({behavior:'smooth',block:'center'});view.unmount()}finally{rect.mockRestore();if(descriptor)Object.defineProperty(HTMLElement.prototype,'scrollIntoView',descriptor);else Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView')}
})
