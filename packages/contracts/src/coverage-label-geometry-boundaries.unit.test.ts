import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyDoc,createElement,canonicalUmlEdge,umlDisplayLabel,umlEdgeLabel,umlRelationNameLocked,deploymentGlyph,deploymentCube,deploymentPort,deploymentSvgScene} from './index'
import type {Diagram,DiagramEdge,ProjectDocument} from './index'

const e=(kind:string,more:Partial<DiagramEdge>={}):DiagramEdge=>({id:'e',source:'a',target:'b',relationKind:kind,...more})
const source=()=>{const d=emptyDoc();for(const [id,type] of [['a','uml-class'],['b','uml-class'],['itf','uml-interface'],['dev','uml-device'],['exec','uml-execution'],['art','uml-artifact'],['port','uml-port']] as const)d.elements[id]={...createElement(id,type),id};return d}
const view=(type:Diagram['type']):Diagram=>({id:'v',name:'Vista',type,description:'',createdAt:'2026-11-16',nodes:[{id:'a',elementId:'a',x:0,y:0},{id:'b',elementId:'b',x:300,y:0},{id:'i',elementId:'itf',x:600,y:0},{id:'dev',elementId:'dev',x:0,y:250},{id:'exec',elementId:'exec',x:300,y:250}],edges:[]})

test('Notación UML: alias de clase y parámetros tipados resuelven fichas existentes y faltantes sin mutar modelo',()=>{
 const d=source(),before=structuredClone(d),v=view('uml-class');d.elements.b.uml={templateParameters:[{id:'T',name:'Tipo',typeId:'a'}]}
 const bind=e('bind',{templateBindings:[{parameterId:'T',elementId:'a'},{parameterId:'missing',elementId:'no-such-id'}]})
 assert.match(umlDisplayLabel('uml-class',bind,d,v),/Tipo →/)
 assert.match(umlDisplayLabel('uml-class',bind,d,v),/Tipo no disponible/)
 assert.match(umlDisplayLabel('uml-class',bind,d,v),/\? →/)
 const imp=e('elementImport',{importAlias:'Pedido',label:'no permitido'})
 assert.match(umlDisplayLabel('uml-class',imp,d,v),/\{alias: Pedido\}/)
 const canonical=canonicalUmlEdge('uml-class',imp)
 assert.equal(canonical.label,undefined)
 assert.match(canonical.description||'',/no permitido/)
 assert.equal(umlRelationNameLocked('uml-class','elementImport'),true)
 assert.equal(umlEdgeLabel('uml-class',imp),'«import»')
 assert.deepEqual(d.elements.a,before.elements.a)
})

test('Notación UML: el catálogo de interfaces tiene prioridad para el texto visible del enlace',()=>{
 const d=source(),before=structuredClone(d),v=view('uml-component')
 d.elements.itf.name='Interfaz pública'
 const provided=e('provided-interface',{target:'i'})
 assert.equal(umlDisplayLabel('uml-component',provided,d,v),'Interfaz pública')
 const missing=e('required-interface',{target:'absent'})
 assert.equal(typeof umlDisplayLabel('uml-component',missing,d,v),'string')
 const imported=e('elementImport',{importAlias:'Contrato' ,target:'i'})
 assert.match(umlDisplayLabel('uml-component',imported,d,v),/alias: Contrato/)
 assert.deepEqual(d.diagrams,before.diagrams)
})

test('Notación UML: no UML conserva etiqueta de negocio, UML reservado no permite sustituir su palabra clave',()=>{
 const normal=e('dependency',{label:'Llamada de negocio'})
 assert.equal(umlEdgeLabel('c2',normal),'Llamada de negocio')
 assert.equal(umlDisplayLabel('c2',normal,emptyDoc()),'Llamada de negocio')
 assert.equal(umlEdgeLabel('uml-usecase',e('extend',{label:'Otro nombre'})),'«extend»')
 assert.equal(umlRelationNameLocked('uml-component','provided-interface'),true)
 assert.equal(umlRelationNameLocked('uml-sequence','create'),false)
 const original=e('dependency',{label:'Temporal',lineStyle:'solid'})
 assert.equal(canonicalUmlEdge('c1',original),original)
})

test('Despliegue: símbolos de dispositivo, runtime y opciones leaf/abstract se representan sin etiquetas espurias',()=>{
 const d=source(),before=structuredClone(d),size={width:280,height:220}
 d.elements.dev.uml={leaf:true,deviceIcon:'CPU'}
 d.elements.exec.uml={runtimeIcon:'JVM',abstract:true}
 const device=deploymentGlyph(d,d.elements.dev,size,false)
 const runtime=deploymentGlyph(d,d.elements.exec,size,false)
 assert.match(device,/«device»/);assert.match(device,/CPU/);assert.match(device,/\{leaf\}/)
 assert.match(runtime,/«executionEnvironment»/);assert.match(runtime,/JVM/);assert.match(runtime,/font-style="italic"/)
 assert.equal(deploymentCube(d,d.elements.dev),true)
 assert.equal(deploymentCube(d,d.elements.art),false)
 assert.notDeepEqual(d.elements.dev,before.elements.dev)
 assert.deepEqual(d.diagrams,before.diagrams)
})

test('Despliegue: rutas de cubo mantienen anclajes finitos al cambiar orientación o caras',()=>{
 const r={x:10,y:20,width:200,height:100}
 for(const source of [true,false])for(const face of ['left','right','top-1','top-3','bottom-1','bottom-3','invalid-handle']){
  for(const cube of [true,false]){
   const port=deploymentPort(r,cube,face,source)
   assert.ok(Number.isFinite(port.x)&&Number.isFinite(port.y),face)
  }
 }
 const d=source(),v=view('uml-deployment');d.diagrams=[v]
 v.edges=[e('dependency',{id:'link',source:'dev',target:'exec'}),e('dependency',{id:'broken',source:'no-node',target:'exec'})]
 const svg=deploymentSvgScene(d,v)
 assert.ok(svg.width>100&&svg.height>100)
 assert.doesNotMatch(svg.markup,/NaN|Infinity/)
})
