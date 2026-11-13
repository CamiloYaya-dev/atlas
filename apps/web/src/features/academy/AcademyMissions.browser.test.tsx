import {afterEach,describe,it,expect,vi} from 'vitest'
import {act,fireEvent,render,screen} from '@testing-library/react'
import AcademyMissions,{ACADEMY_HINT_STORAGE_KEY,guidanceDirection} from './AcademyMissions'
import type {ComponentProps} from 'react'

function props(overrides:Partial<ComponentProps<typeof AcademyMissions>>={}):ComponentProps<typeof AcademyMissions>{
 return {lab:null,workspaces:[],projects:[],catalogLoading:false,activeWorkspaceId:'',activeProjectId:'',doc:null,saveStatus:'saved',mode:'functional',diagramId:'',busy:false,error:'',onClose:vi.fn(),onStartTour:vi.fn(),onCreateWorkspace:vi.fn(async()=>{}),onCreateProject:vi.fn(async()=>{}),onGoToLab:vi.fn(),onOpenDiagram:vi.fn(),onSelectDiagram:vi.fn(),onOpenNode:vi.fn(),onReuse:vi.fn(),onMixed:vi.fn(),onOpenFields:vi.fn(),onInspectElement:vi.fn(),...overrides}
}

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();window.localStorage.removeItem(ACADEMY_HINT_STORAGE_KEY)})
describe('ATLAS Academy · laboratorio en editor real',()=>{
 it('exige crear la organización antes del proyecto y no ejecuta la API sin clic',()=>{
  const actions=props();render(<AcademyMissions {...actions}/> )
  expect(screen.getByText('Crea tu espacio de formación')).toBeTruthy()
  expect(actions.onCreateWorkspace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:/Crear mi organización/}))
  expect(actions.onCreateWorkspace).toHaveBeenCalledWith('ATLAS · Academia personal')
 })
 it('solicita proyecto sólo dentro del espacio real seleccionado',()=>{
  const actions=props({lab:{workspaceId:'lab-1'},workspaces:[{id:'lab-1',name:'Academia ATLAS',role:'owner'}],activeWorkspaceId:'lab-1'})
  render(<AcademyMissions {...actions}/> )
  expect(screen.getByText('Crea un proyecto de aprendizaje')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Crear mi proyecto/}))
  expect(actions.onCreateProject).toHaveBeenCalledWith('Laboratorio · Solicitudes')
 })
 it('rechaza evaluar otro proyecto, ofreciendo volver al laboratorio',()=>{
  const actions=props({lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia ATLAS',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Prácticas'}],activeWorkspaceId:'w',activeProjectId:'otro'})
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
  const a=props({lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia ATLAS',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Laboratorio'}],activeWorkspaceId:'w',activeProjectId:'p',doc})
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
