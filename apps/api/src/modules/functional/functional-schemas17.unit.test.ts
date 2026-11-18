import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import type {PoolClient} from 'pg'
import {validateField,validateFunctionalPayload,validateTemplate,defaultFunctionalPayload} from './functional.policy'
import {templateFieldsPayload,resolveTemplateFields} from './functional-template-fields'
import {exportFunctionalBundle,importFunctionalBundle,parseFunctionalBundle,validateTransferSelection} from './functional-transfer'
import type {TransferSelection} from './functional-transfer'

const id=randomUUID(),projectId=randomUUID(),userId=randomUUID()
const row={id,name:'Matriz de ejecución',field_type:'table',required:true,options:[],scope:'template'}
const templateElement={id:randomUUID(),name:'Tabla de verificaciones',kind:'table',page:0,field:'custom:'+id,x:12,y:20,width:160,height:40,rows:2,cols:2,cells:[['Paso','Estado'],['','']],fontSize:10,fontFamily:'Arial'}
const selections:TransferSelection={finding:'template',rf:'form',rnf:'none',story:'both',asis:'none'}
const fake=()=>{
 const fields:Record<string,unknown>[]=[];const templates:Record<string,unknown>[]=[]
 const query=async(sql:string,args:unknown[]=[]):Promise<{rows:any[];rowCount:number}>=>{
  if(sql.startsWith('SELECT id,name,field_type,required,options,scope FROM functional_fields'))return {rows:fields,rowCount:fields.length}
  if(sql.startsWith('SELECT id,field_type FROM functional_fields'))return {rows:fields,rowCount:fields.length}
  if(sql.startsWith('INSERT INTO functional_fields')){const r={id:randomUUID(),name:args[2],field_type:args[3],required:args[4],options:JSON.parse(String(args[5])),scope:args[6]||'template'};fields.push(r);return {rows:[r],rowCount:1}}
  if(sql.startsWith('SELECT id,name,paper,orientation,page_count,is_default,layout FROM functional_templates'))return {rows:templates,rowCount:templates.length}
  if(sql.startsWith('SELECT name FROM functional_templates'))return {rows:templates.map(x=>({name:x.name})),rowCount:templates.length}
  if(sql.startsWith('SELECT id FROM functional_templates')){const r=templates.filter(t=>t.is_default);return {rows:r,rowCount:r.length}}
  if(sql.startsWith('INSERT INTO functional_templates')){const t={id:randomUUID(),name:args[2],paper:args[3],orientation:args[4],page_count:args[5],layout:JSON.parse(String(args[6])),is_default:args[7]};templates.push(t);return {rows:[],rowCount:1}}
  throw Error('SQL no simulado: '+sql)
 }
 return {c:{query} as unknown as PoolClient,fields,templates}
}

