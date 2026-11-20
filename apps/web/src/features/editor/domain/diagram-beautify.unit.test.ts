import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {beautifyDiagram,obstacleRoute} from './diagram-beautify'
import type {ProjectDocument,Diagram,DiagramNode,ModelElement} from '@novzi/contracts'

const element=(id:string):ModelElement=>({id,name:`Elemento ${id}`,type:'component',summary:'',description:'',owner:'',author:'qa',status:'Borrador',createdAt:'2026-11-20',updatedAt:'2026-11-20',links:[],fields:{}})
const create=(nodes:string[],links:[string,string][],type:Diagram['type']='c3'):ProjectDocument=>({
 schema:1,elements:Object.fromEntries(nodes.map(id=>[id,element(id)])),fieldDefinitions:[],diagrams:[
  {id:'target',name:'Diagrama QA',type,description:'',createdAt:'2026-11-20',nodes:nodes.map((id,i)=>({id,elementId:id,x:(i%3)*300,y:Math.floor(i/3)*205,width:260,height:140})),edges:links.map(([source,target],i)=>({id:`edge-${i}`,source,target,label:`Relación ${i}`,direction:'forward',lineStyle:'solid',pathStyle:'smoothstep',sourceHandle:'right',targetHandle:'left'}))},
  {id:'untouched',name:'Otro diagrama',type:'c1',description:'',createdAt:'2026-11-20',nodes:[],edges:[]}
 ]
})
const bounds=(node:DiagramNode)=>({x:node.x,y:node.y,right:node.x+(node.width||260),bottom:node.y+(node.height||140)})

test('beautify ordena un camino y conserva campos, IDs e identidad de otro diagrama',()=>{
 const doc=create(['a','b','c'],[['a','b'],['b','c']]);const next=beautifyDiagram(doc,'target')
 const d=next.diagrams[0]
 assert.ok(d.nodes[1].x>d.nodes[0].x+260)
 assert.ok(d.nodes[2].x>d.nodes[1].x+260)
 assert.equal(d.edges.length,2)
 assert.deepEqual(d.edges.map(e=>e.label),doc.diagrams[0].edges.map(e=>e.label))
 assert.equal(next.diagrams[1],doc.diagrams[1])
 assert.equal(next.elements,doc.elements)
 assert.deepEqual(doc.diagrams[0].nodes.map(n=>n.x),[0,300,600])
 assert.deepEqual(beautifyDiagram(next,'target'),next)
 assert.throws(()=>beautifyDiagram(doc,'missing'),/no encontrado/)
})

test('con ciclos reales no envía todos los componentes a una sola columna',()=>{
 const doc=create(['a','b','c','d'],[['a','b'],['b','c'],['c','a'],['b','d'],['d','a']])
 const after=beautifyDiagram(doc,'target').diagrams[0]
 assert.ok(new Set(after.nodes.map(n=>n.x)).size>=2)
 assert.equal(after.edges.length,5)
 assert.deepEqual(after.edges.map(e=>e.id),doc.diagrams[0].edges.map(e=>e.id))
})

test('31 relaciones no generan superposición de cajas ni alteran su semántica',()=>{
 const ids=Array.from({length:13},(_,i)=>String(i))
 const links:[[string,string],...[string,string][]]=[
  ['0','11'],['11','0'],['11','1'],['1','10'],['11','2'],['2','10'],['11','3'],['3','10'],
  ['11','4'],['4','10'],['4','5'],['5','10'],['5','6'],['6','10'],['11','7'],['7','10'],
  ['11','8'],['8','10'],['8','6'],['11','9'],['9','1'],['10','11'],['12','10'],['10','12'],
  ['3','6'],['0','2'],['2','4'],['4','3'],['9','4'],['7','8'],['5','12']
 ]
 const doc=create(ids,links),afterDoc=beautifyDiagram(doc,'target'),after=afterDoc.diagrams[0]
 for(let i=0;i<after.nodes.length;i++)for(let j=i+1;j<after.nodes.length;j++){
  const a=bounds(after.nodes[i]),b=bounds(after.nodes[j])
  assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`Las cajas ${i} y ${j} se solapan`)
 }
 assert.equal(after.edges.length,31)
 for(let i=0;i<after.edges.length;i++){
  const before=doc.diagrams[0].edges[i],now=after.edges[i]
  const {sourceHandle:ignoredSource,targetHandle:ignoredTarget,...originalSemantic}=before
  const {sourceHandle:ignoredSource2,targetHandle:ignoredTarget2,...newSemantic}=now
  assert.deepEqual(newSemantic,originalSemantic)
 }
 assert.deepEqual(beautifyDiagram(afterDoc,'target'),afterDoc)
})

test('distribuye conectores de un hub sin inventar relaciones o puertos',()=>{
 const doc=create(['hub','a','b','c','d','e','f','g'],[['hub','a'],['hub','b'],['hub','c'],['hub','d'],['hub','e'],['hub','f'],['hub','g']])
 const after=beautifyDiagram(doc,'target').diagrams[0]
 assert.equal(after.edges.length,7)
 assert.ok(after.edges.some(e=>e.sourceHandle?.startsWith('top-')))
 assert.ok(after.edges.some(e=>e.sourceHandle?.startsWith('bottom-')))
 for(const e of after.edges)assert.ok(['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'].includes(e.sourceHandle||''))
})

test('no mueve elementos anidados ni altera vínculos UML',()=>{
 const doc=create(['container','child','other'],[['child','other']],'uml-component')
 doc.diagrams[0].nodes[1].parentNodeId='container'
 const original={...doc.diagrams[0].nodes[1]}
 const after=beautifyDiagram(doc,'target').diagrams[0]
 assert.deepEqual(after.nodes[1],original)
 assert.deepEqual(after.edges[0],doc.diagrams[0].edges[0])
})

test('router ortogonal evita obstáculos sin modificar la relación',()=>{
 const route=obstacleRoute({x:0,y:0},{x:200,y:0},[{id:'obstacle',x:70,y:-30,width:60,height:60}])
 assert.ok(route)
 assert.match(route.path,/L/)
 assert.notEqual(route.labelY,0)
 assert.equal(obstacleRoute({x:0,y:0},{x:200,y:0},[{id:'obstacle',x:-10,y:-10,width:220,height:20}]),null)
})
