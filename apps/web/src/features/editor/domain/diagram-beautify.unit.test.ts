import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {beautifyDiagram,obstacleRoute} from './diagram-beautify'
import type {ProjectDocument} from '@novzi/contracts'
const doc={schemaVersion:'4.8.1',elements:{a:{id:'a',type:'system',name:'Sistema A'},b:{id:'b',type:'system',name:'Sistema B'},c:{id:'c',type:'system',name:'Sistema C'}},diagrams:[{id:'d',type:'c1',name:'Prueba',description:'',createdAt:'2026-11-17',nodes:[{id:'a',elementId:'a',x:10,y:10},{id:'b',elementId:'b',x:12,y:13},{id:'c',elementId:'c',x:14,y:20}],edges:[{id:'ab',source:'a',target:'b',sourceHandle:'right',targetHandle:'left'},{id:'bc',source:'b',target:'c',sourceHandle:'right',targetHandle:'left'}]}]} as unknown as ProjectDocument
test('beautify separa cajas, preserva identidades y no cambia la semántica',()=>{const next=beautifyDiagram(doc,'d'),d=next.diagrams[0];assert.equal(d.edges,doc.diagrams[0].edges);assert.deepEqual(d.nodes.map(n=>n.elementId),['a','b','c']);assert.ok(d.nodes[1].x>d.nodes[0].x+100);assert.ok(d.nodes[2].x>d.nodes[1].x+100);assert.deepEqual(doc.diagrams[0].nodes.map(n=>n.x),[10,12,14])})
test('layout idempotente y error para diagrama inexistente',()=>{const first=beautifyDiagram(doc,'d');assert.deepEqual(beautifyDiagram(first,'d'),first);assert.throws(()=>beautifyDiagram(doc,'missing'),/no encontrado/)})
test('enrutamiento evita obstáculos intermedios sin cambiar cajas',()=>{const r=obstacleRoute({x:0,y:0},{x:200,y:0},[{id:'box',x:70,y:-30,width:60,height:60}]);assert.ok(r);assert.match(r!.path,/L/);assert.ok(r!.labelY!==0)})
test('el router no inventa caminos cuando ambos extremos están encerrados',()=>{assert.equal(obstacleRoute({x:0,y:0},{x:200,y:0},[{id:'box',x:-10,y:-10,width:220,height:20}]),null)})