test('Tipos amplios de formulario: tabla, lista, selección múltiple, fecha y hora, imagen y moneda',()=>{
 const fields=[{id,field_type:'table' as const,name:'Tabla',required:true,options:[]},{id:'lista',field_type:'list' as const,name:'Lista',required:false,options:[]},{id:'checks',field_type:'checkbox_group' as const,name:'Opciones',required:false,options:['A','B']}]
 const initial=defaultFunctionalPayload('rf',userId)
 const payload={...initial,description:'Requisito de prueba',custom:{[id]:[['Caso','Estado'],['Login','OK']],lista:['Uno','Dos'],checks:['A']}}
 const valid=validateFunctionalPayload('rf',payload,fields)
 assert.deepEqual(valid.custom?.[id],[['Caso','Estado'],['Login','OK']])
 assert.deepEqual(valid.custom?.checks,['A'])
 assert.throws(()=>validateFunctionalPayload('rf',{...payload,custom:{...payload.custom,[id]:[['',''],['','']]}},fields),/requerido/)
 assert.throws(()=>validateFunctionalPayload('rf',{...payload,custom:{...payload.custom,checks:['A','Z']}},fields),/Opción inválida/)
 assert.equal(validateField({name:'Imagen principal',fieldType:'image',required:false}).fieldType,'image')
 assert.equal(validateField({name:'Hora de revisión',fieldType:'time'}).fieldType,'time')
 assert.equal(validateField({name:'Valor total',fieldType:'currency'}).fieldType,'currency')
 assert.throws(()=>validateField({name:'Lista de opciones',fieldType:'multi_select',options:[]}),/requiere opciones/)
})
test('Los campos creados desde una plantilla tienen identificadores provisionales no reutilizables',()=>{
 const uuid=randomUUID(),items=templateFieldsPayload([{clientId:'pending:'+uuid,name:'Matriz de ejecución',fieldType:'table',required:true,options:[]}])
 assert.equal(items[0].clientId,'pending:'+uuid)
 assert.throws(()=>templateFieldsPayload([{...items[0]}, {...items[0]}]),/duplicado/)
 assert.throws(()=>templateFieldsPayload([{clientId:'no-valid',name:'Campo'}]),/provisional/)
})
test('Guardado de plantilla crea y vincula nuevos campos atómicamente y no admite referencias inexistentes',async()=>{
 const mock=fake(),tempId='pending:'+randomUUID(),newFields=templateFieldsPayload([{clientId:tempId,name:'Matriz de ejecución',fieldType:'table',required:true,options:[]}])
 const layout=await resolveTemplateFields(mock.c,projectId,'finding',[{...templateElement,field:tempId} as any],newFields)
 assert.equal(mock.fields.length,1)
 assert.equal(mock.fields[0].scope,'template')
 assert.equal(layout[0].field,'custom:'+mock.fields[0].id)
 await assert.rejects(resolveTemplateFields(mock.c,projectId,'finding',[{...templateElement,field:'custom:'+randomUUID()} as any],[]),/no existe/)
 await assert.rejects(resolveTemplateFields(mock.c,projectId,'finding',[{...templateElement,field:'custom:'+mock.fields[0].id,kind:'checkbox'} as any],[]),/tipo de campo compatible/)
})
test('Combinación JSON: por tipo documental se elige formulario, plantilla o ambos',()=>{
 assert.deepEqual(validateTransferSelection(selections),selections)
 assert.throws(()=>validateTransferSelection({finding:'none'}),/Selecciona/)
 assert.throws(()=>validateTransferSelection({finding:'bug'}),/inválida/)
 const layout=validateTemplate({name:'Documento con tabla',kind:'finding',layout:[templateElement]})
 const bundle={format:'NOVZI-FUNCTIONAL-SCHEMAS',version:1,exportedAt:'2026-11-18',selections:{...selections,rf:'none',story:'none',asis:'none'},kinds:{finding:{templates:[layout],fieldDependencies:[{id,...validateField({name:'Matriz de ejecución',fieldType:'table',required:true}),scope:'template'}]}}}
 assert.equal(parseFunctionalBundle(bundle).kinds.finding?.templates?.[0].layout[0].field,'custom:'+id)
 assert.throws(()=>parseFunctionalBundle({...bundle,version:2}),/incompatible/)
})
test('Plantilla sola exporta dependencias e importa tabla con nuevo ID, sin alterar los campos del proyecto',async()=>{
 const source=fake();source.fields.push({...row});source.templates.push({id:randomUUID(),name:'Ficha de hallazgo',paper:'A4',orientation:'portrait',page_count:1,is_default:true,layout:[templateElement]})
 const bundle=await exportFunctionalBundle(source.c,projectId,{finding:'template',rf:'none',rnf:'none',story:'none',asis:'none'})
 assert.equal(bundle.kinds.finding?.form,undefined)
 assert.deepEqual(bundle.kinds.finding?.fieldDependencies?.map(f=>f.id),[id])
 const target=fake();const result=await importFunctionalBundle(target.c,projectId,userId,parseFunctionalBundle(bundle))
 assert.equal(result.addedTemplates,1);assert.equal(result.addedFields,1)
 assert.equal(target.fields[0].scope,'template')
 assert.equal((target.templates[0].layout as {field:string}[])[0].field,'custom:'+target.fields[0].id)
 assert.notEqual(target.fields[0].id,id)
 const next=await importFunctionalBundle(target.c,projectId,userId,parseFunctionalBundle(bundle))
 assert.equal(next.reusedFields,1);assert.equal(target.fields.length,1)
 assert.equal(target.templates.length,2)
 assert.notEqual(target.templates[0].name,target.templates[1].name)
})
test('Formulario solo convierte campos ligados a plantillas en campos generales visibles',async()=>{
 const target=fake()
 const bundle={format:'NOVZI-FUNCTIONAL-SCHEMAS' as const,version:1 as const,exportedAt:'2026-11-18',selections:{finding:'form' as const,rf:'none' as const,rnf:'none' as const,story:'none' as const},kinds:{finding:{form:{fields:[{id,...validateField({name:'Lista de pruebas',fieldType:'list'}),scope:'template' as const}]}}}}
 await importFunctionalBundle(target.c,projectId,userId,parseFunctionalBundle(bundle))
 assert.equal(target.fields[0].scope,'global')
})
