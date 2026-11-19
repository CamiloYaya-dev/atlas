import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createElement,novziNodeSize,novziNodeMinimum,parallelRoute,parallelOffsets,relationScope,umlContainerAllows} from './index'
import type {DiagramType,ElementType,EdgePathStyle} from './index'
import type {PortSide} from './parallel-edges'

test('tamaños mínimos protegidos para puertos, parámetros, invariantes y regiones',()=>{
 const cases:[DiagramType,ElementType,number,number][]=[['uml-component','uml-port',16,16],['uml-activity','uml-activity-pin',24,24],['uml-activity','uml-activity-parameter',95,48],['uml-activity','uml-activity-interruptible-region',250,180],['uml-sequence','uml-gate',48,48],['uml-sequence','uml-sequence-invariant',95,65],['uml-sequence','uml-sequence-continuation',95,65]]
 for(const [d,t,w,h] of cases){const e=createElement(t,t);assert.deepEqual(novziNodeMinimum(d,t),{width:w,height:h},t);assert.deepEqual(novziNodeSize(d,e,{width:1,height:1}),{width:w,height:h},t)}
})
test('cajas de casos de uso no recortan títulos multilínea ni puntos de extensión y mantienen ancho explícito',()=>{
 const simple=createElement('Consultar','usecase'),long={...simple,name:'Consultar\nY descargar',useCaseDetail:{extensionPoints:[{id:'p',name:'Punto de extensión',description:'Descripción suficientemente extensa para ocupar varias líneas'}]}}
 const normal=novziNodeSize('uml-usecase',simple,{width:220,height:100}),extended=novziNodeSize('uml-usecase',long,{width:220,height:100})
 assert.equal(normal.width,220);assert.equal(extended.width,220);assert.ok(extended.height>normal.height)
 const actor=createElement('Cliente','actor');assert.ok(novziNodeSize('uml-usecase',actor).height>=150)
 const rectangle={...actor,useCaseDetail:{presentation:'rectangle' as const,stereotype:'externo',leaf:true},uml:{attributes:[{id:'a',name:'nombre',type:'String',visibility:'private' as const}]}}
 assert.ok(novziNodeSize('uml-usecase',rectangle,{width:240,height:10}).height>=120)
})
test('bifurcación vertical, miembros de componentes y despliegue conservan tamaño semántico',()=>{
 const fork={...createElement('Fork','uml-fork'),activityDetail:{orientation:'vertical' as const}}
 assert.deepEqual(novziNodeSize('uml-activity',fork),{width:48,height:160});assert.deepEqual(novziNodeSize('uml-activity',fork,{width:40,height:30}),{width:40,height:90})
 for(const t of ['uml-class','uml-interface','uml-datatype','uml-artifact'] as const){const e=createElement(t,t);const members={...e,uml:{attributes:Array.from({length:5},(_,i)=>({id:`a${i}`,name:`n${i}`,type:'String',visibility:'private' as const}))}};assert.ok(novziNodeSize('uml-component',members).height>novziNodeSize('uml-component',e).height)}
 const d=createElement('Docker','uml-execution');assert.deepEqual(novziNodeSize('uml-deployment',d,undefined,0,true),{width:360,height:235})
})
test('las rutas conservan ambos puertos y etiquetas finitas para cuatro estilos, extremos coincidentes y dos ejes',()=>{
 for(const style of ['straight','bezier','step','smoothstep'] as EdgePathStyle[]){
  for(const [sx,sy,tx,ty] of [[0,0,300,20],[0,0,20,300],[10,10,10,10]]){
   for(const offset of [-38,0,38]){const r=parallelRoute({sourceX:sx,sourceY:sy,targetX:tx,targetY:ty,offset,pathStyle:style});if(style==='smoothstep'&&sx===tx&&sy===ty&&offset===0)assert.equal(r.path,'');else{assert.ok(r.path.startsWith(`M ${sx},${sy}`));assert.ok(r.path.endsWith(`${tx},${ty}`))};assert.ok(Number.isFinite(r.labelX)&&Number.isFinite(r.labelY));assert.doesNotMatch(r.path,/NaN|Infinity/)}
  }
  for(const [from,to] of [['top','bottom'],['bottom','top'],['left','right'],['right','left']] as [PortSide,PortSide][]){const r=parallelRoute({sourceX:0,sourceY:0,targetX:200,targetY:300,offset:38,pathStyle:style,sourcePosition:from,targetPosition:to});assert.match(r.path,/^M 0,0/);assert.match(r.path,/200,300$/);assert.ok(Number.isFinite(r.labelX)&&Number.isFinite(r.labelY));assert.doesNotMatch(r.path,/NaN|Infinity/)}
 }
 const a=parallelRoute({sourceX:0,sourceY:0,targetX:300,targetY:0,offset:-38,pathStyle:'bezier'}),b=parallelRoute({sourceX:0,sourceY:0,targetX:300,targetY:0,offset:38,pathStyle:'bezier'});assert.notEqual(a.path,b.path);assert.equal(a.labelY,-b.labelY)
})
test('desplazamiento paralelo estable por ID, independiente del orden y de otros pares',()=>{
 const all=[{id:'b',source:'x',target:'y'},{id:'a',source:'x',target:'y'},{id:'c',source:'y',target:'x'},{id:'d',source:'z',target:'x'},{id:'s',source:'x',target:'x'}]
 const actual=parallelOffsets(all,20),reversed=parallelOffsets([...all].reverse(),20)
 assert.deepEqual(Object.fromEntries(actual),Object.fromEntries(reversed));assert.equal(actual.get('a'),-20);assert.equal(actual.get('b'),0);assert.equal(actual.get('c'),-20);assert.equal(actual.get('d'),0);assert.equal(actual.get('s'),0)
})
test('ámbitos y contención no elevan un elemento funcional a técnico ni aceptan propietarios ajenos',()=>{
 assert.equal(relationScope('activity','requirement'),'functional');assert.equal(relationScope('service','database'),'technical');assert.equal(relationScope('actor','system'),'mixed');assert.equal(relationScope('activity','database'),'mixed');assert.equal(relationScope('database','activity'),'mixed')
 for(const [d,p,c,allowed] of [['uml-component','component','uml-port',true],['uml-component','uml-part','uml-port',true],['uml-component','uml-reference-role','uml-part',false],['uml-component','uml-artifact','uml-artifact',true],['uml-component','uml-package','uml-interface',true],['uml-component','uml-interface','uml-port',false],['uml-activity','uml-action','uml-activity-pin',true],['uml-deployment','uml-artifact','uml-artifact',true],['uml-deployment','uml-package','uml-object',false]] as [DiagramType,ElementType,ElementType,boolean][])assert.equal(umlContainerAllows(d,p,c),allowed,`${d}/${p}/${c}`)
})
