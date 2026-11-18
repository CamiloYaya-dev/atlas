import {afterEach,it} from 'vitest'
import assert from 'node:assert/strict'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import type {ProjectDocument} from '@novzi/contracts'
import fixture from '../../../../../../qa/NOVZI_QA_UML_DESPLIEGUE.json'
import {DeploymentCatalog,DeploymentDetails,DeploymentRelationDialog} from './DeploymentEditors'

afterEach(cleanup)
const source=()=>structuredClone(fixture) as ProjectDocument
const click=(label:string)=>fireEvent.click(screen.getByRole('button',{name:label}))
const change=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}})
const err=()=>screen.queryByRole('alert')?.textContent||''
const relation=(id:string,other:{disabled?:boolean;onSave?:(d:ProjectDocument)=>boolean;onClose?:()=>void;onDelete?:()=>void;onDeleteSemantic?:()=>void}={})=>{
 const doc=source(),before=structuredClone(doc),updates:ProjectDocument[]=[]
 const initial=doc.diagrams[0].edges.find(e=>e.id===id)!
 render(<DeploymentRelationDialog doc={doc} diagram={doc.diagrams[0]} initial={initial} disabled={!!other.disabled} onClose={other.onClose||(()=>{})} onDelete={other.onDelete} onDeleteSemantic={other.onDeleteSemantic} onSave={other.onSave||((d)=>(updates.push(d),true))}/> )
 return {doc,before,updates,initial}
}
const catalog=(other:{onSave?:(d:ProjectDocument)=>boolean;disabled?:boolean}={})=>{
 const doc=source(),before=structuredClone(doc),updates:ProjectDocument[]=[]
 render(<DeploymentCatalog doc={doc} disabled={!!other.disabled} onSave={other.onSave||((d)=>(updates.push(d),true))}/> )
 return {doc,before,updates}
}

it('Despliegue: el catálogo rechaza JSON malformado sin modificar registro ni llamar al guardado',()=>{
 const {doc,before,updates}=catalog()
 change('Registro','d2');change('Estructura semántica del registro','{malformado')
 click('Guardar registro')
 assert.match(err(),/JSON|Unexpected|inválid/i)
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: el catálogo bloquea modificar la identidad inmutable del registro',()=>{
 const {doc,before,updates}=catalog()
 change('Registro','d2')
 const original=JSON.parse((screen.getByLabelText('Estructura semántica del registro') as HTMLTextAreaElement).value)
 change('Estructura semántica del registro',JSON.stringify({...original,id:'d2-suplantado'}))
 click('Guardar registro')
 assert.match(err(),/identidad.*inmutable/i);assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: eliminar registro exige doble confirmación y permite cancelar sin escribir',()=>{
 const {doc,before,updates}=catalog()
 change('Registro','d2');click('Eliminar registro')
 assert.ok(screen.getByText(/Eliminar registro y todas sus apariciones/))
 click('Cancelar')
 assert.equal(screen.queryByText(/Eliminar registro y todas sus apariciones/),null)
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: confirmar eliminación explícita retira un registro y sus apariciones, no otras fichas',()=>{
 const {doc,before,updates}=catalog()
 change('Registro','d2');click('Eliminar registro');click('Confirmar eliminación')
 assert.equal(updates.length,1,err())
 assert.equal(updates[0].deploymentRelations?.d2,undefined)
 assert.ok(updates[0].deploymentRelations?.d1)
 assert.equal(updates[0].diagrams[0].edges.some(e=>e.deploymentRelationId==='d2'),false)
 assert.ok(updates[0].elements.api)
 assert.deepEqual(doc,before)
})

it('Despliegue: la eliminación que no confirma el servidor conserva el diálogo de confirmación',()=>{
 const {doc,before}=catalog({onSave:()=>false})
 change('Registro','d2');click('Eliminar registro');click('Confirmar eliminación')
 assert.ok(screen.getByText(/Eliminar registro y todas sus apariciones/))
 assert.equal((screen.getByLabelText('Registro') as HTMLSelectElement).value,'d2')
 assert.deepEqual(doc,before)
})

it('Despliegue: cambiar el registro seleccionado descarta confirmación de eliminación previa',()=>{
 const {doc,before,updates}=catalog()
 change('Registro','d1');click('Eliminar registro')
 change('Registro','d2')
 assert.equal(screen.queryByText(/Eliminar registro y todas sus apariciones/),null)
 assert.equal((screen.getByLabelText('Registro') as HTMLSelectElement).value,'d2')
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: ruta de comunicación permite modificar protocolo y recorrido conservando identidad',()=>{
 const {doc,before,updates}=relation('p1')
 change('Protocolo','TLS 1.3');change('Recorrido','step')
 click('Guardar relación')
 assert.equal(updates.length,1,err())
 const rec=updates[0].deploymentRelations?.p1
 assert.equal(rec?.kind,'communication-path')
 if(rec?.kind==='communication-path')assert.equal(rec.protocol,'TLS 1.3')
 assert.equal(updates[0].diagrams[0].edges.find(e=>e.id==='p1')?.pathStyle,'step')
 assert.deepEqual(doc,before)
})

