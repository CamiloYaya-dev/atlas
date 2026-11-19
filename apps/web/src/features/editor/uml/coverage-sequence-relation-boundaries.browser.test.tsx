import {it,afterEach} from 'vitest'
import assert from 'node:assert/strict'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import type {ProjectDocument} from '@novzi/contracts'
import SequenceRelationDialog from './SequenceRelationDialog'
import fixture from '../../../../../../qa/NOVZI_QA_UML_SECUENCIA.json'

afterEach(cleanup)
const source=()=>structuredClone(fixture) as ProjectDocument
const edge=(d:ProjectDocument,id:string)=>d.diagrams[0].edges.find(e=>e.id===id)!
const click=(label:string)=>fireEvent.click(screen.getByRole('button',{name:label}))
const change=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}})
const alert=()=>screen.queryByRole('alert')?.textContent||''
const start=(id:string,props:{disabled?:boolean;onClose?:()=>void;onDelete?:()=>void}={})=>{
 const doc=source(),before=structuredClone(doc),saved:ProjectDocument[]=[]
 render(<SequenceRelationDialog doc={doc} diagram={doc.diagrams[0]} initial={edge(doc,id)} disabled={!!props.disabled} onClose={props.onClose||(()=>{})} onSave={x=>saved.push(x)} onDelete={props.onDelete}/> )
 return {doc,before,saved}
}

it('Secuencia: modificar una familia con firmas existentes exige confirmación y cancelar preserva datos',()=>{
 const {doc,before,saved}=start('call')
 assert.equal((screen.getByLabelText('Firma') as HTMLSelectElement).value,'payment-type|pay-op')
 change('Familia de relación','annotation')
 assert.match(alert(),/familia de relación/)
 assert.equal((screen.getByRole('button',{name:'Guardar mensaje'}) as HTMLButtonElement).disabled,true)
 click('Conservar configuración')
 assert.equal((screen.getByLabelText('Familia de relación') as HTMLSelectElement).value,'message')
 assert.equal((screen.getByLabelText('Firma') as HTMLSelectElement).value,'payment-type|pay-op')
 assert.equal((screen.getByLabelText('Valor') as HTMLInputElement).value,'id')
 assert.equal(saved.length,0);assert.deepEqual(doc,before)
})

it('Secuencia: cambiar familia tras confirmar muestra anotación sin suprimir el catálogo original',()=>{
 const {doc,before}=start('call')
 change('Familia de relación','annotation');click('Confirmar cambio')
 assert.equal((screen.getByLabelText('Familia de relación') as HTMLSelectElement).value,'annotation')
 assert.ok(screen.getByLabelText('Mensaje anotado'))
 assert.equal(screen.queryByLabelText('MessageSort'),null)
 assert.deepEqual(doc,before)
})

it('Secuencia: cancelar cambio de modalidad conserva firma, argumentos y correlación original',()=>{
 const {doc,before,saved}=start('reply')
 assert.equal((screen.getByLabelText('Respuesta a') as HTMLSelectElement).value,'call')
 change('MessageSort','asynchCall')
 assert.match(alert(),/quitará la firma/i)
 assert.equal((screen.getByRole('button',{name:'Guardar mensaje'}) as HTMLButtonElement).disabled,true)
 click('Conservar modalidad')
 assert.equal((screen.getByLabelText('MessageSort') as HTMLSelectElement).value,'reply')
 assert.equal((screen.getByLabelText('Valor') as HTMLInputElement).value,'resultado')
 assert.equal((screen.getByLabelText('Respuesta a') as HTMLSelectElement).value,'call')
 assert.equal(saved.length,0);assert.deepEqual(doc,before)
})

it('Secuencia: cambiar sort confirmado reinicia únicamente los datos incompatibles del borrador',()=>{
 const {doc,before}=start('reply')
 change('MessageSort','asynchCall');click('Confirmar cambio de modalidad')
 assert.equal((screen.getByLabelText('MessageSort') as HTMLSelectElement).value,'asynchCall')
 assert.equal((screen.getByLabelText('Firma') as HTMLSelectElement).value,'')
 assert.equal(screen.queryByLabelText('Respuesta a'),null)
 assert.equal(screen.queryByLabelText('Valor'),null)
 assert.deepEqual(doc,before)
})

