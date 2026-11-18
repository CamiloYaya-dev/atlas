import {test} from 'node:test'
import assert from 'node:assert/strict'
import {runCoveragePhases} from './coverage-suite.mjs'
const quiet={log(){},error(){}}
function fixture(results){const calls=[];return {calls,run(args){calls.push(args);const next=results.shift();if(next instanceof Error)throw next;return next}}}
test('coverage completo mide unit, integración y scripts DB/servidor en orden',()=>{
 const f=fixture([{status:0},{status:0},{status:0}]);assert.equal(runCoveragePhases('full',f.run,quiet),0)
 assert.deepEqual(f.calls,[['scripts/run-tests.mjs','unit'],['scripts/run-tests.mjs','integration'],['scripts/coverage-operational.mjs']])
})
test('una integración fallida no impide diagnosticar src/db pero impide certificar',()=>{
 const f=fixture([{status:0},{status:1},{status:0}]);assert.equal(runCoveragePhases('full',f.run,quiet),1);assert.equal(f.calls.length,3)
})
test('error al lanzar el proceso o señal de salida no se transforma en éxito',()=>{
 const f=fixture([new Error('spawn'),{status:null,signal:'SIGTERM'},{status:0}]);assert.equal(runCoveragePhases('full',f.run,quiet),1);assert.equal(f.calls.length,3)
})
test('unit nunca ejecuta scripts de PostgreSQL',()=>{
 const f=fixture([{status:0}]);assert.equal(runCoveragePhases('unit',f.run,quiet),0);assert.equal(f.calls.length,1);assert.throws(()=>runCoveragePhases('bad',f.run,quiet),/Uso/)
})

import {auditCoverageTransforms} from './coverage-transform-audit.mjs'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
function mapFixture(run){
 const dir=mkdtempSync(join(tmpdir(),'atlas-source-map-'))
 try{
  const src=join(dir,'packages','contracts','src','logic.ts'),raw=join(dir,'raw'),source='export const f = (n: number) => n + 1\n'
  mkdirSync(join(src,'..'),{recursive:true});mkdirSync(raw);writeFileSync(src,source)
  const url=pathToFileURL(src).href
  const report=(mappings='AAAA',content=source,lengths=[24])=>({result:[{url,functions:[]}],'source-map-cache':{[url]:{lineLengths:lengths,data:{mappings,sourcesContent:[content]}}}})
  const write=(n,data)=>writeFileSync(join(raw,`coverage-${n}.json`),JSON.stringify(data))
  run({dir,raw,report,write,url})
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('mapas fuente idénticos de varios procesos conservan una sola identidad',()=>mapFixture(({dir,raw,report,write})=>{write(1,report());write(2,report());assert.deepEqual(auditCoverageTransforms(raw,dir),{reports:2,scripts:2,files:1})}))
test('la consolidación no acepta transformaciones diferentes aunque la URL sea la misma',()=>mapFixture(({dir,raw,report,write})=>{write(1,report());write(2,report('AACA'));assert.throws(()=>auditCoverageTransforms(raw,dir),/Transformaciones incompatibles/);write(2,report('AAAA',undefined,[25]));assert.throws(()=>auditCoverageTransforms(raw,dir),/Transformaciones incompatibles/)}))
test('mapa ausente, fuente anterior y directorio vacío bloquean la certificación',()=>mapFixture(({dir,raw,report,write,url})=>{assert.throws(()=>auditCoverageTransforms(raw,dir),/no se encontraron/);write(1,{result:[{url}]});assert.throws(()=>auditCoverageTransforms(raw,dir),/Mapa fuente ausente/);write(1,report('AAAA','fuente antigua'));assert.throws(()=>auditCoverageTransforms(raw,dir),/Mapa fuente ausente/)}))
