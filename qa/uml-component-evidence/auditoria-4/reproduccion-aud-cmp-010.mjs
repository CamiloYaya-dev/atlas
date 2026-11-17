// Reproducción literal de la auditoría, sin utilizar los nuevos fixtures A/B.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {componentDocumentIssues, isProjectDocument, emptyDoc, ROLE_PRESETS} from '@atlas/contracts';
import {applyAuthorizedChange} from '../../../apps/api/src/modules/projects/application/document-policy';
import {applyScopedImport} from '../../../apps/api/src/modules/projects/application/import-scope';
const base=JSON.parse(readFileSync(new URL('../../ATLAS_QA_UML_COMPONENTES.json',import.meta.url),'utf8'));
const owner={roleId:'owner',roleKey:'owner',roleName:'owner',permissions:new Set(ROLE_PRESETS.find(r=>r.key==='owner').permissions)};
const empty=()=>({...emptyDoc(),fieldDefinitions:[]});
for(const invalid of [true,false]){
 const d=structuredClone(base);
 if(invalid) for(const id of ['api-type','repo-type']){d.elements[id].type='uml-class';delete d.elements[id].uml.component;}
 d.elements.assoc={...structuredClone(base.elements['api-type']),id:'assoc',name:'Asociacion',type:'uml-association-class'};delete d.elements.assoc.uml;
 d.diagrams.push({id:'class',name:'Tipos de asociación',type:'uml-class',createdAt:'2026-11-16',description:'',nodes:[{id:'a',elementId:invalid?'api-type':'irepo',x:0,y:0},{id:'b',elementId:invalid?'repo-type':'irepo',x:200,y:0},{id:'c',elementId:'assoc',x:100,y:200}],edges:[{id:'association',source:'a',target:'b',relationKind:'association',associationClassId:'assoc',sourceMultiplicity:'1',targetMultiplicity:'1'}]});
 assert.ok(isProjectDocument(d));assert.doesNotThrow(()=>applyAuthorizedChange(empty(),d,owner));assert.doesNotThrow(()=>applyAuthorizedChange(base,d,owner));
 d.componentRelations['rel-internal-assembly'].connector.associationTypeId='assoc';
 assert.ok(isProjectDocument(d));const issues=componentDocumentIssues(d);const ops=[['alta',()=>applyAuthorizedChange(empty(),d,owner)],['actualización',()=>applyAuthorizedChange(base,d,owner)],['importación proyecto',()=>applyScopedImport(empty(),d,{mode:'project'},owner)]];
 if(invalid){assert.ok(issues.some(i=>i.key==='record:rel-internal-assembly'&&i.rule==='connector-association'&&i.severity==='error'));console.log('A — estructura válida, semántica inválida:',issues.filter(i=>i.severity==='error'));for(const [name,op] of ops){assert.throws(op,/Número o tipos de extremos/);console.log('A —',name,'rechazada por causa específica');}}
 else {assert.deepEqual(issues,[]);for(const [name,op] of ops){assert.doesNotThrow(op);console.log('B —',name,'aceptada; cero issues');}}
}
console.log('Reproducciones A y B: conformes.');
