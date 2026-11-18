import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc,isProjectDocument,validNodeDimension,availableExportFields,validateAdvancedExport,exportFieldsFor} from './index'
import type {Diagram,ProjectDocument} from './index'
function sample(){
 const doc=emptyDoc(),a=createElement('Origen','uml-class'),b=createElement('Destino','uml-class')
 a.summary='Resumen real';a.links=[{id:'link',label:'Wiki',url:'https://example.test'}];a.childDiagramId='d';a.childNodeId='b';doc.elements[a.id]=a;doc.elements[b.id]=b
 const d:Diagram={id:'d',type:'uml-class',name:'Clases',description:'',createdAt:a.createdAt,filters:[{id:'f',label:'Filtro'}],nodes:[{id:'a',elementId:a.id,x:0,y:0,width:200,height:150,filterIds:['f']},{id:'b',elementId:b.id,x:400,y:0}],edges:[{id:'r',source:'a',target:'b',label:'usa',direction:'both',lineStyle:'solid',pathStyle:'straight',sourceHandle:'right',targetHandle:'left',relationKind:'association',sourceRole:'a',targetMultiplicity:'1'}]};doc.diagrams=[d];return {doc,d,a,b}
}
test('validación JSON admite dimensiones, filtros y relaciones válidos y rechaza cada tipo de corrupción',()=>{
 const {doc}=sample();assert.equal(isProjectDocument(doc),true)
 const cases:Array<(v:ProjectDocument)=>void>=[v=>{v.diagrams[0].nodes[0].width=20},v=>{v.diagrams[0].nodes[0].height=Infinity},v=>{Object.assign(v.diagrams[0].nodes[0],{parentNodeId:1})},v=>{Object.assign(v.diagrams[0].nodes[0],{filterIds:[42]})},v=>{Object.assign(v.diagrams[0],{filters:[null]})},v=>{Object.assign(v.diagrams[0],{filters:[{id:1,label:'f'}]})},v=>{Object.assign(v.diagrams[0],{filters:[{id:'f',label:1}]})},v=>{Object.assign(v.diagrams[0].edges[0],{sourceHandle:1})},v=>{Object.assign(v.diagrams[0].edges[0],{targetHandle:1})},v=>{Object.assign(v.diagrams[0].edges[0],{direction:'up'})},v=>{Object.assign(v.diagrams[0].edges[0],{lineStyle:'random'})},v=>{Object.assign(v.diagrams[0].edges[0],{pathStyle:'random'})},v=>{Object.assign(v.diagrams[0].edges[0],{relationKind:'x'.repeat(61)})},v=>{Object.assign(v.diagrams[0].edges[0],{sourceRole:'x'.repeat(81)})},v=>{Object.assign(v.diagrams[0].edges[0],{targetRole:1})}]
 for(const change of cases){const invalid=structuredClone(doc);change(invalid);assert.equal(isProjectDocument(invalid),false,JSON.stringify(invalid.diagrams[0]))}
 for(const n of [48,4000])assert.equal(validNodeDimension(n),true)
 for(const n of [47,4001,90.5,NaN,'100',null])assert.equal(validNodeDimension(n),false)
})
test('exportación de fichas valida autorización, tipos de datos, destinos y formatos',()=>{
 const {doc,d,a}=sample();const custom=[['bool',true,'Sí'],['no',false,'No'],['num',0,'0'],['text','texto','texto'],['list',['a',false,2],'a, No, 2'],['empty',null,'']] as const
 for(const [id,value] of custom){doc.fieldDefinitions.push({id,label:id,forType:'all',kind:'text'});Object.assign(a.fields,{[id]:value})}
 const fields=availableExportFields(doc,d,a.id);for(const [id,,expected] of custom)assert.equal(fields.find(f=>f.key===`custom:${id}`)?.value,expected)
 assert.match(fields.find(f=>f.key==='@linked')!.value,/Clases → Destino/);assert.match(fields.find(f=>f.key==='@relations')!.value,/Origen ↔ Destino/);assert.equal(fields.find(f=>f.key==='@links')!.value,'Wiki: https://example.test')
 for(const [direction,symbol] of [['forward','→'],['reverse','←'],['none','—']] as const){d.edges[0].direction=direction;assert.match(availableExportFields(doc,d,a.id).find(f=>f.key==='@relations')!.value,new RegExp(symbol))}
 assert.deepEqual(availableExportFields(doc,d,'missing'),[])
 for(const value of [null,{mode:'wrong',fields:{}},{mode:'both',fields:[]},{mode:'both',fields:{a:{summary:'invalid'}}},{mode:'simple',fields:{a:{summary:'embed'}}},{mode:'embedded',fields:{a:{summary:'dictionary'}}},{mode:'both',fields:{a:{unknown:'omit'}}},{mode:'both',fields:{missing:{summary:'omit'}}},{mode:'both',fields:{a:{summary:'omit'}},documentFormat:'exe'}])assert.throws(()=>validateAdvancedExport(doc,d,value))
 const request=validateAdvancedExport(doc,d,{mode:'both',fields:{a:{summary:'embed','custom:bool':'dictionary','custom:empty':'dictionary'}},documentFormat:'pdf'})
 assert.equal(request.documentFormat,'pdf');assert.deepEqual(exportFieldsFor(doc,d,a,'a',request,'dictionary').map(f=>f.value),['Sí']);assert.deepEqual(exportFieldsFor(doc,d,a,'a',request,'embed').map(f=>f.value),['Resumen real']);assert.deepEqual(exportFieldsFor(doc,d,a,'b',request,'embed'),[])
})
