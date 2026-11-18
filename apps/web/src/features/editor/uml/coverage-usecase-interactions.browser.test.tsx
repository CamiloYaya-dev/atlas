import {afterEach,it} from 'vitest'
import assert from 'node:assert/strict'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import type {ProjectDocument,DiagramEdge} from '@atlas/contracts'
import UseCaseDetailsEditor from './UseCaseDetailsEditor'
import UseCaseRelationDialog from './UseCaseRelationDialog'
import fixture from '../../../../../../qa/ATLAS_QA_UML_CASOS_DE_USO.json'

afterEach(cleanup)
const source=()=>structuredClone(fixture) as ProjectDocument
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}))
const change=(name:string,value:string)=>fireEvent.change(screen.getByLabelText(name,{exact:true}),{target:{value}})
const currentError=()=>screen.queryByRole('alert')?.textContent||''

it('Casos de uso: punto referenciado no se elimina accidentalmente y permite cancelar la resolución',()=>{
 const d=source(),before=structuredClone(d),updates:ProjectDocument[]=[]
 render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>assert.fail('No debe editar directamente el punto referenciado')} onDocumentChange={x=>updates.push(x)}/> )
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar punto'})[0])
 assert.match(currentError(),/extensiones vinculadas/i)
 assert.ok(screen.getByText('Resolver punto referenciado'))
 click('Cancelar resolución')
 assert.equal(screen.queryByText('Resolver punto referenciado'),null)
 assert.equal(updates.length,0);assert.deepEqual(d,before)
})

it('Casos de uso: la resolución exige ACL para todas las relaciones afectadas, sin borrar el registro',()=>{
 const d=source(),before=structuredClone(d),updates:ProjectDocument[]=[]
 render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>{}} onDocumentChange={x=>updates.push(x)} canResolve={()=>false}/> )
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar punto'})[0]);click('Confirmar resolución')
 assert.match(currentError(),/No tienes permiso/);assert.equal(updates.length,0)
 assert.deepEqual(d,before)
})

it('Casos de uso: sustituye el punto referenciado en la relación semántica y todas sus apariciones preservando IDs',()=>{
 const d=source(),before=structuredClone(d),updates:ProjectDocument[]=[]
 render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>{}} onDocumentChange={x=>updates.push(x)} canResolve={()=>true}/> )
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar punto'})[0]);click('Confirmar resolución')
 assert.equal(updates.length,1,currentError());const next=updates[0]
 assert.deepEqual(next.elements.book.useCaseDetail?.extensionPoints?.map(p=>p.id),['confirm'])
 assert.deepEqual(next.useCaseRelations?.['sem-r4'].extensionPointIds,['confirm'])
 assert.deepEqual(next.diagrams[0].edges.find(e=>e.id==='r4')?.extensionPointIds,['confirm'])
 assert.equal(next.diagrams[0].edges.find(e=>e.id==='r4')?.semanticRelationId,'sem-r4')
 assert.deepEqual(d,before)
})

it('Casos de uso: eliminar extensiones referenciadas requiere confirmación y elimina el registro completo',()=>{
 const d=source(),updates:ProjectDocument[]=[]
 render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>{}} onDocumentChange={x=>updates.push(x)} canResolve={()=>true}/> )
 fireEvent.click(screen.getAllByRole('button',{name:'Quitar punto'})[0]);change('Sustituir por','');click('Confirmar resolución')
 assert.equal(updates.length,1,currentError());assert.equal(updates[0].useCaseRelations?.['sem-r4'],undefined)
 assert.ok(!updates[0].diagrams[0].edges.some(e=>e.id==='r4'))
 assert.ok(d.diagrams[0].edges.some(e=>e.id==='r4'))
})

