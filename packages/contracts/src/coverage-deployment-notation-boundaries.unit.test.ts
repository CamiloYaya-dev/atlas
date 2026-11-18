import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createElement,emptyDoc,canonicalUmlEdge,umlDisplayLabel,umlEdgeLabel,umlRelationNameLocked,deploymentGlyph,deploymentCube,deploymentPort,deploymentFacingPort,deploymentSvgScene} from './index'
import type {Diagram,DiagramEdge,ProjectDocument} from './index'
const fixture=(name:string):ProjectDocument=>JSON.parse(readFileSync(new URL(`../../../qa/NOVZI_QA_UML_${name}.json`,import.meta.url),'utf8'))
const edge=(kind:string,extra:Partial<DiagramEdge>={}):DiagramEdge=>({id:'e',source:'a',target:'b',relationKind:kind,...extra})

test('Notación: palabras reservadas y relaciones sin etiqueta histórica no admiten títulos libres de usuario',()=>{
 for(const diagram of ['uml-class','uml-usecase','uml-component','uml-deployment'] as const){
  assert.equal(umlEdgeLabel(diagram,edge('generalization',{label:'manual'})),'')
  assert.equal(umlRelationNameLocked(diagram,'generalization'),true)
  assert.equal(umlEdgeLabel(diagram,edge('dependency',{label:'manual'})),'manual')
 }
 assert.equal(umlEdgeLabel('c4',edge('generalization',{label:'histórico'})),'histórico')
 assert.equal(umlEdgeLabel('uml-activity',edge('control-flow',{label:'validado'})),'validado')
 assert.equal(umlEdgeLabel('uml-sequence',edge('create',{label:'nuevo'})),'«create»')
 assert.equal(umlRelationNameLocked('uml-sequence','create'),false)
 assert.equal(umlRelationNameLocked('uml-component','wiring'),true)
 assert.equal(umlEdgeLabel('uml-usecase',edge('include',{label:'libre'})),'«include»')
})

test('Notación: la presentación deriva nombres de interfaces, ensamblaje y alias únicamente de fichas visibles',()=>{
 const d=fixture('COMPONENTES'),v=d.diagrams[0],names=Object.keys(d.elements)
 assert.ok(names.length>5)
 const face=v.edges.find(e=>e.relationKind==='provided-interface')
 assert.ok(face,'La fixture incluye una interfaz proporcionada');const shown=umlDisplayLabel('uml-component',face,d,v);assert.equal(typeof shown,'string');assert.ok(shown.length>0)
 const wiring=v.edges.find(e=>e.relationKind==='wiring'||e.relationKind==='assembly')
 assert.ok(wiring,'La fixture incluye ensamblaje');assert.ok(umlDisplayLabel('uml-component',wiring,d,v).length>0);const hidden={...d,elements:{...d.elements}};assert.equal(typeof umlDisplayLabel('uml-component',wiring,hidden,v),'string')
 const fake=edge('elementImport',{importAlias:'Factura&Co'});const src=Object.values(d.elements).find(e=>e.type==='component')!;
 const anon:Diagram={id:'x',name:'x',type:'uml-component',description:'',createdAt:'',nodes:[{id:'a',elementId:src.id,x:0,y:0},{id:'b',elementId:src.id,x:250,y:0}],edges:[]}
 assert.match(umlDisplayLabel('uml-component',fake,d,anon),/alias: Factura&Co/)
 assert.equal(umlDisplayLabel('uml-component',edge('dependency'),d),umlEdgeLabel('uml-component',edge('dependency')))
 assert.equal(umlDisplayLabel('uml-class',edge('bind'),d,anon),umlEdgeLabel('uml-class',edge('bind')))
 assert.equal(canonicalUmlEdge('c1',fake),fake)
})

test('Despliegue: anclajes de cubo y de rectángulo cubren cada cara, borde y punto de aproximación',()=>{
 const r={x:20,y:30,width:200,height:120}
 for(const side of ['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3']){
  const flat=deploymentPort(r,false,side,false),cube=deploymentPort(r,true,side,false)
  assert.ok(Number.isFinite(flat.x)&&Number.isFinite(flat.y)&&Number.isFinite(cube.x)&&Number.isFinite(cube.y))
  if(side==='left')assert.equal(cube.x,r.x+1)
  if(side==='right')assert.equal(cube.x,r.x+r.width-1)
  if(side.startsWith('top'))assert.ok(cube.y>=r.y+1)
  if(side.startsWith('bottom'))assert.ok(cube.y<=r.y+r.height-1)
 }
 for(const pt of [{x:-90,y:90},{x:390,y:90},{x:110,y:-80},{x:110,y:330}]){
  const cube=deploymentFacingPort(r,true,pt),flat=deploymentFacingPort(r,false,pt)
  assert.ok(Number.isFinite(cube.x)&&Number.isFinite(cube.y));assert.ok(Number.isFinite(flat.x)&&Number.isFinite(flat.y))
 }
})

