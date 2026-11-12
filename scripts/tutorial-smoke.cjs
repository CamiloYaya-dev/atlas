// Standalone React/jsdom smoke runner for environments lacking Rollup native binaries.
// Not a substitute for the full Vitest+browser suite.
const fs=require('node:fs')
const path=require('node:path')
const assert=require('node:assert/strict')
const ts=require('typescript')
require.extensions['.tsx']=require.extensions['.ts']=function(mod,file){
 const source=fs.readFileSync(file,'utf8')
 const result=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}})
 mod._compile(result.outputText,file)
}
const {JSDOM}=require('jsdom')
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'})
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,MutationObserver:dom.window.MutationObserver})
window.requestAnimationFrame=(fn)=>setTimeout(fn,0)
window.cancelAnimationFrame=clearTimeout
const React=require('react')
const {render,fireEvent,screen,cleanup,within}=require('@testing-library/react')
const Guide=require('../apps/web/src/features/tutorial/GuidedTutorial.tsx').default
const {TUTORIAL_STEPS,TUTORIAL_STORAGE_KEY}=require('../apps/web/src/features/tutorial/tutorial-content.ts')
async function check(name,fn){cleanup();document.body.innerHTML='';window.localStorage.clear();await fn();console.log('PASS',name)}
;(async()=>{
 await check('tutorial empieza y permite avanzar/retroceder',()=>{
  render(React.createElement(Guide,{onClose:()=>{}}))
  assert(screen.getByText('Bienvenido a ATLAS'))
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  assert(screen.getByText('1. Organización = espacio de trabajo'))
  fireEvent.click(screen.getByRole('button',{name:/Anterior/}))
  assert(screen.getByText('Bienvenido a ATLAS'))
 })
 await check('ejercicio de jerarquia',()=>{
  render(React.createElement(Guide,{onClose:()=>{}}))
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  const e=screen.getByLabelText('Ejercicio de navegación')
  for(const title of ['Organización','Proyecto','Diagrama'])fireEvent.click(within(e).getByRole('button',{name:title}))
  assert(screen.getByText('Práctica completada'))
 })
 await check('temario y completar',()=>{
  let closed=0;render(React.createElement(Guide,{onClose:()=>{closed++}}))
  fireEvent.click(screen.getByRole('button',{name:/Temario/}))
  fireEvent.click(within(screen.getByRole('navigation',{name:'Temario del tutorial'})).getByRole('button',{name:new RegExp(`^${TUTORIAL_STEPS.length}\\.`)}))
  fireEvent.click(screen.getByRole('button',{name:'Finalizar'}))
  assert.equal(closed,1);assert(window.localStorage.getItem(TUTORIAL_STORAGE_KEY))
 })
 await check('cerrar no marca completado',()=>{
  let closed=0;render(React.createElement(Guide,{onClose:()=>{closed++}}))
  fireEvent.click(screen.getByRole('button',{name:'Cerrar tutorial'}))
  assert.equal(closed,1);assert.equal(window.localStorage.getItem(TUTORIAL_STORAGE_KEY),null)
 })
 await check('practica relacion y vista tecnica',()=>{
  render(React.createElement(Guide,{onClose:()=>{}}))
  fireEvent.click(screen.getByRole('button',{name:/Temario/}))
  fireEvent.click(within(screen.getByRole('navigation',{name:'Temario del tutorial'})).getByRole('button',{name:/^9\./}))
  const e=screen.getByLabelText('Ejercicio de relaciones')
  fireEvent.click(within(e).getByRole('button',{name:'Editor web'}))
  fireEvent.click(within(e).getByRole('button',{name:'API de proyectos'}))
  assert(screen.getByText('Práctica completada'))
 })
 await check('retoma el paso tras un formulario temporal',()=>{
  const first=render(React.createElement(Guide,{onClose:()=>{}}))
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
  first.unmount()
  render(React.createElement(Guide,{onClose:()=>{}}))
  assert(screen.getByText('2. Un proyecto es el límite del modelo'))
 })
 await check('controles ausentes no detienen la leccion',()=>{
  render(React.createElement(Guide,{onClose:()=>{}}))
  assert(screen.getByText(/Este control no está visible ahora/))
 })
 console.log('Tutorial smoke 7/7 OK')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{setTimeout(()=>dom.window.close(),50)})
