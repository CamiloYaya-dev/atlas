import {test} from 'node:test'
import assert from 'node:assert/strict'
import {beautifyDiagram,distinctEdgeRoute,needsDetour} from './diagram-beautify'
import type {ProjectDocument,ModelElement} from '@novzi/contracts'

test('rutas que compiten por el mismo corredor siguen siendo independientes',()=>{
 const from={x:220,y:120},to={x:750,y:120}
 const rects=[{id:'between',x:410,y:65,width:115,height:110}]
 const routes=[-2,-1,0,1,2].map(lane=>distinctEdgeRoute(from,to,rects,{lane,sourceSide:'right',targetSide:'left'}))
 assert.ok(routes.every(Boolean),'debe poder rodear la caja intermedia')
 const distinct=new Set(routes.map(r=>r?.path))
 assert.ok(distinct.size>=3,`las variantes no deben compartir un único recorrido: ${[...distinct]}`)
 for(const route of routes){
  assert.ok(route)
  const parts=[...route.path.matchAll(/[ML]\s*([\d.-]+)\s+([\d.-]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}))
  for(let i=1;i<parts.length;i++)assert.equal(needsDetour(parts[i-1],parts[i],[rects[0]]),false,'no atravesar obstáculo')
 }
})

test('Organizar deja corredores amplios, pero conserva todas las relaciones y fichas',()=>{
 const el=(id:string):ModelElement=>({id,name:id,type:'system',summary:'',description:'',owner:'',author:'',status:'',createdAt:'',updatedAt:'',links:[],fields:{}})
 const doc:ProjectDocument={schema:1,elements:{a:el('a'),b:el('b'),c:el('c')},diagrams:[{id:'d',name:'QA',type:'custom',createdAt:'2026-11-17',description:'',nodes:[{id:'a',elementId:'a',x:10,y:10},{id:'b',elementId:'b',x:12,y:10},{id:'c',elementId:'c',x:14,y:10}],edges:[{id:'1',source:'a',target:'b',label:'Requiere validación manual de la relación'},{id:'2',source:'a',target:'c',label:'Otra relación independiente'}]}],fieldDefinitions:[]}
 const after=beautifyDiagram(doc,'d')
 const nodes=after.diagrams[0].nodes
 assert.ok(nodes[1].x-nodes[0].x>=340)
 assert.equal(after.diagrams[0].edges,doc.diagrams[0].edges)
 assert.equal(after.elements,doc.elements)
 assert.deepEqual(beautifyDiagram(after,'d'),after)
})
