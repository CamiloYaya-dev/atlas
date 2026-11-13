import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {sha256,signature,signaturesMatch,embedProvenance,readProvenance} from './provenance'
import {renderDiagramSVG} from './render-svg'
import type {Provenance} from './provenance'
import type {ProjectDocument} from '@atlas/contracts'
const key='local-test-export-signing-key-xxxxxxxxxx-123'
const base:ProjectDocument={schema:1,fieldDefinitions:[],elements:{
 a:{id:'a',type:'actor',name:'Operador de solicitudes',summary:'Registra y consulta',description:'',owner:'',author:'',status:'Borrador',createdAt:'2026-01-01',updatedAt:'2026-01-01',links:[],fields:{}},
 b:{id:'b',type:'service',name:'API de solicitudes',summary:'Recibe solicitudes',description:'',owner:'',author:'',status:'Borrador',createdAt:'2026-01-01',updatedAt:'2026-01-01',links:[],fields:{}}
},diagrams:[{id:'d1',name:'Solicitud y backend',description:'',type:'c2',createdAt:'2026-01-01',nodes:[{id:'n1',elementId:'a',x:30,y:40},{id:'n2',elementId:'b',x:430,y:180}],edges:[{id:'e1',source:'n1',target:'n2',label:'HTTPS',sourceHandle:'bottom-2',targetHandle:'left',lineStyle:'dashed',direction:'both'}]}]}
const proof=(img:Buffer,format:'png'|'jpg'):Provenance=>({version:1,exportId:'01234567-89ab-4cde-8000-000000000001',workspaceId:'w',projectId:'p',diagramId:'d1',actorId:'u',documentVersion:9,format,planCode:'free',licenseActive:false,watermarkApplied:true,exportedAt:'2026-11-12T00:00:00Z',imageSha256:sha256(img)})
test('renderiza un diagrama completo con etiquetas y marca comercial en plan gratuito',async()=>{
 const {svg,width,height}=renderDiagramSVG(base,base.diagrams[0],true)
 assert.match(svg,/ATLAS · USO NO COMERCIAL/);assert.match(svg,/API de solicitudes/);assert.match(svg,/HTTPS/)
 assert.ok(width>500&&height>300)
 const image=await sharp(Buffer.from(svg)).png().toBuffer()
 const meta=await sharp(image).metadata();assert.equal(meta.format,'png')
 const clean=renderDiagramSVG(base,base.diagrams[0],false).svg;assert.ok(!clean.includes('USO NO COMERCIAL'))
})
for(const format of ['png','jpg'] as const){
 test(`firma oculta de ${format}, integridad binaria y prueba de alteración`,async()=>{
  const raw= format==='png'?await sharp({create:{width:64,height:64,channels:4,background:'#eef4ff'}}).png().toBuffer():await sharp({create:{width:64,height:64,channels:3,background:'#eef4ff'}}).jpeg().toBuffer()
  const p=proof(raw,format),signed=embedProvenance(raw,format,p,key)
  const decoded=readProvenance(signed);assert.ok(decoded)
  assert.equal(decoded.format,format);assert.deepEqual(decoded.unsignedImage,raw)
  assert.equal(sha256(decoded.unsignedImage),p.imageSha256)
  assert.ok(signaturesMatch(decoded.sig,signature(p,key)))
  const metadata=await sharp(signed).metadata();assert.equal(metadata.format,format==='jpg'?'jpeg':'png')
  const tampered=Buffer.from(signed);tampered[tampered.length-6]^=1
  const edited=readProvenance(tampered);assert.ok(edited)
  assert.notEqual(sha256(edited.unsignedImage),p.imageSha256)
 })
}
test('rechaza firmas falsas',()=>{
 const raw=Buffer.from('abc');const p=proof(raw,'png');assert.ok(!signaturesMatch('0'.repeat(64),signature(p,key)))
})
