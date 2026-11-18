import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {emptyDoc,createElement,canonicalUmlEdge,isProjectDocument,ROLE_PRESETS,umlElementCreatable,umlRelationCreatable,umlRelationEndpointValid,UML_ELEMENTS_BY_DIAGRAM} from '@novzi/contracts'
import type {ProjectDocument} from '@novzi/contracts'
import {applyAuthorizedChange,projectVisible} from '../modules/projects/application/document-policy'
import {renderDiagramSVG} from '../modules/exports/render-svg'
import type {Access} from '../security/roles'
import {connectNodes} from '../../../web/src/features/editor/domain/document-commands'
// Explicit representative pairs, not derived from the endpoint validator under test.
import {examples} from '../../../../qa/uml-scoped-fixtures'
const access=(key:string):Access=>({roleId:key,roleKey:key,roleName:key,permissions:new Set(ROLE_PRESETS.find(r=>r.key===key)!.permissions)})
for(const [type,a,b,kind] of examples){
 test(`[${type}] contrato, conexión, política de guardado y roundtrip`,()=>{
  let doc=emptyDoc();for(const [id,t] of [['a',a],['b',b]] as const)doc.elements[id]={...createElement(`QA ${id}`,t),id}
  doc.diagrams.push({id:'d',type,name:'QA UML',description:'',createdAt:'2026-11-16',nodes:[{id:'na',elementId:'a',x:20,y:20},{id:'nb',elementId:'b',x:500,y:20}],edges:[]})
  assert.ok(umlElementCreatable(type,a));assert.ok(umlElementCreatable(type,b));assert.ok(!umlElementCreatable(type,'database'));assert.ok(UML_ELEMENTS_BY_DIAGRAM[type]?.length)
  assert.ok(umlRelationCreatable(type,kind));assert.ok(!umlRelationCreatable(type,'__invalid__'));assert.ok(umlRelationEndpointValid(type,kind,a,b))
  const before=structuredClone(doc);const e=canonicalUmlEdge(type,{id:'r',source:'na',target:'nb',relationKind:kind});doc=connectNodes(doc,'d',e)
  assert.equal(before.diagrams[0].edges.length,0);assert.throws(()=>connectNodes(doc,'d',e),/duplicado/)
  assert.throws(()=>connectNodes(doc,'d',{...e,id:'bad',target:'missing'}),/inexistentes/)
  assert.ok(isProjectDocument(doc));const saved=applyAuthorizedChange(emptyDoc(),JSON.parse(JSON.stringify(doc)),access('owner'));assert.deepEqual(saved.diagrams[0].edges,JSON.parse(JSON.stringify(doc.diagrams[0].edges)))
  const visible=projectVisible(saved,access('viewer'));if(visible.diagrams.length){const changed=structuredClone(visible);changed.diagrams[0].name='No autorizado';assert.throws(()=>applyAuthorizedChange(saved,changed,access('viewer')))}
  const {svg,width,height}=renderDiagramSVG(saved,saved.diagrams[0],true);assert.ok(width>0&&height>0);assert.match(svg,/<svg\b/);if(type==='uml-activity'){assert.match(svg,/«Initial»/);assert.match(svg,/<circle\b/);assert.match(svg,/QA b/)}else assert.match(svg,/QA a/)
 })
}
test('[uml-class] fixture integral de clases: contrato, policy, exportación y roundtrip',()=>{
 const doc=JSON.parse(readFileSync(new URL('../../../../qa/NOVZI_QA_UML_CLASES.json',import.meta.url),'utf8')) as ProjectDocument
 // The fixture is a plain project document, not an import wrapper.
 assert.ok(isProjectDocument(doc));assert.equal(doc.diagrams.length,1);assert.equal(doc.diagrams[0].type,'uml-class')
 const stored=applyAuthorizedChange(emptyDoc(),doc,access('owner'));assert.deepEqual(stored,doc)
 const svg=renderDiagramSVG(stored,stored.diagrams[0],false).svg;assert.match(svg,/«import»|«use»/);assert.doesNotMatch(svg,/react-flow__handle/)
})
