import test from 'node:test'
import assert from 'node:assert/strict'
import type {ProjectDocument} from '@novzi/contracts'
import {snapshotDiagrams,comparisonForBaseline} from './functional-baseline-snapshot'
const doc=():ProjectDocument=>({schema:1,fieldDefinitions:[],elements:{
 a:{id:'a',name:'Login actual',type:'process',summary:'',description:'',owner:'',author:'',status:'',createdAt:'',updatedAt:'',links:[],fields:{}},
 b:{id:'b',name:'Proceso de pagos restringido',type:'process',summary:'',description:'',owner:'',author:'',status:'',createdAt:'',updatedAt:'',links:[],fields:{}}
 },diagrams:[
  {id:'login',name:'Autenticación',description:'',type:'process',createdAt:'',nodes:[{id:'n1',elementId:'a',x:10,y:20}],edges:[]},
  {id:'pagos',name:'Pagos',description:'',type:'process',createdAt:'',nodes:[{id:'n2',elementId:'b',x:50,y:30}],edges:[]}
 ]})
test('AS-IS captura solo los diagramas vinculados y sus elementos, no todo el proyecto',()=>{
 const input=doc(),history=snapshotDiagrams(input,new Set(['login']))
 assert.equal(history.diagrams.length,1)
 assert.equal(history.diagrams[0].id,'login')
 assert.ok(history.elements.a)
 assert.equal(history.elements.b,undefined)
})
test('AS-IS conserva el original aun cuando cambia el elemento y las cajas del diagrama actual',()=>{
 const input=doc(),history=snapshotDiagrams(input,new Set(['login']))
 input.elements.a.name='Nueva autenticación'
 input.diagrams[0].nodes.push({id:'n3',elementId:'b',x:80,y:60})
 assert.equal(history.elements.a.name,'Login actual')
 assert.equal(history.diagrams[0].nodes.length,1)
 assert.equal(comparisonForBaseline(history,input)[0].changed,true)
})
test('AS-IS informa que un diagrama fue eliminado sin alterar el histórico',()=>{
 const history=snapshotDiagrams(doc(),new Set(['login']))
 const active=doc();active.diagrams=active.diagrams.filter(d=>d.id!=='login')
 assert.deepEqual(comparisonForBaseline(history,active).map(x=>[x.currentNodes,x.changed]),[[null,true]])
 assert.equal(history.diagrams.length,1)
})
