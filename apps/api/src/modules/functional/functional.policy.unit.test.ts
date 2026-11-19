import test from 'node:test'
import assert from 'node:assert/strict'
import {FUNCTIONAL_PREFIX,defaultFunctionalPayload,defaultTemplateLayout,validateFunctionalPayload,validateField,validateTemplate,safeUrl} from './functional.policy'
const finding=()=>({...defaultFunctionalPayload('finding','00000000-0000-4000-8000-000000000001'),module:'Login',feature:'Acceso',scenario:'Intentar ingresar',steps:['Ingresar credenciales'],obtained:'No responde',impact:'Usuario bloqueado'})
test('HAL secuencial por tipo y códigos independientes',()=>{assert.deepEqual(FUNCTIONAL_PREFIX,{finding:'HAL',rf:'RF',rnf:'RNF',story:'HU',asis:'ASIS'})})
test('hallazgo incluye campos de revisión y conserva estados independientes',()=>{const x=validateFunctionalPayload('finding',finding());assert.equal(x.functionalState,'No verificado');assert.equal(x.findingStatus,'Pendiente de validar');assert.deepEqual(x.steps,['Ingresar credenciales'])})
test('la confirmación exige resultado esperado',()=>{assert.throws(()=>validateFunctionalPayload('finding',{...finding(),findingStatus:'Confirmado'}),/resultado esperado/);assert.equal(validateFunctionalPayload('finding',{...finding(),findingStatus:'Confirmado',expected:'Inicia sesión'}).findingStatus,'Confirmado')})
test('hallazgos sin pasos no se guardan',()=>assert.throws(()=>validateFunctionalPayload('finding',{...finding(),steps:['']}),/al menos un paso/))
test('hallazgo no admite estado inventado',()=>assert.throws(()=>validateFunctionalPayload('finding',{...finding(),functionalState:'Perfecto'}),/Opción inválida/))
test('código y fecha maliciosa se rechazan',()=>assert.throws(()=>validateFunctionalPayload('finding',{...finding(),reviewDate:'2026-01-01\nSQL'}),/Fecha inválida|Campo inválido/))
test('enlaces a evidencias admiten HTTP(S) y rechazan javascript:',()=>{assert.equal(safeUrl('https://ejemplo.test/evidencia'),'https://ejemplo.test/evidencia');assert.throws(()=>safeUrl('javascript:alert(1)'),/HTTPS/)})
test('RF/RNF admiten criterios de aceptación numerados',()=>{for(const kind of ['rf','rnf'] as const){const x=validateFunctionalPayload(kind,{description:'El sistema debe hacer X',priority:'Alta',status:'Borrador',acceptanceCriteria:['Se verifica Y']});assert.equal(x.acceptanceCriteria?.length,1)}})
test('HU requiere Como / Quiero / Para',()=>{assert.throws(()=>validateFunctionalPayload('story',{description:'Historia',priority:'Media',status:'Borrador',role:'Usuario',goal:'',benefit:'Acceder'}),/quiero/);assert.equal(validateFunctionalPayload('story',{description:'Historia',role:'Usuario',goal:'Ingresar',benefit:'Acceder'}).goal,'Ingresar')})
test('campos personalizados: requiere selección válida',()=>{const fields=[{id:'id1',name:'Impacto QA',field_type:'select' as const,required:true,options:['Alto','Medio']}];assert.throws(()=>validateFunctionalPayload('finding',finding(),fields),/requerido/);assert.throws(()=>validateFunctionalPayload('finding',{...finding(),custom:{id1:'Menor'}},fields),/Selección inválida/);assert.equal(validateFunctionalPayload('finding',{...finding(),custom:{id1:'Alto'}},fields).custom?.id1,'Alto')})
test('definiciones de campo no admiten listas vacías',()=>{assert.throws(()=>validateField({name:'Categoría',fieldType:'select',options:[]}),/requiere opciones/);assert.equal(validateField({name:'Revisión',fieldType:'date',required:true}).required,true)})
test('plantillas permiten posicionamiento, tipografía y no se salen de la página',()=>{const t=validateTemplate({name:'Formato QA',kind:'finding',paper:'A4',orientation:'portrait',layout:defaultTemplateLayout(),isDefault:true});assert.ok(t.layout.length>8);for(const kind of ['rf','rnf','story'] as const){const other=defaultTemplateLayout(kind);assert.ok(other.some(x=>x.field==='description'));assert.ok(other.some(x=>x.field==='acceptanceCriteria'))}assert.throws(()=>validateTemplate({...t,layout:[{...t.layout[0],x:205}]}),/fuera de la página/)})
test('plantillas evitan identificadores repetidos y SVG externos',()=>{const layout=defaultTemplateLayout();assert.throws(()=>validateTemplate({name:'QA',kind:'finding',layout:[layout[0],layout[0]]}),/duplicados/);assert.throws(()=>validateTemplate({name:'QA',kind:'finding',layout:[{...layout[0],image:'data:image/svg+xml;base64,AAAA'}]}),/Solo imágenes/)})

test('AS-IS valida los campos propios y su plantilla independiente',()=>{
 const x=defaultFunctionalPayload('asis','00000000-0000-4000-8000-000000000001')
 assert.equal(x.assessmentResult,'No verificado')
 assert.throws(()=>validateFunctionalPayload('asis',x),/proceso o funcionalidad/)
 const good={...x,processName:'Autenticación',observedBehavior:'La recuperación no responde',scope:'Web'}
 assert.equal(validateFunctionalPayload('asis',good).processName,'Autenticación')
 assert.throws(()=>validateFunctionalPayload('asis',{...good,assessmentResult:'Increíble'}),/Opción inválida/)
 const layout=defaultTemplateLayout('asis')
 assert.ok(layout.some(e=>e.field==='observedBehavior'))
 assert.ok(validateTemplate({name:'Diagnóstico AS-IS',kind:'asis',layout}).layout.length>5)
})
