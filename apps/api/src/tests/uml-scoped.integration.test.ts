import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {buildApp} from '../app'
import {pool} from '../db/pool'
import {hashPassword} from '../security/password'
import {emptyDoc,createElement,canonicalUmlEdge,replaceClassRelationAcrossViews} from '@atlas/contracts'
import {examples,scopedFixture} from '../../../../qa/uml-scoped-fixtures'
const expected='postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test'
if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'||process.env.DATABASE_URL!==expected)throw Error('Solo se permite la BD QA local 5433/atlas_test')
after(()=>pool.end())
for(const [type] of examples)test(`[${type}] API HTTP real: importación, invalidación, guardado, historial y exportación`,async()=>{
 const app=await buildApp(),email=`qa-uml-${randomUUID()}@example.test`,password='AtlasQA!2026-local-only';let userId='',workspaceId=''
 try{
  const result=await pool.query<{id:string}>(`INSERT INTO atlas_users(email,display_name,password_hash,platform_admin) VALUES($1,$2,$3,true) RETURNING id`,[email,'QA UML',await hashPassword(password)]);userId=result.rows[0].id
  const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password}});assert.equal(login.statusCode,200,login.body)
  const headers={cookie:String(login.headers['set-cookie']).split(';')[0],'x-csrf-token':login.json().csrfToken}
  const send=(method:'GET'|'POST'|'PUT',path:string,payload?:object)=>app.inject({method,url:'/api/v1'+path,headers,...(payload===undefined?{}:{payload})})
  const ws=await send('POST','/workspaces',{name:'QA UML '+type});assert.equal(ws.statusCode,201,ws.body);workspaceId=ws.json().id
  const p=await send('POST',`/workspaces/${workspaceId}/projects`,{name:'QA '+type,document:emptyDoc()});assert.equal(p.statusCode,201,p.body);const base=`/projects/${p.json().id}`
  const doc=scopedFixture(type),imported=await send('POST',base+'/import',{document:doc,expectedVersion:1});assert.equal(imported.statusCode,200,imported.body);assert.equal(imported.json().version,2)
  const read=await send('GET',base+'/document');assert.equal(read.statusCode,200,read.body);assert.equal(read.json().version,2);assert.deepEqual(read.json().document,doc)
  const invalid=structuredClone(doc);invalid.diagrams[0].edges[0].target='missing';const rejected=await send('PUT',base+'/document',{document:invalid,expectedVersion:2});assert.ok([400,403,409,422].includes(rejected.statusCode),rejected.body)
  const unchanged=await send('GET',base+'/document');assert.equal(unchanged.json().version,2);assert.deepEqual(unchanged.json().document,doc)
  if(type==='uml-class'){
   const invalidCases:[string,(value:typeof doc)=>void][]=[
    ['AUD-CL-001 paquete como atributo',v=>{v.elements.a.uml={...v.elements.a.uml,attributes:[{id:'audit-attr',name:'invalid',type:'Paquete',typeId:'p',visibility:'private'}]}}],
    ['AUD-CL-002 navegabilidad en dependencia',v=>{v.diagrams[0].edges.find(e=>e.relationKind==='dependency')!.sourceNavigability='navigable'}],
    ['AUD-CL-003 slots en clase',v=>{v.elements.a.uml={...v.elements.a.uml,slots:[{id:'audit-slot',name:'saldo',type:'Integer',value:'3'}]}}],
    ['AUD-CL-005 paquete como argumento',v=>{v.diagrams[0].edges.find(e=>e.relationKind==='bind')!.templateBindings=[{parameterId:'T',elementId:'p'}]}],
   ];
   for(const [name,mutate] of invalidCases){const candidate=structuredClone(doc);mutate(candidate);for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const response=await send(method,base+route,{document:candidate,expectedVersion:2});assert.ok([400,403,409,422].includes(response.statusCode),`${name} ${method}: ${response.body}`)}const after=await send('GET',base+'/document');assert.equal(after.json().version,2,name);assert.deepEqual(after.json().document,doc,name)}
  }
  const changed=structuredClone(doc);changed.diagrams[0].name='QA actualizado';const saved=await send('PUT',base+'/document',{document:changed,expectedVersion:2});assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().version,3)
  const history=await send('GET',base+'/versions/2');assert.equal(history.statusCode,200,history.body);assert.deepEqual(history.json().document,doc)
  const exported=await send('GET',base+'/export');assert.equal(exported.statusCode,200,exported.body);assert.deepEqual(exported.json().document,changed)
  if(type==='uml-class'){
   const proposed=structuredClone(doc),view=proposed.diagrams[0];for(const [id,name] of [['qa3-p','P'],['qa3-q','Q'],['qa3-r','R']]){proposed.elements[id]={...createElement(name,'uml-package'),id};view.nodes.push({id:'n'+id,elementId:id,x:0,y:900})}
   for(const [id,name] of [['qa3-a','A'],['qa3-b','B']]){proposed.elements[id]={...createElement(name,'uml-class'),id};view.nodes.push({id:'n'+id,elementId:id,x:400,y:900})}
   proposed.elements['qa3-a'].semanticOwnerId='qa3-r';const add=(id:string,kind:string,source:string,target:string,importAlias?:string)=>view.edges.push(canonicalUmlEdge('uml-class',{id,source:'n'+source,target:'n'+target,relationKind:kind,...(importAlias?{importAlias}:{})}));add('qa3-y','elementImport','qa3-q','qa3-a','Y');add('qa3-trans','packageImport','qa3-p','qa3-q');add('qa3-conflict','elementImport','qa3-p','qa3-b','Y');
   for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const response=await send(method,base+route,{document:proposed,expectedVersion:3});assert.equal(response.statusCode,400,response.body);assert.match(response.body,/ambiguo/)}
   let unchanged=await send('GET',base+'/document');assert.equal(unchanged.json().version,3);assert.deepEqual(unchanged.json().document,changed);
   view.name=changed.diagrams[0].name;view.edges.find(e=>e.id==='qa3-y')!.relationKind='elementAccess';add('qa3-name','elementImport','qa3-p','qa3-r','NombreR');add('qa3-secret','packageAccess','qa3-p','qa3-r');const accepted=await send('POST',base+'/import',{document:proposed,expectedVersion:3});assert.equal(accepted.statusCode,200,accepted.body);assert.equal(accepted.json().version,4);
   const shared=structuredClone(proposed),primary=shared.diagrams[0],relation=primary.edges.find(e=>e.associationClassId)!;relation.description='Descripción común';const secondary=structuredClone(primary);secondary.id='qa3-second';secondary.nodes=secondary.nodes.map(n=>({...n,id:'copy-'+n.id}));secondary.edges=[{...relation,id:'qa3-shared',source:'copy-'+relation.source,target:'copy-'+relation.target,pathStyle:'step',...(relation.associationEnds?{associationEnds:relation.associationEnds.map(end=>({...end,nodeId:'copy-'+end.nodeId}))}:{})}];shared.diagrams.push(secondary);const both=await send('PUT',base+'/document',{document:shared,expectedVersion:4});assert.equal(both.statusCode,200,both.body);assert.equal(both.json().version,5);
   const unilateral=structuredClone(shared);unilateral.diagrams[0].edges.find(e=>e.id===relation.id)!.description='Descripción unilateral';const rejectedShared=await send('PUT',base+'/document',{document:unilateral,expectedVersion:5});assert.equal(rejectedShared.statusCode,400,rejectedShared.body);assert.match(rejectedShared.body,/identidad semántica/);unchanged=await send('GET',base+'/document');assert.equal(unchanged.json().version,5);assert.deepEqual(unchanged.json().document,JSON.parse(JSON.stringify(shared)));
   const synchronized=replaceClassRelationAcrossViews(shared,primary.id,{...relation,description:'Actualizada en ambas'});const savedShared=await send('PUT',base+'/document',{document:synchronized,expectedVersion:5});assert.equal(savedShared.statusCode,200,savedShared.body);assert.equal(savedShared.json().version,6);const latest=await send('GET',base+'/document');assert.equal(latest.json().document.diagrams[1].edges[0].description,'Actualizada en ambas');assert.equal(latest.json().document.diagrams[1].edges[0].id,'qa3-shared');assert.equal(latest.json().document.diagrams[1].edges[0].pathStyle,'step');const historical=await send('GET',base+'/versions/5');assert.equal(historical.json().document.diagrams[1].edges[0].description,'Descripción común');
  }
 }finally{try{if(workspaceId)await pool.query('DELETE FROM workspaces WHERE id=$1',[workspaceId]);if(userId)await pool.query('DELETE FROM atlas_users WHERE id=$1',[userId])}finally{await app.close()}}
})
