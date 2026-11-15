import {test} from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {pool} from '../../db/pool'
import {ProjectsService} from '../projects/application/projects.service'
import {registerExportsController} from './exports.controller'
import {emptyDoc} from '@atlas/contracts'
const project='44444444-4444-4444-8444-444444444444',workspace='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222'
const headers={cookie:'atlas_session='+'A'.repeat(48)}
test('exportación HTTP: valida modelo, versión, licencia y requisitos de captura antes de firmar',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerExportsController(app)
 const doc=emptyDoc();doc.diagrams.push({id:'d',type:'c1',name:'QA',description:'',createdAt:'2026-01-01',nodes:[],edges:[]})
 let saved=true,scope=true,licensed=false
 const load=t.mock.method(ProjectsService.prototype,'loadDocument',async()=>saved?{document:doc,version:1}:null)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:'r',role_key:'editor',name:'Editor'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'artifact.export'}]}
  if(sql.includes('SELECT workspace_id FROM projects'))return {rows:scope?[{workspace_id:workspace}]:[]}
  if(sql.includes('FROM workspace_licenses'))return {rows:licensed?[{plan_code:'pro',status:'active',starts_at:new Date('2020-01-01'),ends_at:null,features:{}}]:[]}
  throw Error('SQL inesperado '+sql)
 })
 const connect=t.mock.method(pool,'connect',async()=>{throw Error('No debe iniciarse auditoría')})
 const send=(payload:object,diagram='d')=>app.inject({method:'POST',url:`/api/v1/projects/${project}/diagrams/${diagram}/export-image`,headers,payload})
 const valid={format:'png',expectedVersion:1}
 for(const [payload,diagram,status] of [[{...valid},'bad.id',400],[{format:'svg',expectedVersion:1},'d',400],[{...valid,expectedVersion:0},'d',400],[{...valid,expectedVersion:2},'d',409],[valid,'missing',404]] as const){const r=await send(payload,diagram);assert.equal(r.statusCode,status,r.body)}
 saved=false;assert.equal((await send(valid)).statusCode,404);saved=true;scope=false;assert.equal((await send(valid)).statusCode,404);scope=true
 assert.equal((await send({...valid,advanced:{mode:'embedded',fields:{}}})).statusCode,403)
 licensed=true;const invalid=await send({...valid,advanced:{mode:'bad',fields:{}}});assert.equal(invalid.statusCode,400,invalid.body)
 const noImage=await send(valid);assert.equal(noImage.statusCode,400);assert.match(noImage.body,/Captura visual requerida/)
 const verify=await app.inject({method:'POST',url:'/api/v1/exports/verify',headers,payload:{imageBase64:'!'}});assert.equal(verify.statusCode,400)
 const unsigned=await app.inject({method:'POST',url:'/api/v1/exports/verify',headers,payload:{imageBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII='}});assert.equal(unsigned.statusCode,200,unsigned.body);assert.deepEqual(unsigned.json(),{verified:false,reason:'sin_firma_atlas'})
 assert.ok(load.mock.callCount()>0);assert.equal(connect.mock.callCount(),0)
})

// The real rasterizer, provenance, HTTP controller and document builders run;
// only PostgreSQL and the authorized document-loading boundary are substituted.
import sharp from 'sharp'
import {env} from '../../config/env'
import {embedProvenance,readProvenance,sha256,signature} from './provenance'
import type {Provenance} from './provenance'

test('exportación HTTP: firma registrada, formatos de fichas y rollback sin entregar archivo',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerExportsController(app)
 const doc=emptyDoc();doc.diagrams.push({id:'d',type:'c1',name:'!!!',description:'',createdAt:'2026-01-01',nodes:[],edges:[]})
 t.mock.method(ProjectsService.prototype,'loadDocument',async()=>({document:doc,version:1}))
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:'r',role_key:'editor',name:'Editor'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'artifact.export'}]}
  if(sql.includes('SELECT workspace_id FROM projects'))return {rows:[{workspace_id:workspace}]}
  if(sql.includes('FROM workspace_licenses'))return {rows:[{plan_code:'pro',status:'active',starts_at:new Date('2020-01-01'),ends_at:null,features:{}}]}
  throw Error('SQL inesperado '+sql)
 })
 let rejectAudit=false;const queries:string[]=[],release=t.mock.fn(),auditArgs:unknown[][]=[]
 t.mock.method(pool,'connect',async()=>({query:async(sql:string,args?:unknown[])=>{queries.push(sql);if(sql.includes('INSERT INTO export_audit_logs'))auditArgs.push(args||[]);if(rejectAudit&&sql.includes('INSERT INTO audit_events'))throw Error('Auditoría QA no disponible');return {rows:[]}},release}))
 const imageBase64=(await sharp({create:{width:180,height:100,channels:3,background:'white'}}).png().toBuffer()).toString('base64')
 const url=`/api/v1/projects/${project}/diagrams/d/export-image`
 const send=(payload:object)=>app.inject({method:'POST',url,headers,payload})
 const base={format:'png',expectedVersion:1,imageBase64}
 assert.equal((await send([])).statusCode,400)
 assert.equal((await send({...base,advanced:{mode:'simple',fields:{}}})).statusCode,400)
 const plain=await send(base);assert.equal(plain.statusCode,200,plain.body);assert.equal(plain.headers['content-type'],'image/png');assert.match(String(plain.headers['content-disposition']),/ATLAS_diagrama\.png/)
 const proof=readProvenance(plain.rawPayload)!;assert.ok(proof);assert.equal(proof.proof.imageSha256,sha256(proof.unsignedImage));assert.equal(proof.sig,signature(proof.proof,env.exportSigningKey));assert.equal(auditArgs[0][0],proof.proof.exportId);assert.equal(auditArgs[0][10],proof.proof.imageSha256)
 const jpg=await send({...base,format:'jpg'});assert.equal(jpg.statusCode,200,jpg.body);assert.equal(jpg.headers['content-type'],'image/jpeg');assert.equal(readProvenance(jpg.rawPayload)?.proof.format,'jpg')
 for(const documentFormat of [undefined,'pdf','docx'] as const){const r=await send({...base,advanced:{mode:'dictionary',fields:{},...(documentFormat?{documentFormat}:{})}});assert.equal(r.statusCode,200,r.body);assert.equal(r.headers['content-type'],'application/zip');assert.equal(r.rawPayload.subarray(0,4).toString('hex'),'504b0304');assert.ok(r.rawPayload.includes(Buffer.from(`ATLAS_diagrama_Fichas.${documentFormat||'html'}`)))}
 assert.equal(release.mock.callCount(),5);assert.equal(queries.filter(q=>q==='COMMIT').length,5)
 rejectAudit=true;const failed=await send(base);assert.equal(failed.statusCode,500);assert.equal(failed.headers['x-atlas-export-id'],undefined);assert.equal(queries.at(-1),'ROLLBACK');assert.equal(release.mock.callCount(),6)
})

