import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {COVERAGE_TARGET,coveragePercent,COVERAGE_METRICS} from './coverage-target.mjs'
const row=(total,covered,pct=total?100*covered/total:100)=>Object.fromEntries(COVERAGE_METRICS.map(m=>[m,{total,covered,pct}]))
test('90 exacto pasa, 89.999 no pasa por redondeo y 0/0 no contiene código ejecutable',()=>{
 assert.equal(COVERAGE_TARGET,90);assert.equal(coveragePercent({total:10,covered:9}),90)
 assert.ok(coveragePercent({total:100000,covered:89999})<90)
 assert.equal(coveragePercent({total:0,covered:0}),100)
 for(const bad of [null,{}, {total:0,covered:1},{total:2,covered:-1},{total:1.5,covered:1}])assert.equal(coveragePercent(bad),null)
})
test('ambos comandos bloquean archivos omitidos, métricas insuficientes y capas incompletas',()=>{
 const root=mkdtempSync(join(tmpdir(),'novzi-gate-'))
 try{
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'coverage'))
  for(const file of ['coverage-gate.mjs','coverage-target.mjs','coverage-milestone-90.mjs'])copyFileSync(new URL(file,import.meta.url),join(root,'scripts',file))
  const names=['apps/api/src/a.ts','apps/web/src/b.ts','packages/contracts/src/c.ts','packages/fixtures/src/d.ts']
  for(const name of names){mkdirSync(join(root,name,'..'),{recursive:true});writeFileSync(join(root,name),'export const x=1')}
  const run=(summary,script='coverage-gate.mjs')=>{writeFileSync(join(root,'coverage','coverage-summary.json'),JSON.stringify(summary));return spawnSync(process.execPath,[join(root,'scripts',script)],{encoding:'utf8'})}
  const all={total:row(40,36),...Object.fromEntries(names.map(n=>[n,row(10,9)]))}
  assert.equal(run(all).status,0);assert.equal(run(all,'coverage-milestone-90.mjs').status,0)
  const low={...all,[names[1]]:row(10,8,99)}
  assert.equal(run(low).status,1);assert.match(run(low).stderr,/branches 80.00%/)
  assert.equal(run(low,'coverage-milestone-90.mjs').status,1)
  const absent={...all};delete absent[names[2]];assert.match(run(absent).stderr,/SIN MEDIR/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
