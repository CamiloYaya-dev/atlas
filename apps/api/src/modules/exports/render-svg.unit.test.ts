import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc} from '@atlas/contracts'
import type {Diagram,DiagramEdge} from '@atlas/contracts'
import {esc,renderDiagramSVG} from './render-svg'
function sample(){
 const doc=emptyDoc(),a=createElement('Nombre muy largo para comprobar que el texto se divide de forma segura <script>','actor'),b=createElement('Destino','uml-class')
 a.summary='Resumen & <dato>'; b.childDiagramId='other';doc.elements[a.id]=a;doc.elements[b.id]=b
 const d:Diagram={id:'qa',name:'Diagrama <script>',type:'c1',description:'',createdAt:a.createdAt,nodes:[{id:'a',elementId:a.id,x:-50,y:-70},{id:'b',elementId:b.id,x:400,y:100}],edges:[]}
 doc.diagrams.push(d);return {doc,d}
}
test('SVG auxiliar escapa texto, incluye nodos, enlaces y relaciones paralelas con estilos',()=>{
 const {doc,d}=sample()
 const edges:DiagramEdge[]=[
  {id:'1',source:'a',target:'b',label:'consulta <dato>',sourceHandle:'top-1',targetHandle:'bottom-3',direction:'reverse',lineStyle:'dashed',pathStyle:'straight'},
  {id:'2',source:'a',target:'b',label:'',sourceHandle:'top-2',targetHandle:'bottom-1',direction:'none',lineStyle:'dotted',pathStyle:'bezier'},
  {id:'3',source:'b',target:'a',label:'respuesta',direction:'forward'},
  {id:'4',source:'a',target:'missing',label:'No debe salir'},
 ]
 d.edges=edges
 const {svg,width,height}=renderDiagramSVG(doc,d,false)
 assert.ok(width>600&&height>300);assert.match(svg,/consulta &lt;dato&gt;/);assert.match(svg,/Resumen &amp; &lt;dato&gt;/);assert.match(svg,/↗/)
 assert.match(svg,/stroke-dasharray="11 7" marker-start=/);assert.match(svg,/stroke-dasharray="2 7"/);assert.match(svg,/ Q /);assert.match(svg,/marker-end="url\(#arrow\)"/)
 assert.doesNotMatch(svg,/<script>|No debe salir|USO NO COMERCIAL/)
 assert.equal(esc(`&<>"'`),'&amp;&lt;&gt;&quot;&#39;')
})
test('SVG auxiliar rechaza coordenadas inválidas, tamaño y cantidad excesivos',()=>{
 const {doc,d}=sample();const original=d.nodes[0].x
 d.nodes[0].x=Infinity;assert.throws(()=>renderDiagramSVG(doc,d,false),{statusCode:422})
 d.nodes[0].x=10000;assert.throws(()=>renderDiagramSVG(doc,d,false),{statusCode:413})
 d.nodes[0].x=original;d.nodes=Array.from({length:261},()=>d.nodes[0]);assert.throws(()=>renderDiagramSVG(doc,d,false),{statusCode:413})
})