it('Despliegue: los extremos n-arios pueden añadirse y retirarse antes de guardar el registro',()=>{
 const {doc,before,updates}=relation('p1')
 const initial=screen.getAllByText(/^Extremo \d+$/).length
 click('Añadir extremo')
 assert.equal(screen.getAllByText(/^Extremo \d+$/).length,initial+1)
 assert.ok(screen.getByLabelText('Aparición'))
 click('Quitar extremo')
 assert.equal(screen.getAllByText(/^Extremo \d+$/).length,initial)
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: extremo adicional sin aparición se rechaza y permite corregir borrador',()=>{
 const {doc,before,updates}=relation('p1')
 click('Añadir extremo');click('Guardar relación')
 assert.match(err(),/Selecciona las apariciones/)
 assert.equal(updates.length,0)
 const chooser=screen.getByLabelText('Aparición') as HTMLSelectElement
 assert.ok([...chooser.options].some(o=>o.value==='node'))
 fireEvent.change(chooser,{target:{value:'node'}})
 assert.equal(chooser.value,'node')
 assert.deepEqual(doc,before)
})

it('Despliegue: los roles y la navegabilidad de los extremos son campos separados',()=>{
 const {doc,before}=relation('p1')
 const roles=screen.getAllByLabelText('Rol') as HTMLInputElement[]
 const nav=screen.getAllByLabelText('Navegabilidad') as HTMLSelectElement[]
 assert.equal(roles.length,2);assert.equal(nav.length,2)
 fireEvent.change(roles[0],{target:{value:'cliente'}})
 fireEvent.change(nav[1],{target:{value:'navigable'}})
 assert.equal(roles[0].value,'cliente')
 assert.equal(nav[1].value,'navigable')
 assert.deepEqual(doc,before)
})

it('Despliegue: la composición expone multiplicidades del todo y la parte y su representación compartida',()=>{
 const {doc,before,updates}=relation('c')
 assert.ok(screen.getByLabelText('Multiplicidad del todo'))
 assert.ok(screen.getByLabelText('Multiplicidad de la parte'))
 change('Multiplicidad del todo','1');change('Multiplicidad de la parte','0..*')
 click('Guardar relación')
 assert.equal(updates.length,1,err())
 const rec=updates[0].deploymentRelations?.c
 assert.equal(rec?.kind,'composition')
 if(rec?.kind==='composition'){assert.equal(rec.wholeMultiplicity,'1');assert.equal(rec.partMultiplicity,'0..*')}
 assert.deepEqual(doc,before)
})

it('Despliegue: eliminar aparición o registro se delega a acciones distintas sin mutación implícita',()=>{
 let removeView=0,removeModel=0,close=0
 const {doc,before,updates}=relation('p2',{onDelete:()=>removeView++,onDeleteSemantic:()=>removeModel++,onClose:()=>close++})
 click('Quitar aparición');click('Eliminar del modelo');click('Cancelar')
 assert.equal(removeView,1);assert.equal(removeModel,1);assert.equal(close,1)
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: relación deshabilitada no permite persistir pero conserva los controles de cancelación',()=>{
 let close=0
 const {doc,before,updates}=relation('p2',{disabled:true,onClose:()=>close++})
 assert.equal((screen.getByRole('button',{name:'Guardar relación'}) as HTMLButtonElement).disabled,true)
 assert.equal((screen.getByLabelText('Tipo de relación UML') as HTMLSelectElement).matches(':disabled'),true)
 click('Cancelar');assert.equal(close,1)
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: valor JSON de slot inválido bloquea edición y permite corregir sin perder identidad',()=>{
 const doc=source(),before=structuredClone(doc),updates:unknown[]=[]
 render(<DeploymentDetails doc={doc} element={doc.elements['host-instance']} disabled={false} onSave={x=>(updates.push(x),true)}/> )
 fireEvent.blur(screen.getByLabelText('Valor JSON del slot'),{target:{value:'NaN }'}})
 assert.match(err(),/valor JSON/i)
 assert.equal((screen.getByRole('button',{name:'Aplicar propiedades de despliegue'}) as HTMLButtonElement).disabled,true)
 assert.equal(updates.length,0)
 fireEvent.blur(screen.getByLabelText('Valor JSON del slot'),{target:{value:'4'}})
 assert.equal(err(),'')
 assert.deepEqual(doc,before)
})

it('Despliegue: crear y retirar un slot conserva la ficha y no guarda de forma automática',()=>{
 const doc=source(),before=structuredClone(doc),updates:unknown[]=[]
 render(<DeploymentDetails doc={doc} element={doc.elements['host-instance']} disabled={false} onSave={x=>(updates.push(x),true)}/> )
 const count=screen.getAllByRole('button',{name:'Quitar slot'}).length
 click('Añadir slot')
 assert.equal(screen.getAllByRole('button',{name:'Quitar slot'}).length,count+1)
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar slot'})[count])
 assert.equal(screen.getAllByRole('button',{name:'Quitar slot'}).length,count)
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})

it('Despliegue: propiedad de parte ofrece nodos válidos y edición de multiplicidad sin cambiar el elemento',()=>{
 const doc=source(),before=structuredClone(doc),updates:unknown[]=[]
 render(<DeploymentDetails doc={doc} element={doc.elements.role} disabled={false} onSave={x=>(updates.push(x),true)}/> )
 const selector=screen.getByLabelText('Tipo de parte') as HTMLSelectElement
 assert.ok([...selector.options].some(o=>o.value==='node'))
 change('Multiplicidad','1..*')
 assert.equal((screen.getByLabelText('Multiplicidad') as HTMLInputElement).value,'1..*')
 assert.equal(updates.length,0);assert.deepEqual(doc,before)
})
