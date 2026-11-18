import {afterEach,it} from 'vitest'
import assert from 'node:assert/strict'
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react'
import {createElement,emptyDoc} from '@novzi/contracts'
import type {Diagram,DiagramEdge,ElementType} from '@novzi/contracts'
import ClassRelationDialog from './ClassRelationDialog'

afterEach(cleanup)
const source=(additional=true)=>{
 const doc=emptyDoc();const ids:[string,ElementType][]=[['a','uml-class'],['b','uml-class'],['p','uml-package'],['note','uml-comment'],['ac','uml-association-class']]
 if(additional)ids.push(['c','uml-class'])
 for(const [id,type] of ids)doc.elements[id]={...createElement(id,type),id}
 const d:Diagram={id:'class',name:'QA',type:'uml-class',description:'',createdAt:'2026-11-16',nodes:(additional?ids:ids.filter(([id])=>id==='a'||id==='b')).map(([id],i)=>({id:`n${id}`,elementId:id,x:i*300,y:0})),edges:[]}
 doc.diagrams=[d];return doc
}
const open=(initial:Partial<DiagramEdge>={},additional=true,onDelete?:()=>void)=>{
 const doc=source(additional),before=structuredClone(doc),saved:DiagramEdge[]=[]
 const edge:DiagramEdge={id:'edge',source:'na',target:'nb',relationKind:'association',...initial}
 render(<ClassRelationDialog doc={doc} diagram={doc.diagrams[0]} initial={edge} onClose={()=>{}} onSave={e=>saved.push(e)} onDelete={onDelete}/> )
 return {doc,before,saved}
}
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}))
const change=(name:string,value:string)=>fireEvent.change(screen.getByLabelText(name,{exact:true}),{target:{value}})
const err=()=>screen.queryByRole('alert')?.textContent||''

it('Clases: no fabrica una tercera clase al intentar una asociación n-aria sin clasificador adicional',()=>{
 const {doc,before,saved}=open({},false)
 click('Agregar extremo n-ario')
 assert.match(err(),/otro clasificador/i)
 assert.equal(saved.length,0);assert.deepEqual(doc,before)
})

it('Clases: asociación n-aria permite editar rol, multiplicidad y navegabilidad del extremo adicional',()=>{
 const {doc,before,saved}=open()
 click('Agregar extremo n-ario')
 change('Clasificador','nc')
 change('Rol adicional','auditor')
 change('Multiplicidad adicional','0..*')
 change('Navegabilidad adicional','navigable')
 click('Guardar relación')
 assert.equal(saved.length,1,err())
 const extra=saved[0].associationEnds?.[2]
 assert.equal(extra?.nodeId,'nc');assert.equal(extra?.role,'auditor');assert.equal(extra?.multiplicity,'0..*');assert.equal(extra?.navigability,'navigable')
 assert.equal(saved[0].associationClassId,undefined);assert.deepEqual(doc,before)
})

it('Clases: retirar el último extremo adicional retorna a una asociación binaria',()=>{
 const {doc,before,saved}=open()
 click('Agregar extremo n-ario');assert.ok(screen.getByText(/Asociación n-aria/))
 click('Quitar extremo')
 assert.equal(screen.queryByText(/Asociación n-aria/),null)
 click('Guardar relación')
 assert.equal(saved.length,1,err());assert.equal(saved[0].associationEnds,undefined)
 assert.deepEqual(doc,before)
})

it('Clases: cambiar de asociación a dependencia conserva la información histórica sin multiplicidades activas',()=>{
 const {doc,before,saved}=open({label:'auditoría',sourceRole:'origen',targetMultiplicity:'1..*',sourceNavigability:'navigable'})
 change('Familia UML','Dependencia')
 assert.equal(screen.queryByLabelText('Rol origen UML'),null)
 assert.equal(screen.queryByLabelText('Multiplicidad destino UML'),null)
 click('Guardar relación')
 assert.equal(saved.length,1,err())
 assert.equal(saved[0].sourceRole,undefined);assert.equal(saved[0].targetMultiplicity,undefined)
 assert.match(saved[0].description||'',/origen|1\.\.\*/)
 assert.deepEqual(doc,before)
})

it('Clases: los atributos Ordered y Unique se preservan independientemente en origen y destino',()=>{
 const {doc,before,saved}=open()
 const origin=within(screen.getByRole('group',{name:'Origen'}))
 const target=within(screen.getByRole('group',{name:'Destino'}))
 fireEvent.click(origin.getByLabelText('Ordenado'))
 fireEvent.click(target.getByLabelText('Único'))
 fireEvent.change(target.getByLabelText('Navegabilidad'),{target:{value:'non-navigable'}})
 click('Guardar relación')
 assert.equal(saved.length,1,err())
 assert.equal(saved[0].sourceOrdered,true);assert.equal(saved[0].targetUnique,false)
 assert.equal(saved[0].targetNavigability,'non-navigable')
 assert.deepEqual(doc,before)
})

it('Clases: cambiar a composición exige el extremo todo explícito y conserva roles tras inversión',()=>{
 const {doc,before,saved}=open({relationKind:'composition',sourceRole:'completo',targetRole:'parte',sourceMultiplicity:'1',targetMultiplicity:'1'})
 change('Extremo todo','target')
 click('Invertir extremos')
 assert.equal((screen.getByLabelText('Extremo todo') as HTMLSelectElement).value,'source')
 assert.equal((screen.getByLabelText('Rol origen UML') as HTMLInputElement).value,'parte')
 click('Guardar relación')
 assert.equal(saved.length,1,err())
 assert.equal(saved[0].source,'nb');assert.equal(saved[0].target,'na')
 assert.equal(saved[0].wholeEnd,'source');assert.deepEqual(doc,before)
})

it('Clases: las anotaciones pueden anclarse a otra relación existente pero no a sí mismas',()=>{
 const doc=source(),before=structuredClone(doc),saved:DiagramEdge[]=[]
 doc.diagrams[0].edges=[{id:'r1',source:'na',target:'nb',relationKind:'association'}]
 render(<ClassRelationDialog doc={doc} diagram={doc.diagrams[0]} initial={{id:'note1',source:'nnote',target:'na',relationKind:'annotation'}} onClose={()=>{}} onSave={x=>saved.push(x)}/> )
 const select=screen.getByLabelText('Anclar a relación') as HTMLSelectElement
 assert.ok([...select.options].some(o=>o.value==='r1'))
 assert.ok(![...select.options].some(o=>o.value==='note1'))
 change('Anclar a relación','r1');change('Recorrido','bezier');click('Guardar relación')
 assert.equal(saved.length,1,err())
 assert.equal(saved[0].annotationTargetEdgeId,'r1');assert.equal(saved[0].target,'na');assert.equal(saved[0].pathStyle,'bezier')
 assert.deepEqual(doc.diagrams[0].edges,before.diagrams[0].edges.concat([{id:'r1',source:'na',target:'nb',relationKind:'association'}]))
})

it('Clases: cancelar o eliminar una relación ejecuta callbacks independientes sin guardar',()=>{
 let closed=0,deleted=0
 const doc=source(),before=structuredClone(doc),saved:DiagramEdge[]=[]
 render(<ClassRelationDialog doc={doc} diagram={doc.diagrams[0]} initial={{id:'edge',source:'na',target:'nb',relationKind:'association'}} onClose={()=>closed++} onDelete={()=>deleted++} onSave={e=>saved.push(e)}/> )
 click('Eliminar relación');click('Cancelar')
 assert.equal(deleted,1);assert.equal(closed,1);assert.equal(saved.length,0);assert.deepEqual(doc,before)
})
