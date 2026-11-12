import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,within} from '@testing-library/react'
import GuidedTutorial,{getPosition} from './GuidedTutorial'
import {TUTORIAL_STEPS,TUTORIAL_STORAGE_KEY,TUTORIAL_PROGRESS_KEY} from './tutorial-content'

beforeEach(()=>{window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);window.localStorage.removeItem(TUTORIAL_PROGRESS_KEY)})
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks()})
describe('Academia ATLAS · tutorial contextual no destructivo',()=>{
 it('enseña el objetivo de ATLAS y permite avanzar y retroceder',()=>{
  render(<GuidedTutorial onClose={vi.fn()}/> )
  expect(screen.getByText('Bienvenido a ATLAS')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  expect(screen.getByText('1. Organización = espacio de trabajo')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Anterior/}))
  expect(screen.getByText('Bienvenido a ATLAS')).toBeTruthy()
 })
 it('permite practicar la jerarquía sin llamar a APIs y registra el resultado',()=>{
  render(<GuidedTutorial onClose={vi.fn()}/> )
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  const exercise=screen.getByLabelText('Ejercicio de navegación')
  fireEvent.click(within(exercise).getByRole('button',{name:'Organización'}))
  fireEvent.click(within(exercise).getByRole('button',{name:'Proyecto'}))
  fireEvent.click(within(exercise).getByRole('button',{name:'Diagrama'}))
  expect(screen.getByText('Práctica completada')).toBeTruthy()
 })
 it('permite ir al temario, saltar a la última lección y finalizar sin tocar el servidor',()=>{
  const close=vi.fn()
  render(<GuidedTutorial onClose={close}/> )
  fireEvent.click(screen.getByRole('button',{name:/Temario/}))
  const nav=screen.getByRole('navigation',{name:'Temario del tutorial'})
  fireEvent.click(within(nav).getByRole('button',{name:new RegExp(`^${TUTORIAL_STEPS.length}\\.`)}))
  fireEvent.click(screen.getByRole('button',{name:'Finalizar'}))
  expect(close).toHaveBeenCalledOnce()
  expect(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeTruthy()
 })
 it('cerrar no marca el tutorial como completado',()=>{
  const close=vi.fn()
  render(<GuidedTutorial onClose={close}/> )
  fireEvent.click(screen.getByRole('button',{name:'Cerrar tutorial'}))
  expect(close).toHaveBeenCalledOnce()
  expect(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeNull()
 })
 it('recupera el último paso tras pausar por una ventana del editor',()=>{
  const first=render(<GuidedTutorial onClose={vi.fn()}/> )
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  expect(screen.getByText('2. Un proyecto es el límite del modelo')).toBeTruthy()
  first.unmount()
  render(<GuidedTutorial onClose={vi.fn()}/> )
  expect(screen.getByText('2. Un proyecto es el límite del modelo')).toBeTruthy()
 })
 it('escapar cierra con teclado y no usa ventanas nativas',()=>{
  const close=vi.fn()
  const nativeAlert=vi.spyOn(window,'alert').mockImplementation(()=>{})
  const nativeConfirm=vi.spyOn(window,'confirm').mockImplementation(()=>true)
  render(<GuidedTutorial onClose={close}/> )
  fireEvent.keyDown(document,{key:'Escape'})
  expect(close).toHaveBeenCalledOnce()
  expect(nativeAlert).not.toHaveBeenCalled()
  expect(nativeConfirm).not.toHaveBeenCalled()
 })
 it('no atribuye la academia a una empresa cliente ni sugiere que sus datos son la demo',()=>{
  expect(JSON.stringify(TUTORIAL_STEPS).toLowerCase()).not.toContain('zercano')
  render(<GuidedTutorial onClose={vi.fn()}/> )
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  expect(screen.getByText(/Equipo ATLAS/)).toBeTruthy()
  expect(screen.getByText('Ejemplo ATLAS:')).toBeTruthy()
 })
 it('sitúa todo el panel dentro del viewport cuando el control está abajo',()=>{
  const originalWidth=window.innerWidth,originalHeight=window.innerHeight
  try{
   Object.defineProperty(window,'innerWidth',{configurable:true,value:1650})
   Object.defineProperty(window,'innerHeight',{configurable:true,value:900})
   const target=document.createElement('div')
   const panel=document.createElement('div')
   vi.spyOn(target,'getBoundingClientRect').mockReturnValue({left:20,right:220,top:680,bottom:730,width:200,height:50} as DOMRect)
   vi.spyOn(panel,'getBoundingClientRect').mockReturnValue({left:0,right:394,top:0,bottom:650,width:394,height:650} as DOMRect)
   const result=getPosition(target,panel)
   expect(result.focused).toBe(true)
   expect(result.left).toBeGreaterThanOrEqual(12)
   expect(result.top).toBeGreaterThanOrEqual(12)
   expect(result.top+650).toBeLessThanOrEqual(900-12)
   expect(result.left+394).toBeLessThanOrEqual(1650-12)
  }finally{
   Object.defineProperty(window,'innerWidth',{configurable:true,value:originalWidth})
   Object.defineProperty(window,'innerHeight',{configurable:true,value:originalHeight})
  }
 })
 it('mantiene accesibles los botones de navegación incluso con temario abierto',()=>{
  render(<GuidedTutorial onClose={vi.fn()}/> )
  fireEvent.click(screen.getByRole('button',{name:'Temario'}))
  const card=screen.getByRole('dialog',{name:'Bienvenido a ATLAS'})
  const index=within(card).getByRole('navigation',{name:'Temario del tutorial'})
  expect(index.compareDocumentPosition(within(card).getByRole('button',{name:/Siguiente/})) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
 })
 it('si no hay controles visibles, la explicación permanece disponible',()=>{
  render(<GuidedTutorial onClose={vi.fn()}/> )
  expect(screen.getByText(/Este control no está visible ahora/)).toBeTruthy()
 })
})
