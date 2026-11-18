import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import GuidedTutorial,{getPosition} from './GuidedTutorial'
import {TUTORIAL_STEPS,TUTORIAL_STORAGE_KEY,TUTORIAL_PROGRESS_KEY} from './tutorial-content'

beforeEach(()=>{window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);window.localStorage.removeItem(TUTORIAL_PROGRESS_KEY)})
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks()})
describe('Academia NOVZI · tutorial contextual no destructivo',()=>{
 it('enseña el objetivo de NOVZI y permite avanzar y retroceder',()=>{
  render(<GuidedTutorial onClose={vi.fn()}/> )
  expect(screen.getByText('Bienvenido a NOVZI')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  expect(screen.getByText('1. Organización = espacio de trabajo')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Anterior/}))
  expect(screen.getByText('Bienvenido a NOVZI')).toBeTruthy()
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
  expect(screen.getByText(/Equipo NOVZI/)).toBeTruthy()
  expect(screen.getByText('Ejemplo NOVZI:')).toBeTruthy()
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
  const card=screen.getByRole('dialog',{name:'Bienvenido a NOVZI'})
  const index=within(card).getByRole('navigation',{name:'Temario del tutorial'})
  expect(index.compareDocumentPosition(within(card).getByRole('button',{name:/Siguiente/})) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
 })
 it('si no hay controles visibles, la explicación permanece disponible',()=>{
  render(<GuidedTutorial onClose={vi.fn()}/> )
  expect(screen.getByText(/Este control no está visible ahora/)).toBeTruthy()
 })
})

it('atajos Alt recorren pasos sin salirse del temario y recuperan el foco al desmontar',()=>{
 const origin=document.createElement('button');document.body.appendChild(origin);origin.focus()
 const view=render(<GuidedTutorial onClose={vi.fn()}/>);fireEvent.keyDown(document,{key:'ArrowLeft',altKey:true});expect(screen.getByText('Bienvenido a NOVZI')).toBeTruthy()
 fireEvent.keyDown(document,{key:'ArrowRight'});expect(screen.getByText('Bienvenido a NOVZI')).toBeTruthy()
 for(let i=0;i<TUTORIAL_STEPS.length+2;i++)fireEvent.keyDown(document,{key:'ArrowRight',altKey:true})
 expect(screen.getByRole('button',{name:'Finalizar'})).toBeTruthy();view.unmount();expect(document.activeElement).toBe(origin);origin.remove()
})
it('posiciona a izquierda, debajo, encima o junto al lienzo sin tapar el ancla cuando hay espacio',()=>{
 const w=window.innerWidth,h=window.innerHeight;Object.defineProperty(window,'innerWidth',{configurable:true,value:800});Object.defineProperty(window,'innerHeight',{configurable:true,value:800})
 try{
  const anchor=document.createElement('div'),card=document.createElement('div');vi.spyOn(card,'getBoundingClientRect').mockReturnValue({width:300,height:250} as DOMRect)
  const rect=vi.spyOn(anchor,'getBoundingClientRect')
  const position=(x:number,y:number,width:number,height:number)=>{rect.mockReturnValue({left:x,top:y,right:x+width,bottom:y+height,width,height} as DOMRect);return getPosition(anchor,card)}
  expect(position(40,80,100,50).left).toBeGreaterThan(140)
  expect(position(650,80,100,50).left).toBeLessThan(650-300)
  expect(position(250,50,300,50).arrow).toBe('top')
  expect(position(250,690,300,50).arrow).toBe('bottom')
  const canvas=position(0,0,800,800);expect(canvas.focused).toBe(true);expect(canvas.left+300).toBeLessThanOrEqual(800)
 }finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:w});Object.defineProperty(window,'innerHeight',{configurable:true,value:h})}
})
it('un almacenamiento inaccesible no impide aprender ni finalizar',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('denied')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('denied')})
 const close=vi.fn();render(<GuidedTutorial onClose={close}/>);expect(screen.getByText('Bienvenido a NOVZI')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Temario'}));fireEvent.click(within(screen.getByRole('navigation',{name:'Temario del tutorial'})).getByRole('button',{name:new RegExp(`^${TUTORIAL_STEPS.length}\\.`)}));fireEvent.click(screen.getByRole('button',{name:'Finalizar'}));expect(close).toHaveBeenCalledOnce()
})