it('Casos de uso: relaciones sin aparición exigen confirmación explícita para retirarlas del modelo',()=>{
 const d=source(),before=structuredClone(d),updates:ProjectDocument[]=[]
 d.diagrams[0].edges=d.diagrams[0].edges.filter(e=>e.id!=='r8')
 render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>{}} onDocumentChange={x=>updates.push(x)} canResolve={()=>true}/> )
 assert.ok(screen.getByText('Relaciones del modelo sin aparición'))
 click('Eliminar del modelo');click('Cancelar eliminación');assert.equal(updates.length,0)
 click('Eliminar del modelo');click('Confirmar eliminación del modelo')
 assert.equal(updates.length,1,currentError());assert.equal(updates[0].useCaseRelations?.['sem-r8'],undefined)
 assert.ok(!updates[0].diagrams[0].edges.some(e=>e.semanticRelationId==='sem-r8'))
 assert.equal(d.useCaseRelations?.['sem-r8']?.id,'sem-r8')
 assert.deepEqual(d.diagrams[0],{...before.diagrams[0],edges:before.diagrams[0].edges.filter(e=>e.id!=='r8')})
})

it('Casos de uso: relación sin aparición no se elimina cuando falta autorización y permite reintentar',()=>{
 const d=source(),updates:ProjectDocument[]=[];d.diagrams[0].edges=d.diagrams[0].edges.filter(e=>e.id!=='r8')
 const {rerender}=render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>{}} onDocumentChange={x=>updates.push(x)} canResolve={()=>false}/> )
 click('Eliminar del modelo');click('Confirmar eliminación del modelo')
 assert.match(currentError(),/No tienes permiso/);assert.equal(updates.length,0)
 rerender(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={()=>{}} onDocumentChange={x=>updates.push(x)} canResolve={()=>true}/> )
 click('Confirmar eliminación del modelo');assert.equal(updates.length,1,currentError())
})

it('Casos de uso: un sujeto UML selecciona únicamente clasificadores válidos y no inventa una caja nueva',()=>{
 const d=source(),before=structuredClone(d),updates:unknown[]=[]
 render(<UseCaseDetailsEditor doc={d} element={d.elements.s} disabled={false} onChange={x=>updates.push(x)}/> )
 const selector=screen.getByLabelText('Clasificador del sujeto') as HTMLSelectElement
 assert.ok([...selector.options].some(o=>o.value==='class'))
 assert.ok(![...selector.options].some(o=>o.value==='book'))
 change('Clasificador del sujeto','class');assert.equal(updates.length,1)
 assert.equal((updates[0] as {classifierId?:string}).classifierId,'class')
 assert.deepEqual(d,before)
})

it('Relaciones de casos: cambiar asociación a dependencia descarta roles, multiplicidad y navegabilidad',()=>{
 const d=source(),saved:DiagramEdge[]=[]
 const initial=d.diagrams[0].edges.find(e=>e.id==='r8')!
 render(<UseCaseRelationDialog doc={d} diagram={d.diagrams[0]} initial={{...initial,relationKind:'association',sourceRole:'cliente',targetMultiplicity:'1..*',sourceNavigability:'navigable'}} disabled={false} onClose={()=>{}} onSave={e=>saved.push(e)}/> )
 change('Tipo de relación UML','dependency');change('Contexto de dependencia','restricción externa');click('Guardar relación')
 assert.equal(saved.length,1,currentError());const e=saved[0];assert.equal(e.sourceRole,undefined);assert.equal(e.targetMultiplicity,undefined);assert.equal(e.sourceNavigability,undefined)
 assert.equal(e.dependencyContext,'restricción externa');assert.equal(e.semanticRelationId,initial.semanticRelationId)
})

