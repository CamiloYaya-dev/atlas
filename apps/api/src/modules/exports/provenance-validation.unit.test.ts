import test from 'node:test'
import assert from 'node:assert/strict'
import {embedProvenance,readProvenance,sha256,signature,signaturesMatch} from './provenance'
import type {Provenance} from './provenance'
// A real 1x1 PNG; these validation cases do not depend on native rasterization.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNlsAAAAASUVORK5CYII=','base64')
const key='qa-test-only-signature-key-long-enough'
const proof:Provenance={version:1,exportId:'e',workspaceId:'w',projectId:'p',diagramId:'d',actorId:'u',documentVersion:1,format:'png',planCode:'free',licenseActive:false,watermarkApplied:true,exportedAt:'2026-01-01T00:00:00Z',imageSha256:sha256(png)}
test('detecta PNG sin firma, truncado, doble firma y cabecera inválida',()=>{
 assert.equal(readProvenance(png),null)
 assert.throws(()=>embedProvenance(Buffer.from('not png'),'png',proof,key),/PNG inválida/)
 assert.throws(()=>readProvenance(png.subarray(0,46)),/PNG dañado/)
 const signed=embedProvenance(png,'png',proof,key)
 assert.throws(()=>readProvenance(embedProvenance(signed,'png',proof,key)),/Múltiples firmas/)
 assert.equal(readProvenance(signed)?.sig,signature(proof,key))
})
test('rechaza JPG inválido, longitud corrupta, token extraño y firmas de longitud diferente',()=>{
 assert.throws(()=>embedProvenance(png,'jpg',proof,key),/JPG inválida/)
 assert.equal(readProvenance(Buffer.from('ffd8ffe00002ffd9','hex')),null)
 assert.throws(()=>readProvenance(Buffer.from('ffd8fffeffff00','hex')),/JPG dañado/)
 assert.throws(()=>readProvenance(Buffer.from('abcd')),/Solo PNG o JPG/)
 const comment=(token:string)=>{const bytes=Buffer.from(token),len=Buffer.alloc(2);len.writeUInt16BE(bytes.length+2);return Buffer.concat([Buffer.from('ffd8fffe','hex'),len,bytes,Buffer.from('ffd9','hex')])}
 assert.equal(readProvenance(comment('another application')),null)
 assert.equal(readProvenance(comment('ATLAS-PROVENANCE-v1:'+Buffer.from('not JSON').toString('base64url'))),null)
 assert.equal(readProvenance(comment('ATLAS-PROVENANCE-v1:'+Buffer.from(JSON.stringify({proof,signature:'wrong-format'})).toString('base64url'))),null)
 assert.equal(signaturesMatch('ab','cd'),false);assert.equal(signaturesMatch('ab',signature(proof,key)),false)
 assert.throws(()=>embedProvenance(Buffer.from('ffd8ffd9','hex'),'jpg',{...proof,actorId:'u'.repeat(66000)},key),/demasiado larga/)
})
