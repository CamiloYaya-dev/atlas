import test from 'node:test'
import assert from 'node:assert/strict'
import {runIntegral,phases} from './qa-integral.mjs'
const log={table(){},error(){}}
test('QA integral exige todas las fases y no compensa fallos E2E con cobertura',()=>{
 const seen=[];assert.equal(runIntegral(cmd=>{seen.push(cmd);return {status:cmd==='test:e2e:local'?1:0}},log),1)
 assert.deepEqual(seen,phases.map(p=>p[1]))
 assert.equal(runIntegral(()=>({status:0}),log),0)
})
test('cobertura incompleta bloquea gate pero conserva diagnóstico E2E',()=>{
 const seen=[];assert.equal(runIntegral(cmd=>{seen.push(cmd);return {status:cmd==='test:coverage'?1:0}},log),1)
 assert.ok(!seen.includes('coverage:check'));assert.ok(seen.includes('test:e2e:local'))
})