it('Secuencia: cambiar respuesta correlacionada requiere confirmación y cancelar conserva argumentos',()=>{
 const {doc,before,saved}=start('reply')
 change('Respuesta a','')
 assert.match(alert(),/correlación de respuesta/i)
 click('Conservar configuración')
 assert.equal((screen.getByLabelText('Respuesta a') as HTMLSelectElement).value,'call')
 assert.equal((screen.getByLabelText('Valor') as HTMLInputElement).value,'resultado')
 assert.deepEqual(doc,before);assert.equal(saved.length,0)
})

it('Secuencia: argumento adicional permite estructura de valores, adición y retirada sin modificar origen',()=>{
 const {doc,before}=start('call')
 click('Agregar argumento')
 const boxes=screen.getAllByLabelText('Valores estructurados')
 fireEvent.click(boxes[1]);click('Agregar valor')
 const values=screen.getAllByLabelText('Valor 1') as HTMLInputElement[]
 fireEvent.change(values[0],{target:{value:'alfa'}})
 assert.equal(values[0].value,'alfa')
 click('Agregar valor')
 assert.ok(screen.getByLabelText('Valor 2'))
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar valor'})[1])
 assert.equal(screen.queryByLabelText('Valor 2'),null)
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar argumento'})[1])
 assert.equal(screen.getAllByRole('button',{name:'Quitar argumento'}).length,1)
 assert.deepEqual(doc,before)
})

it('Secuencia: cambio de firma con argumento previo exige confirmación y lo conserva si se cancela',()=>{
 const {doc,before}=start('call')
 change('Firma','')
 assert.match(alert(),/firma/i)
 click('Conservar configuración')
 assert.equal((screen.getByLabelText('Firma') as HTMLSelectElement).value,'payment-type|pay-op')
 assert.equal((screen.getByLabelText('Valor') as HTMLInputElement).value,'id')
 assert.deepEqual(doc,before)
})

it('Secuencia: pasar de mensaje completo a encontrado requiere confirmación y oculta emisor',()=>{
 const {doc,before}=start('async')
 change('Alcance','found')
 assert.match(alert(),/alcance del mensaje/)
 click('Confirmar cambio')
 assert.equal((screen.getByLabelText('Alcance') as HTMLSelectElement).value,'found')
 assert.equal(screen.queryByLabelText('Emisor'),null)
 assert.ok(screen.getByLabelText('Receptor'))
 assert.deepEqual(doc,before)
})

it('Secuencia: un mensaje perdido permite elegir emisor pero nunca ofrece receptor',()=>{
 const {doc,before}=start('lost')
 assert.equal((screen.getByLabelText('Alcance') as HTMLSelectElement).value,'lost')
 assert.ok(screen.getByLabelText('Emisor'))
 assert.equal(screen.queryByLabelText('Receptor'),null)
 assert.ok(screen.getByLabelText('Ocurrencia de envío'))
 assert.equal(screen.queryByLabelText('Ocurrencia de recepción'),null)
 assert.deepEqual(doc,before)
})

it('Secuencia: general ordering muestra referencias semánticas de ocurrencias y no argumentos de mensaje',()=>{
 const {doc,before}=start('order')
 assert.ok(screen.getByText('Configurar mensaje de secuencia'))
 assert.ok(screen.getByText('Antes'))
 assert.ok(screen.getByText('Después'))
 assert.equal(screen.queryByLabelText('MessageSort'),null)
 assert.equal(screen.queryByLabelText('Firma'),null)
 assert.deepEqual(doc,before)
})

it('Secuencia: editor deshabilitado conserva modo lectura, permite cancelar pero impide guardar',()=>{
 let closes=0,deletes=0
 const {doc,before,saved}=start('call',{disabled:true,onClose:()=>closes++,onDelete:()=>deletes++})
 assert.equal(screen.queryByRole('button',{name:'Guardar mensaje'}),null)
 assert.equal((screen.getByLabelText('Familia de relación') as HTMLSelectElement).matches(':disabled'),true)
 click('Eliminar relación');click('Cancelar')
 assert.equal(deletes,1);assert.equal(closes,1);assert.equal(saved.length,0);assert.deepEqual(doc,before)
})

it('Secuencia: anotación solo referencia mensajes existentes y permite editar el texto, no los extremos arbitrariamente',()=>{
 const {doc,before}=start('note')
 assert.equal((screen.getByLabelText('Familia de relación') as HTMLSelectElement).value,'annotation')
 const targets=screen.getByLabelText('Mensaje anotado') as HTMLSelectElement
 assert.ok([...targets.options].some(o=>o.value==='call'))
 assert.ok(![...targets.options].some(o=>o.value==='note'))
 change('Descripción','Comentario auditado')
 assert.equal((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value,'Comentario auditado')
 assert.deepEqual(doc,before)
})