it('resalta un ancla visible, elimina el resaltado si queda fuera y lo recupera al volver',async()=>{
 const anchor=document.createElement('button');anchor.dataset.tour=TUTORIAL_STEPS[0].target;document.body.appendChild(anchor)
 const rect=vi.spyOn(anchor,'getBoundingClientRect');const visible={left:15,top:40,right:95,bottom:80,width:80,height:40} as DOMRect;rect.mockReturnValue(visible)
 const view=render(<GuidedTutorial onClose={vi.fn()}/>);try{
  await waitFor(()=>expect(anchor.classList.contains('novzi-tour-highlight')).toBe(true));expect(screen.queryByText(/Este control no está visible ahora/)).toBeNull()
  rect.mockReturnValue({...visible,width:0});fireEvent(window,new Event('resize'));expect(anchor.classList.contains('novzi-tour-highlight')).toBe(false);expect(screen.getByText(/Este control no está visible ahora/)).toBeTruthy()
  rect.mockReturnValue({...visible,right:-1,left:-81});fireEvent(window,new Event('scroll'));expect(anchor.classList.contains('novzi-tour-highlight')).toBe(false)
  rect.mockReturnValue(visible);fireEvent(window,new Event('resize'));expect(anchor.classList.contains('novzi-tour-highlight')).toBe(true)
 }finally{view.unmount();expect(anchor.classList.contains('novzi-tour-highlight')).toBe(false);anchor.remove()}
})
it.each(['-1','1.2','9999','NaN'])('ignora progreso de tutorial inválido %s',value=>{
 window.localStorage.setItem(TUTORIAL_PROGRESS_KEY,value);render(<GuidedTutorial onClose={vi.fn()}/>);expect(screen.getByRole('dialog',{name:'Bienvenido a NOVZI'})).toBeTruthy();expect(window.localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('0')
})

it('reposiciona una tarjeta cuando el ancla queda fuera por arriba, derecha o debajo',async()=>{
 const anchor=document.createElement('button');anchor.dataset.tour=TUTORIAL_STEPS[0].target;document.body.appendChild(anchor);const base={left:20,right:100,top:20,bottom:60,width:80,height:40} as DOMRect;const rect=vi.spyOn(anchor,'getBoundingClientRect').mockReturnValue(base);const view=render(<GuidedTutorial onClose={vi.fn()}/>);
 try{await waitFor(()=>expect(anchor.classList.contains('novzi-tour-highlight')).toBe(true));for(const r of [{...base,height:1},{...base,top:-80,bottom:-40},{...base,left:window.innerWidth+1,right:window.innerWidth+81},{...base,top:window.innerHeight+1,bottom:window.innerHeight+41}]){rect.mockReturnValue(r);fireEvent(window,new Event('resize'));expect(anchor.classList.contains('novzi-tour-highlight')).toBe(false);rect.mockReturnValue(base);fireEvent(window,new Event('resize'));expect(anchor.classList.contains('novzi-tour-highlight')).toBe(true)}}finally{view.unmount();anchor.remove()}
})

it('el observador de tamaño reposiciona la guía y se desconecta al cerrar',async()=>{
 let refresh:()=>void=()=>{};const observe=vi.fn(),disconnect=vi.fn();class Observer{constructor(callback:()=>void){refresh=callback} observe=observe;disconnect=disconnect}
 vi.stubGlobal('ResizeObserver',Observer)
 const anchor=document.createElement('button');anchor.dataset.tour=TUTORIAL_STEPS[0].target;document.body.appendChild(anchor);const base={left:20,right:100,top:20,bottom:60,width:80,height:40} as DOMRect;const rect=vi.spyOn(anchor,'getBoundingClientRect').mockReturnValue(base)
 const view=render(<GuidedTutorial onClose={vi.fn()}/>);try{await waitFor(()=>expect(anchor.classList.contains('novzi-tour-highlight')).toBe(true));expect(observe).toHaveBeenCalled();rect.mockReturnValue({...base,width:0});await import('@testing-library/react').then(({act})=>act(()=>refresh()));expect(anchor.classList.contains('novzi-tour-highlight')).toBe(false)}finally{view.unmount();anchor.remove();vi.unstubAllGlobals()}expect(disconnect).toHaveBeenCalled()
})