it('Relaciones de casos: el tipo extend admite reordenar puntos, condición y ocultar la nota',()=>{
 const d=source(),saved:DiagramEdge[]=[];const original=d.diagrams[0].edges.find(e=>e.id==='r4')!
 render(<UseCaseRelationDialog doc={d} diagram={d.diagrams[0]} initial={original} disabled={false} onClose={()=>{}} onSave={e=>saved.push(e)}/> )
 change('Condición de extensión','Cupón aprobado');const first=screen.getByLabelText('Antes del pago') as HTMLInputElement
 fireEvent.click(first);fireEvent.click(first)
 fireEvent.click(screen.getByLabelText('Mostrar nota de extensión'))
 click('Guardar relación')
 assert.equal(saved.length,1,currentError());assert.deepEqual(saved[0].extensionPointIds,['confirm','before-pay'])
 assert.equal(saved[0].extensionCondition,'Cupón aprobado');assert.equal(saved[0].showExtensionNote,false)
 assert.deepEqual(original.extensionPointIds,['before-pay','confirm'])
})

it('Relaciones de casos: relación inválida conserva el modelo y el diálogo admite cancelar',()=>{
 const d=source(),saved:DiagramEdge[]=[];const before=structuredClone(d)
 render(<UseCaseRelationDialog doc={d} diagram={d.diagrams[0]} initial={{id:'new',source:'n-book',target:'n-validate',relationKind:'association'}} disabled={false} onClose={()=>{}} onSave={e=>saved.push(e)}/> )
 assert.equal((screen.getByRole('button',{name:'Guardar relación'}) as HTMLButtonElement).disabled,true)
 change('Tipo de relación UML','include');click('Guardar relación')
 assert.equal(saved.length,1,currentError());assert.deepEqual(d,before)
})

it('Casos de uso: rechaza nombres duplicados de puntos de extensión y admite corrección preservando identidad',()=>{
 const d=source(),before=structuredClone(d),updates:unknown[]=[]
 render(<UseCaseDetailsEditor doc={d} element={d.elements.book} disabled={false} onChange={u=>updates.push(u)}/> )
 const input=screen.getByLabelText('Nombre punto before-pay')
 fireEvent.blur(input,{target:{value:'Confirmación'}})
 assert.match(currentError(),/duplicado/i);assert.equal(updates.length,0)
 fireEvent.blur(input,{target:{value:'Antes del cobro'}})
 assert.equal(updates.length,1,currentError())
 const detail=updates[0] as {extensionPoints:{id:string;name:string}[]}
 assert.deepEqual(detail.extensionPoints.map(p=>p.id),['before-pay','confirm']);assert.equal(detail.extensionPoints[0].name,'Antes del cobro')
 assert.deepEqual(d,before)
})

it('Casos de uso: un nuevo diagrama reutiliza registro semántico sin crear otra identidad',()=>{
 const d=source(),saved:DiagramEdge[]=[]
 const initial:DiagramEdge={id:'r-qa-new',source:'n-a',target:'n-book',relationKind:'association'}
 render(<UseCaseRelationDialog doc={d} diagram={d.diagrams[0]} initial={initial} disabled={false} onClose={()=>{}} onSave={e=>saved.push(e)}/> )
 assert.ok(screen.getByLabelText('Reutilizar relación semántica'))
 change('Reutilizar relación semántica','sem-r1');click('Guardar relación')
 assert.equal(saved.length,1,currentError());assert.equal(saved[0].semanticRelationId,'sem-r1')
 assert.equal(saved[0].source,'n-a');assert.equal(saved[0].target,'n-book')
 assert.equal(d.useCaseRelations?.['sem-r1']?.id,'sem-r1')
})

it('Casos de uso: una nota puede anclarse a una relación existente sin alterar el registro anotado',()=>{
 const d=source(),before=structuredClone(d),saved:DiagramEdge[]=[]
 const initial=d.diagrams[0].edges.find(e=>e.id==='r12')!
 render(<UseCaseRelationDialog doc={d} diagram={d.diagrams[0]} initial={initial} disabled={false} onClose={()=>{}} onSave={e=>saved.push(e)}/> )
 change('Anclar a relación','r4');click('Guardar relación')
 assert.equal(saved.length,1,currentError());assert.equal(saved[0].annotationTargetEdgeId,'r4')
 assert.equal(saved[0].target,d.diagrams[0].edges.find(e=>e.id==='r4')?.source)
 assert.deepEqual(d,before)
})
