import {test} from 'vitest'
import assert from 'node:assert/strict'
import {createElement,emptyDoc,umlAbsolutePosition,isProjectDocument,initializeSequenceNode,sequenceBox,sequencePositionLocked} from '@atlas/contracts'
import type {DiagramType,ElementType,ProjectDocument} from '@atlas/contracts'
import {addElementNode,createDiagram,resizeNode,moveNode,setNodePackage,moveDiagramSelection,removeDiagramSelection,connectNodes,editElement,removeElementNode} from './document-commands'
const fixture=(type:DiagramType,items:[string,ElementType,number,number][])=>{
 let doc=createDiagram(emptyDoc(),{id:'d',name:'Vista QA',type,date:'2026-11-14'})
 for(const [id,kind,x,y] of items)doc=addElementNode(doc,'d',{...createElement(id,kind),id},{id,x,y})
 return doc
}
const find=(doc:ProjectDocument,id:string)=>doc.diagrams[0].nodes.find(n=>n.id===id)!
const seq=()=>fixture('uml-sequence',[['participant','uml-lifeline',100,20],['activation','uml-activation',200,110],['destroy','uml-destruction',400,500]])
test('secuencia: activación centrada, destrucción al extremo y resize de ambos padres',()=>{
 let d=seq();d=resizeNode(d,'d','participant',170,500);d=setNodePackage(d,'d','activation','participant')
 assert.equal(find(d,'activation').x,61);assert.equal(find(d,'activation').y,90)
 d=setNodePackage(d,'d','destroy','activation');assert.equal(find(d,'destroy').x,0);assert.equal(find(d,'destroy').y,96)
 d=resizeNode(d,'d','activation',48,180);assert.equal(find(d,'destroy').y,156)
 d=resizeNode(d,'d','participant',250,500);assert.equal(find(d,'activation').x,101)
 d=moveNode(d,'d','activation',999,10000);assert.equal(find(d,'activation').x,101);assert.equal(find(d,'activation').y,311)
 assert.deepEqual(umlAbsolutePosition(d.diagrams[0],find(d,'destroy')),{x:201,y:487})
 assert.ok(isProjectDocument(d))
})
test('secuencia: no permite encastres incompatibles ni encoger el padre bajo una activación',()=>{
 let d=seq();assert.throws(()=>setNodePackage(d,'d','participant','activation'),/incompatible/)
 d=setNodePackage(d,'d','activation','participant');assert.throws(()=>resizeNode(d,'d','participant',170,170),/corta/)
 assert.throws(()=>setNodePackage(d,'d','activation','activation'),/sí mismo/)
 assert.throws(()=>setNodePackage(d,'d','activation','missing'),/incompatible/)
 assert.throws(()=>setNodePackage(d,'d','missing'),/Caja/)
})
test('destrucción directamente sobre línea de vida: se actualiza al cambiar tamaño',()=>{
 let d=setNodePackage(seq(),'d','destroy','participant');assert.equal(find(d,'destroy').y,236)
 d=resizeNode(d,'d','participant',200,400);assert.deepEqual([find(d,'destroy').x,find(d,'destroy').y],[76,376])
 d=moveNode(d,'d','destroy',0,0);assert.deepEqual([find(d,'destroy').x,find(d,'destroy').y],[76,376])
})
test('compuesto: puerto conserva cara al ampliar el clasificador en las cuatro orientaciones',()=>{
 for(const [x,y,side] of [[0,220,'left'],[780,220,'right'],[300,0,'top'],[300,520,'bottom']] as const){
  let d=fixture('uml-composite',[['class','uml-class',0,0],['port','uml-port',x,y]])
  d=setNodePackage(d,'d','port','class');d=resizeNode(d,'d','class',1000,700)
  const n=find(d,'port')
  if(side==='left')assert.equal(n.x,-90);if(side==='right')assert.equal(n.x,910);if(side==='top')assert.equal(n.y,-41);if(side==='bottom')assert.equal(n.y,659)
 }
})
test('contenedor: conserva coordenadas al desacoplar, impide ciclos y tamaños insuficientes',()=>{
 let d=fixture('uml-package',[['p','uml-package',100,100],['q','uml-subpackage',180,190],['r','uml-subpackage',240,250]])
 d=setNodePackage(d,'d','q','p');d=setNodePackage(d,'d','r','q')
 assert.throws(()=>setNodePackage(d,'d','p','r'),/ciclo/)
 assert.throws(()=>resizeNode(d,'d','p',200,140),/pequeño/)
 const abs=umlAbsolutePosition(d.diagrams[0],find(d,'r'));d=setNodePackage(d,'d','r');assert.deepEqual([find(d,'r').x,find(d,'r').y],[abs.x,abs.y]);assert.equal(find(d,'r').parentNodeId,undefined)
})
test('resize inválido no muta documento, y resize válido es exclusivo de aparición',()=>{
 const d=seq();const snapshot=JSON.stringify(d)
 for(const [w,h] of [[47,80],[100,4001],[100.5,90],[NaN,80]])assert.throws(()=>resizeNode(d,'d','participant',w,h),/Ancho\/alto/)
 assert.throws(()=>resizeNode(d,'d','participant',48,48),/mínimo/)
 assert.throws(()=>resizeNode(d,'d','participant',170,260,Infinity,0),/Posición/)
 assert.throws(()=>resizeNode(d,'d','missing',170,260),/Caja/)
 assert.equal(JSON.stringify(d),snapshot)
 const out=resizeNode(d,'d','participant',300,600,12.6,25.2);assert.deepEqual([find(out,'participant').width,find(out,'participant').height,find(out,'participant').x,find(out,'participant').y],[300,600,13,25]);assert.equal(out.elements,d.elements)
})
test('selección: mover contenedor e hijo una sola vez, borrar sin quitar fichas ni enlaces ajenos',()=>{
 let d=fixture('uml-package',[['p','uml-package',100,100],['q','uml-subpackage',180,190],['r','uml-subpackage',900,100]])
 d=setNodePackage(d,'d','q','p');d=connectNodes(d,'d',{id:'pq',source:'p',target:'q'});d=connectNodes(d,'d',{id:'qr',source:'q',target:'r'})
 d=editElement(d,'r',{childDiagramId:'d',childNodeId:'p'},'2026-11-14')
 const child=find(d,'q');d=moveDiagramSelection(d,'d',[{id:'p',x:300,y:300},{id:'q',x:999,y:999}]);assert.deepEqual(find(d,'q'),child)
 const abs=umlAbsolutePosition(d.diagrams[0],child);d=removeDiagramSelection(d,'d',['p'],[]);assert.deepEqual([find(d,'q').x,find(d,'q').y],[abs.x,abs.y]);assert.equal(find(d,'q').parentNodeId,undefined);assert.ok(d.elements.p);assert.equal(d.elements.r.childNodeId,undefined);assert.equal(d.diagrams[0].edges[0].id,'qr')
 d=removeDiagramSelection(d,'d',[],['qr']);assert.equal(d.diagrams[0].edges.length,0);assert.equal(d.diagrams[0].nodes.length,2)
})
test('selección: rechaza IDs ajenos o posiciones inválidas antes de cambiar datos',()=>{
 const d=seq();assert.throws(()=>moveDiagramSelection(d,'missing',[]),/Diagrama/);assert.throws(()=>moveDiagramSelection(d,'d',[{id:'missing',x:0,y:0}]),/Selección/);assert.throws(()=>moveDiagramSelection(d,'d',[{id:'participant',x:NaN,y:0}]),/Selección/);assert.throws(()=>removeDiagramSelection(d,'missing',[],[]),/Diagrama/);assert.throws(()=>removeDiagramSelection(d,'d',['missing'],[]),/Caja/);assert.throws(()=>removeDiagramSelection(d,'d',[],['missing']),/Relación/)
})
test('quitar nodo padre conserva hijo directo, ficha compartida y coordenadas absolutas',()=>{
 let d=setNodePackage(seq(),'d','activation','participant');const abs=umlAbsolutePosition(d.diagrams[0],find(d,'activation'));d=removeElementNode(d,'d','participant');assert.ok(d.elements.participant);assert.equal(find(d,'activation').parentNodeId,undefined);assert.deepEqual([find(d,'activation').x,find(d,'activation').y],[abs.x,abs.y])
})