test('Despliegue: glifos de nodos, artefactos, instancias y especificaciones conservan tipado y escapan etiquetas',()=>{
 const d=fixture('DESPLIEGUE'),size={width:400,height:320}
 const inst=d.elements['host-instance'];assert.equal(deploymentCube(d,inst),true)
 const gl=deploymentGlyph(d,inst,size,false);assert.match(gl,/text-decoration="underline"/)
 assert.match(deploymentGlyph(d,{...inst,name:'Servidor < QA & producción'},size,false),/&lt; QA &amp;/)
 assert.ok(deploymentGlyph(d,inst,{width:120,height:90},true).length>0)
 const art=d.elements.lib,artifact=deploymentGlyph(d,art,size,false);assert.ok(artifact.length>0)
 const spec={...art,uml:{deployment:{kind:'specification' as const,fileName:'config.yml',deploymentLocation:'/srv/config',executionLocation:'/etc/config'}}}
 const specSvg=deploymentGlyph(d,spec,size,false);assert.match(specSvg,/config.yml/);assert.match(specSvg,/deploymentLocation = \/srv\/config/)
 assert.match(specSvg,/executionLocation = \/etc\/config/)
 const part={...createElement('Cache','uml-part'),id:'local-part',uml:{deployment:{kind:'part' as const,typeId:'missing',multiplicity:'0..*'}}}
 assert.match(deploymentGlyph(d,part,size,false),/Tipo no disponible/);assert.match(deploymentGlyph(d,part,size,false),/\[0\.\.\*\]/)
 const empty={...createElement('Compacto','uml-artifact'),id:'empty'};assert.ok(deploymentGlyph(d,empty,{width:64,height:40},false).length>0)
})

test('Despliegue: escena vacía y aristas huérfanas permanecen legibles, sin coordenadas corruptas',()=>{
 const d=emptyDoc(),v:Diagram={id:'d',name:'Vacío',description:'',type:'uml-deployment',createdAt:'',nodes:[],edges:[]};d.diagrams=[v]
 const s=deploymentSvgScene(d,v);assert.equal(s.markup,'');assert.ok(s.width>=100&&s.height>=100)
 const a=createElement('Hardware','uml-device');a.id='device';const b=createElement('Runtime','uml-execution');b.id='runtime';d.elements.device=a;d.elements.runtime=b
 v.nodes=[{id:'a',elementId:'device',x:0,y:0},{id:'b',elementId:'runtime',x:300,y:0}]
 const e=edge('communication-path',{id:'wire',source:'a',target:'b',sourceRole:'cliente',targetMultiplicity:'1..*'});v.edges=[e,edge('dependency',{id:'orphan',source:'absent',target:'b'})]
 const scene=deploymentSvgScene(d,v);assert.match(scene.markup,/cliente/);assert.match(scene.markup,/1\.\.\*/)
 assert.doesNotMatch(scene.markup,/NaN|Infinity|undefined/);assert.ok(scene.width>300)
})

test('Despliegue: diagrama n-ario, anotación a arista y nodos anidados preservan marcas visuales',()=>{
 const d=fixture('DESPLIEGUE'),v=d.diagrams[0],before=structuredClone(d)
 const annotated=v.edges.find(e=>e.annotationTargetEdgeId)
 if(annotated){const scene=deploymentSvgScene(d,v);assert.ok(scene.markup.length>0)}
 const extra=v.nodes.slice(0,3).map(n=>n.id);assert.equal(extra.length,3)
 const newEdge=edge('communication-path',{id:'qa-multi',source:extra[0],target:extra[1],associationEnds:[{id:'qa-end-1',nodeId:extra[0],role:'Primero'},{id:'qa-end-2',nodeId:extra[1],role:'Segundo'},{id:'qa-end-3',nodeId:extra[2],role:'Tercero',navigability:'navigable'}]})
 const extended={...v,edges:[...v.edges,newEdge]};const scene=deploymentSvgScene(d,extended)
 assert.match(scene.markup,/Tercero/);assert.match(scene.markup,/<polygon/)
 assert.doesNotMatch(scene.markup,/NaN|Infinity/)
 assert.deepEqual(d,before)
})
