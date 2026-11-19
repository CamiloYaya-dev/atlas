import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync,readdirSync} from 'node:fs'
import {buildApp} from '../app'
import {pool} from '../db/pool'
import {hashPassword} from '../security/password'
import {emptyDoc,createElement,canonicalUmlEdge,replaceClassRelationAcrossViews} from '@novzi/contracts'
import {examples,scopedFixture} from '../../../../qa/uml-scoped-fixtures'
const expected='postgresql://novzi:novzi_test_only@127.0.0.1:5433/novzi_test'
if(process.env.NODE_ENV!=='test'||process.env.NOVZI_ALLOW_DB_TESTS!=='true'||process.env.DATABASE_URL!==expected)throw Error('Solo se permite la BD QA local 5433/novzi_test')
after(()=>pool.end())
for(const [type] of examples)test(`[${type}] API HTTP real: importación, invalidación, guardado, historial y exportación`,async()=>{
 let app=await buildApp();const email=`qa-uml-${randomUUID()}@example.test`,password='NovziQA!2026-local-only';let userId='',workspaceId=''
 const resetQaRateLimitWindow=async()=>{await app.close();app=await buildApp()}
 try{
  const result=await pool.query<{id:string}>(`INSERT INTO novzi_users(email,display_name,password_hash,platform_admin) VALUES($1,$2,$3,true) RETURNING id`,[email,'QA UML',await hashPassword(password)]);userId=result.rows[0].id
  const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password}});assert.equal(login.statusCode,200,login.body)
  const headers={cookie:String(login.headers['set-cookie']).split(';')[0],'x-csrf-token':login.json().csrfToken}
  const send=(method:'GET'|'POST'|'PUT',path:string,payload?:object)=>app.inject({method,url:'/api/v1'+path,headers,...(payload===undefined?{}:{payload})})
  const ws=await send('POST','/workspaces',{name:'QA UML '+type});assert.equal(ws.statusCode,201,ws.body);workspaceId=ws.json().id
  const p=await send('POST',`/workspaces/${workspaceId}/projects`,{name:'QA '+type,document:emptyDoc()});assert.equal(p.statusCode,201,p.body);const base=`/projects/${p.json().id}`
  const doc=scopedFixture(type),imported=await send('POST',base+'/import',{document:doc,expectedVersion:1});assert.equal(imported.statusCode,200,imported.body);assert.equal(imported.json().version,2)
  const read=await send('GET',base+'/document');assert.equal(read.statusCode,200,read.body);assert.equal(read.json().version,2);assert.deepEqual(read.json().document,doc)
  const invalid=structuredClone(doc);invalid.diagrams[0].edges[0].target='missing';const rejected=await send('PUT',base+'/document',{document:invalid,expectedVersion:2});assert.ok([400,403,409,422].includes(rejected.statusCode),rejected.body)
  const unchanged=await send('GET',base+'/document');assert.equal(unchanged.json().version,2);assert.deepEqual(unchanged.json().document,doc)
  if(type==='uml-sequence'||type==='uml-component'||type==='uml-deployment'){
   const dir=new URL(type==='uml-component'?'../../../../qa/uml-component-negative/':type==='uml-deployment'?'../../../../qa/uml-deployment-negative/':'../../../../qa/uml-sequence-negative/',import.meta.url)
   const names=readdirSync(dir).filter(n=>n.endsWith('.json')).sort()
   // Three requests per fixture; isolate batches without weakening actual limits.
   for(const [index,name] of names.entries()){
    if(index>0&&index%20===0)await resetQaRateLimitWindow()
    const bad=JSON.parse(readFileSync(new URL(name,dir),'utf8'))
    for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){
     const res=await send(method,base+route,{document:bad,expectedVersion:2})
     assert.equal(res.statusCode,400,`${name} ${method}: ${res.body}`)
     if(type==='uml-deployment'&&name==='11-destino-anotacion.json')assert.match(res.body,/Destino de anotación inválido/)
     if(type==='uml-deployment'&&/^(27|28|29|30)-aud-dep-007-/.test(name))assert.match(res.body,/Valores duplicados en propiedad única/)
    }
    const still=await send('GET',base+'/document')
    assert.equal(still.statusCode,200,`${name} GET: ${still.body}`)
    assert.equal(still.json().version,2,name)
    assert.deepEqual(still.json().document,doc,name)
   }
   // Leave the remaining persistence/history/export assertions a fresh window.
   await resetQaRateLimitWindow()
  }
  if(type==='uml-activity'){
   const mutations:[string,(v:typeof doc)=>void][]=[['segundo else',v=>{v.diagrams[0].edges.find(e=>e.id==='c4')!.activityEdge={guard:'else'}}],['pin incompatible',v=>{v.elements.outpin.activityDetail!.ownerActionId='missing'}],['peso inválido',v=>{v.diagrams[0].edges[0].activityEdge={weight:0}}],['interrupción fuera del ámbito',v=>{v.diagrams[0].edges.find(e=>e.id==='interrupt')!.activityEdge={interruptingRegionId:'lane'}}],['AUD-ACT-001 excepción incompatible',v=>{v.diagrams[0].edges.find(e=>e.id==='exception')!.activityEdge!.exceptionTypeIds=['order-type']}],['AUD-ACT-002 parámetro repetido',v=>{v.elements['param-copy']={...structuredClone(v.elements['param-in']),id:'param-copy'};v.diagrams[0].nodes.push({id:'param-copy',elementId:'param-copy',x:0,y:400})}],['AUD-ACT-003 evento incorrecto',v=>{v.elements.wait.activityDetail={kind:'acceptEvent',referenceId:'order-type'}}],['AUD-ACT-004 pin separado',v=>{const n=v.diagrams[0].nodes.find(n=>n.id==='outpin')!;n.x=20;n.y=20}],['AUD-ACT-005 argumento incompatible',v=>{v.elements.inpin.activityDetail!.typeId='error-type'}],['AUD-ACT-006A firma no compatible con transformación',v=>{v.diagrams.find(d=>d.id==='qa-decision-behavior')!.activity!.parameters![0].typeId='order-type'}]];
   for(const [name,mutate] of mutations){const bad=structuredClone(doc);mutate(bad);for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const res=await send(method,base+route,{document:bad,expectedVersion:2});assert.equal(res.statusCode,400,name+': '+res.body)}const still=await send('GET',base+'/document');assert.equal(still.json().version,2);assert.deepEqual(still.json().document,doc)}
  }
  if(type==='uml-class'){
   const invalidCases:[string,(value:typeof doc)=>void][]=[
    ['AUD-CL-001 paquete como atributo',v=>{v.elements.a.uml={...v.elements.a.uml,attributes:[{id:'audit-attr',name:'invalid',type:'Paquete',typeId:'p',visibility:'private'}]}}],
    ['AUD-CL-002 navegabilidad en dependencia',v=>{v.diagrams[0].edges.find(e=>e.relationKind==='dependency')!.sourceNavigability='navigable'}],
    ['AUD-CL-003 slots en clase',v=>{v.elements.a.uml={...v.elements.a.uml,slots:[{id:'audit-slot',name:'saldo',type:'Integer',value:'3'}]}}],
    ['AUD-CL-005 paquete como argumento',v=>{v.diagrams[0].edges.find(e=>e.relationKind==='bind')!.templateBindings=[{parameterId:'T',elementId:'p'}]}],
   ];
   for(const [name,mutate] of invalidCases){const candidate=structuredClone(doc);mutate(candidate);for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const response=await send(method,base+route,{document:candidate,expectedVersion:2});assert.ok([400,403,409,422].includes(response.statusCode),`${name} ${method}: ${response.body}`)}const after=await send('GET',base+'/document');assert.equal(after.json().version,2,name);assert.deepEqual(after.json().document,doc,name)}
  }
  if(type==='uml-usecase'){
   for(const [name,mutate] of [['extend sin puntos',(v:typeof doc)=>{v.diagrams[0].edges.find(e=>e.relationKind==='extend')!.extensionPointIds=[]}],['include con condición',(v:typeof doc)=>{v.diagrams[0].edges.find(e=>e.relationKind==='include')!.extensionCondition='inválida'}],['multiplicidad mal formada',(v:typeof doc)=>{v.diagrams[0].edges.find(e=>e.relationKind==='association')!.sourceMultiplicity='3..1'}]] as const){const bad=structuredClone(doc);mutate(bad);for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const res=await send(method,base+route,{document:bad,expectedVersion:2});assert.equal(res.statusCode,400,name+': '+res.body)}const still=await send('GET',base+'/document');assert.equal(still.json().version,2);assert.deepEqual(still.json().document,doc)}
  }
  const changed=structuredClone(doc);changed.diagrams[0].name='QA actualizado';
  if(type==='uml-deployment'){const annotation=changed.diagrams[0].edges.find(e=>e.id==='a')!;annotation.target='host';assert.equal(annotation.annotationTargetEdgeId,'p1')}
  const saved=await send('PUT',base+'/document',{document:changed,expectedVersion:2});assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().version,3)
  const history=await send('GET',base+'/versions/2');assert.equal(history.statusCode,200,history.body);assert.deepEqual(history.json().document,doc)
  const exported=await send('GET',base+'/export');assert.equal(exported.statusCode,200,exported.body);assert.deepEqual(exported.json().document,changed)
  if(type==='uml-usecase'){
   const missing=structuredClone(changed);delete missing.diagrams[0].edges.find(e=>e.relationKind==='include')!.semanticRelationId;
   for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const response=await send(method,base+route,{document:missing,expectedVersion:3});assert.equal(response.statusCode,400,response.body)}
   const dormant=structuredClone(changed),edge=dormant.diagrams[0].edges.find(e=>e.relationKind==='extend')!;dormant.diagrams[0].edges=dormant.diagrams[0].edges.filter(e=>e.id!==edge.id&&e.annotationTargetEdgeId!==edge.id);
   const hidden=await send('PUT',base+'/document',{document:dormant,expectedVersion:3});assert.equal(hidden.statusCode,200,hidden.body);assert.equal(hidden.json().version,4);assert.deepEqual((await send('GET',base+'/document')).json().document,dormant);
   const invalidPoint=structuredClone(dormant),target=invalidPoint.diagrams[0].nodes.find(n=>n.id===edge.target)!;invalidPoint.elements[target.elementId].useCaseDetail!.extensionPoints=[];const denied=await send('PUT',base+'/document',{document:invalidPoint,expectedVersion:4});assert.equal(denied.statusCode,400,denied.body);
   const reappearance=structuredClone(dormant);reappearance.diagrams[0].edges.push({...edge,id:'qa-uc-occ',pathStyle:'bezier'});const reuse=await send('PUT',base+'/document',{document:reappearance,expectedVersion:4});assert.equal(reuse.statusCode,200,reuse.body);assert.equal(reuse.json().version,5);assert.deepEqual((await send('GET',base+'/document')).json().document,reappearance);assert.deepEqual((await send('GET',base+'/versions/4')).json().document,dormant);
   const restored=await send('POST',base+'/restore',{sourceVersion:4,expectedVersion:5});assert.equal(restored.statusCode,200,restored.body);assert.equal(restored.json().version,6);assert.deepEqual((await send('GET',base+'/document')).json().document,dormant);
   // AUD-UC-005: real persisted catalog survives removal without any relation, then reuse and explicit deletion.
   let current=structuredClone(dormant),version=6;
   const commit=async(candidate:typeof doc)=>{const res=await send('PUT',base+'/document',{document:candidate,expectedVersion:version});assert.equal(res.statusCode,200,res.body);assert.equal(res.json().version,++version);const fresh=await send('GET',base+'/document');assert.equal(fresh.statusCode,200,fresh.body);assert.equal(fresh.json().version,version);return fresh.json().document as typeof doc};
   for(const kind of ['actor','usecase','uml-subject'] as const){const id='audit2-'+kind;current.elements[id]={...createElement('Aislado '+kind,kind),id};current.diagrams[0].nodes.push({id:'first-'+id,elementId:id,x:1800,y:100});current=await commit(current);current.diagrams[0].nodes=current.diagrams[0].nodes.filter(n=>n.elementId!==id);current=await commit(current);assert.equal(current.elements[id].useCaseCatalog,true);const detachedVersion=version;current.diagrams[0].nodes.push({id:'second-'+id,elementId:id,x:1800,y:250});current=await commit(current);assert.equal(current.diagrams[0].nodes.find(n=>n.id==='second-'+id)?.elementId,id);assert.equal((await send('GET',base+'/versions/'+detachedVersion)).json().document.elements[id].useCaseCatalog,true);current.diagrams[0].nodes=current.diagrams[0].nodes.filter(n=>n.elementId!==id);current=await commit(current);delete current.elements[id];current=await commit(current);assert.equal(current.elements[id],undefined)}
   // Restore the positive fixture with the canonical edge annotation, test new invalid targets on HTTP PUT/import.
   const annoRestore=await send('POST',base+'/restore',{sourceVersion:3,expectedVersion:version});assert.equal(annoRestore.statusCode,200,annoRestore.body);version++;current=(await send('GET',base+'/document')).json().document;
   const badAnno=structuredClone(current),annotation=badAnno.diagrams[0].edges.find(e=>e.annotationTargetEdgeId)!;annotation.target='n-validate';
   for(const [method,route] of [['PUT','/document'],['POST','/import']] as const){const res=await send(method,base+route,{document:badAnno,expectedVersion:version});assert.equal(res.statusCode,400,res.body);assert.match(res.body,/Destino auxiliar/)}
   const still=(await send('GET',base+'/document')).json();assert.equal(still.version,version);assert.deepEqual(still.document,current);
  }
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
  // IMP: same endpoint, explicit project replacement and single-diagram transactional CAS.
  if(['uml-usecase','uml-activity','uml-class','uml-sequence'].includes(type)){
   const latest=(await send('GET',base+'/document')).json(),version=latest.version,initial=latest.document as typeof doc;
   const from=type==='uml-activity'?doc.diagrams[1]:doc.diagrams[0],target=initial.diagrams.find(d=>d.id===from.id)!;
   const scope={mode:'diagram',targetDiagramId:target.id,sourceDiagramId:from.id};
   const wrong=structuredClone(doc);wrong.diagrams.find(d=>d.id===from.id)!.type=type==='uml-class'?'uml-usecase':'uml-class';
   const mismatch=await send('POST',base+'/import',{document:wrong,expectedVersion:version,scope});assert.ok([400,403].includes(mismatch.statusCode),mismatch.body);
   const stale=await send('POST',base+'/import',{document:doc,expectedVersion:version-1,scope});assert.equal(stale.statusCode,409,stale.body);
   assert.deepEqual((await send('GET',base+'/document')).json().document,initial);
   const scoped=await send('POST',base+'/import',{document:doc,expectedVersion:version,scope});assert.equal(scoped.statusCode,200,scoped.body);
   const after=(await send('GET',base+'/document')).json();assert.equal(after.version,version+1);assert.equal(after.document.diagrams.find((d:typeof target)=>d.id===target.id).nodes.length,from.nodes.length);assert.deepEqual(after.document.diagrams.filter((d:typeof target)=>d.id!==target.id),initial.diagrams.filter(d=>d.id!==target.id));
   assert.deepEqual((await send('GET',base+'/versions/'+version)).json().document,initial);
   const complete=await send('POST',base+'/import',{document:doc,expectedVersion:version+1,scope:{mode:'project'}});assert.equal(complete.statusCode,200,complete.body);assert.deepEqual((await send('GET',base+'/document')).json().document,doc);
  }
 }finally{try{
  if(workspaceId)await pool.query('DELETE FROM workspaces WHERE id=$1',[workspaceId])
  if(userId){
   await pool.query('DELETE FROM organizations WHERE created_by=$1',[userId])
   await pool.query('DELETE FROM novzi_users WHERE id=$1',[userId])
  }
 }finally{await app.close()}}
})