test('verificación HTTP: distingue firma inválida, emisión no registrada, acceso y píxeles alterados',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerExportsController(app)
 const png=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer()
 const proof:Provenance={version:1,exportId:'33333333-3333-4333-8333-333333333333',workspaceId:workspace,projectId:project,diagramId:'d',actorId:actor,documentVersion:1,format:'png',planCode:'pro',licenseActive:true,watermarkApplied:false,exportedAt:'2026-01-01T00:00:00Z',imageSha256:sha256(png)}
 const record={workspace_id:workspace,image_sha256:proof.imageSha256,signature:signature(proof,env.exportSigningKey),watermark_applied:false,license_active:true};let registered=true,member=true
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM export_audit_logs'))return {rows:registered?[record]:[]}
  if(sql.includes('FROM workspace_members'))return {rows:member?[{id:'r',role_key:'editor',name:'Editor'}]:[]}
  if(sql.includes('FROM role_permissions'))return {rows:[]}
  throw Error('SQL inesperado '+sql)
 })
 const verify=(image:Buffer)=>app.inject({method:'POST',url:'/api/v1/exports/verify',headers,payload:{imageBase64:image.toString('base64')}})
 const signed=embedProvenance(png,'png',proof,env.exportSigningKey)
 const badId=await verify(embedProvenance(png,'png',{...proof,exportId:'bad'},env.exportSigningKey));assert.equal(badId.json().reason,'firma_invalida')
 registered=false;assert.equal((await verify(signed)).json().reason,'exportacion_no_registrada');registered=true
 member=false;assert.equal((await verify(signed)).statusCode,403);member=true
 assert.deepEqual((await verify(signed)).json(),{verified:true,reason:'ok',exportId:proof.exportId,licensed:true,watermarkApplied:false})
 const altered=await sharp({create:{width:20,height:20,channels:3,background:'black'}}).png().toBuffer()
 const invalid=await verify(embedProvenance(altered,'png',proof,env.exportSigningKey));assert.deepEqual(invalid.json(),{verified:false,reason:'imagen_modificada_o_firma_invalida',exportId:proof.exportId})
})
