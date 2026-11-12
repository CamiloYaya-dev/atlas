import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc} from '@atlas/contracts'
import type {Diagram} from '@atlas/contracts'
import {graphSelection} from './graph-selection'
const doc=emptyDoc()
for(const [id,group] of [['a','Autenticación'],['b','Pagos'],['c','Notificaciones']]){const e=createElement(id,'activity');e.id=id;e.group=group;doc.elements[id]=e}
const diagram:Diagram={id:'d',name:'Proceso',type:'process',description:'',createdAt:'2026-01-01',nodes:[{id:'na',elementId:'a',x:0,y:0},{id:'nb',elementId:'b',x:1,y:0},{id:'nc',elementId:'c',x:2,y:0}],edges:[{id:'ab',source:'na',target:'nb'},{id:'bc',source:'nb',target:'nc'}]}
test('solo muestra procesos seleccionados sin dependencias',()=>{
 const x=graphSelection(diagram,doc,['Pagos'],false)
 assert.deepEqual(x.nodeIds,['nb']);assert.deepEqual(x.edgeIds,[])
})
test('muestra los procesos relacionados directamente al activar dependencias',()=>{
 const x=graphSelection(diagram,doc,['Pagos'],true)
 assert.deepEqual(x.nodeIds,['na','nb','nc']);assert.deepEqual(x.edgeIds,['ab','bc'])
})
test('sin ningún grupo seleccionado, el proceso queda vacío',()=>{
 assert.deepEqual(graphSelection(diagram,doc,[],true).nodeIds,[])
})
test('en C4 se muestran todos los componentes sin filtro funcional',()=>{
 const d={...diagram,type:'c3' as const}
 assert.deepEqual(graphSelection(d,doc,[],false).nodeIds,['na','nb','nc'])
})
test('no devuelve nodos con elementos inexistentes ni relaciones huérfanas',()=>{
 const d={...diagram,nodes:[...diagram.nodes,{id:'nx',elementId:'missing',x:3,y:0}],edges:[...diagram.edges,{id:'bx',source:'nb',target:'nx'}]}
 const x=graphSelection(d,doc,['Pagos'],true)
 assert.equal(x.nodeIds.includes('nx'),false);assert.equal(x.edgeIds.includes('bx'),false)
})
