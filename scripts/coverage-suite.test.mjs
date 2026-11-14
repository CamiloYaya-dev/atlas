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