// A root is created before timing exists. Draft attachments must remain editable,
// while resolved/partially resolved symbols retain the semantic safeguards.
test('secuencia: borrador con Interaction admite drag absoluto y resize de activación sin alterar ocurrencias ajenas',()=>{
 let d=seq();d=resizeNode(d,'d','participant',250,500);d=setNodePackage(d,'d','activation','participant');d=setNodePackage(d,'d','destroy','activation');
 d=addElementNode(d,'d',{...createElement('otro','uml-lifeline'),id:'otro'},{id:'otro',x:800,y:20});
 d.diagrams[0].interaction!.occurrences.push({id:'unrelated',nodeId:'otro',time:130,kind:'event'});
 const original=structuredClone(d.diagrams[0].interaction);
 d=moveDiagramSelection(d,'d',[{id:'activation',x:999,y:10000}]);
 assert.equal(find(d,'activation').x,101);assert.equal(find(d,'activation').y,371);
 d=resizeNode(d,'d','activation',48,180);assert.equal(find(d,'activation').y,311);assert.equal(find(d,'destroy').y,156);
 assert.deepEqual(d.diagrams[0].interaction,original);assert.ok(isProjectDocument(d));
 const b=sequenceBox(d,d.diagrams[0],find(d,'participant')),a=sequenceBox(d,d.diagrams[0],find(d,'activation'));
 d=moveDiagramSelection(d,'d',[{id:'participant',x:b.x+40,y:b.y+30},{id:'activation',x:a.x+40,y:a.y+30}]);
 assert.equal(find(d,'activation').y,311);assert.equal(find(d,'participant').x,140);assert.deepEqual(d.diagrams[0].interaction,original);
});
test('secuencia: activación con ocurrencias y X resuelta no permiten drag ni resize geométrico que ignore el tiempo',()=>{
 let d=seq();d=resizeNode(d,'d','participant',250,500);d=setNodePackage(d,'d','activation','participant');
 d=initializeSequenceNode(d,'d','activation');d=setNodePackage(d,'d','destroy','participant');d=initializeSequenceNode(d,'d','destroy');
 const snapshot=JSON.stringify(d),v=d.diagrams[0];
 for(const id of ['activation','destroy']){assert.equal(sequencePositionLocked(d,v,find(d,id)),true);assert.throws(()=>moveNode(d,'d',id,200,200),/ocurrencias/);assert.throws(()=>moveDiagramSelection(d,'d',[{id,x:200,y:200}]),/ocurrencias/);assert.throws(()=>resizeNode(d,'d',id,48,180),/ocurrencias/);}
 assert.equal(JSON.stringify(d),snapshot);
 const b=sequenceBox(d,v,find(d,'participant')),before=v.interaction!.occurrences;
 const out=moveDiagramSelection(d,'d',[{id:'participant',x:b.x+40,y:b.y+30}]);
 assert.deepEqual(out.diagrams[0].interaction!.occurrences,before.map(o=>({...o,time:o.time+30})));
});
