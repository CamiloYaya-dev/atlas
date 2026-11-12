import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyDoc,isProjectDocument,createElement,DIAGRAM_KINDS,ELEMENT_KINDS,PERMISSIONS,ROLE_PRESETS} from './index'
import {demoDocument} from '@atlas/fixtures'
test('documento inicial y fixture son válidos y serializables',()=>{
 for(const doc of [emptyDoc(),demoDocument()]){
  assert.equal(isProjectDocument(doc),true)
  assert.equal(isProjectDocument(JSON.parse(JSON.stringify(doc))),true)
 }
})
test('validación rechaza entradas sin schema, diagramas, campos o elementos',()=>{
 for(const x of [null,undefined,[],{}, {schema:2,elements:{},diagrams:[],fieldDefinitions:[]},
 {schema:1,elements:[],diagrams:[],fieldDefinitions:[]},{schema:1,elements:{},diagrams:'wrong',fieldDefinitions:[]},
 {schema:1,elements:{a:{id:5}},diagrams:[],fieldDefinitions:[]},
 {schema:1,elements:{},diagrams:[{id:1}],fieldDefinitions:[]},
 {schema:1,elements:{},diagrams:[],fieldDefinitions:[{id:1}]}])assert.equal(isProjectDocument(x),false)
})
test('crear tipos funcionales y técnicos con campos estándar',()=>{
 for(const type of ELEMENT_KINDS){
  const e=createElement(`Elemento ${type}`,type,'QA')
  assert.equal(e.type,type);assert.ok(e.id);assert.equal(e.status,'Borrador')
  assert.deepEqual(e.links,[]);assert.deepEqual(e.fields,{})
 }
})
test('presets cubren todo el catálogo sin permisos desconocidos',()=>{
 for(const role of ROLE_PRESETS)for(const permission of role.permissions)assert.ok(PERMISSIONS.includes(permission as never))
 for(const view of DIAGRAM_KINDS)assert.ok(PERMISSIONS.includes(`diagram.view.${view}` as never))
})
