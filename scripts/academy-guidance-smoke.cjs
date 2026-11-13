// Limited local React/jsdom smoke checks for the Academy idle helper.
// No API or DB writes. Not a replacement for Vitest/E2E.
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript')
require.extensions['.css']=function(){}
require.extensions['.ts']=require.extensions['.tsx']=function(mod,file){
 const {outputText}=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}})
 mod._compile(outputText,file)
}
const {JSDOM}=require('jsdom')
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'})
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,MutationObserver:dom.window.MutationObserver,Node:dom.window.Node})
const React=require('react');const {render,fireEvent,screen,cleanup,waitFor}=require('@testing-library/react')
const Academy=require('../apps/web/src/features/academy/AcademyMissions.tsx')
const {assessAcademy}=require('../apps/web/src/features/academy/progress.ts')
const f=()=>{};
function props(overrides={}){return {lab:{workspaceId:'w',projectId:'p'},workspaces:[{id:'w',name:'Academia ATLAS',role:'owner'}],projects:[{id:'p',workspace_id:'w',name:'Laboratorio'}],catalogLoading:false,activeWorkspaceId:'w',activeProjectId:'p',doc:{schema:1,elements:{},diagrams:[],fieldDefinitions:[]},saveStatus:'saved',mode:'functional',diagramId:'',busy:false,error:'',onClose:f,onStartTour:f,onCreateWorkspace:f,onCreateProject:f,onGoToLab:f,onOpenDiagram:f,onSelectDiagram:f,onOpenNode:f,onReuse:f,onMixed:f,onOpenFields:f,onInspectElement:f,...overrides}}
let position='down'
HTMLElement.prototype.getBoundingClientRect=function(){
 const rect=this.classList.contains('academy-missions-content')?{top:100,bottom:400}:this.closest?.('[data-academy-check=\"c1\"]')?position==='down'?{top:460,bottom:530}:position==='up'?{top:10,bottom:55}:{top:190,bottom:230}:{top:0,bottom:0}
 return {...rect,x:0,y:rect.top,width:350,height:rect.bottom-rect.top,left:0,right:350,toJSON:()=>({})}
}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const originalTimer=global.setTimeout
// Scale only the Academy idle timeout to 30ms to test real timer behavior cheaply.
global.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms>=60_000?30:ms,...args)
;(async()=>{
  assert.equal(Academy.guidanceDirection({top:450,bottom:480},{top:100,bottom:400}),'down')
  assert.equal(Academy.guidanceDirection({top:5,bottom:60},{top:100,bottom:400}),'up')
  assert.equal(Academy.guidanceDirection({top:150,bottom:200},{top:100,bottom:400}),'visible')
  console.log('PASS guidance direction: up, down, visible')
  window.localStorage.setItem(Academy.ACADEMY_HINT_STORAGE_KEY,'1')
  render(React.createElement(Academy.default,props()))
  await waitFor(()=>assert(screen.getByRole('button',{name:/Baja para encontrar tu siguiente acción/})),{timeout:1200})
  assert(document.querySelector('.academy-check.academy-attention'))
  console.log('PASS delayed hint highlights actual pending task')
  position='visible';fireEvent.scroll(document.querySelector('.academy-missions-content'))
  await waitFor(()=>assert.equal(screen.queryByRole('button',{name:/Baja para encontrar tu siguiente acción/}),null),{timeout:1200})
  assert(document.querySelector('.academy-check.academy-attention'))
  console.log('PASS directional prompt disappears on visible target, but attention persists')
  position='up';fireEvent.scroll(document.querySelector('.academy-missions-content'))
  await waitFor(()=>assert(screen.getByRole('button',{name:/Sube para encontrar tu siguiente acción/})),{timeout:1200})
  console.log('PASS directional prompt returns on leaving focus')
  fireEvent.change(screen.getByRole('combobox',{name:'Tiempo de inactividad para recibir ayuda'}),{target:{value:'0'}})
  assert.equal(window.localStorage.getItem(Academy.ACADEMY_HINT_STORAGE_KEY),'0')
  await waitFor(()=>assert.equal(document.querySelectorAll('.academy-attention').length,0))
  console.log('PASS settings persisted and guide turns off')
  cleanup();window.localStorage.clear()
  const calls=[]
  const actions=props({lab:null,workspaces:[],projects:[],activeWorkspaceId:'',activeProjectId:'',doc:null,onCreateWorkspace:(name)=>calls.push(name)})
  render(React.createElement(Academy.default,actions))
  assert.equal(calls.length,0);fireEvent.click(screen.getByRole('button',{name:/Crear mi organización/}));assert.equal(calls[0],'ATLAS · Academia personal')
  console.log('PASS Academy remains an explicit, non-automatic action')
  cleanup()
  const doc=props().doc;doc.fieldDefinitions=[{id:'c',label:'Canal de solicitud',forType:'requirement',kind:'select',options:['Web','Móvil','API']}]
  const result=assessAcademy(doc,true,'mixed','')
  assert.equal(result.functional.find(x=>x.id==='functional-field').done,false)
  assert.equal(result.technical.find(x=>x.id==='technical-field').done,false)
  console.log('PASS empty/bare field definitions do not confer badges')
  console.log('Academy guidance smoke: 7 checks passed')
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{global.setTimeout=originalTimer;dom.window.close()})
