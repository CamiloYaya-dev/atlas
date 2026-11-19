import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {parseTap} from './qa-test-summary.mjs'
test('cuenta resultados TAP e identifica ubicación y error',()=>{
 const text=`TAP version 13\nok 1 - primer caso\nnot ok 2 - caso defectuoso\n  ---\n  location: '/home/tests/example.test.ts:19:1'\n  error: '500 !== 403'\n  ...\n1..2\n# tests 2\n# pass 1\n# fail 1\n# skipped 0`
 const actual=parseTap(text,1)
 assert.equal(actual.tests,2);assert.equal(actual.pass,1);assert.equal(actual.fail,1)
 assert.deepEqual(actual.failures,[{name:'caso defectuoso',location:'/home/tests/example.test.ts:19:1',message:'500 !== 403'}])
})
test('reconoce un archivo fallido sin salida TAP',()=>{
 const actual=parseTap('Error: DATABASE_URL requerido\n',1)
 assert.equal(actual.fail,1);assert.match(actual.failures[0].message,/DATABASE_URL/)
})
test('un archivo aprobado permanece en cero fallos',()=>{
 const actual=parseTap('TAP version 13\nok 1 - todo bien\n1..1\n# tests 1\n# pass 1\n# fail 0',0)
 assert.equal(actual.tests,1);assert.equal(actual.pass,1);assert.equal(actual.fail,0);assert.equal(actual.failures.length,0)
})
test('muestra la causa de un error de inicio anterior al TAP',()=>{
 const text=`TAP version 13\n# Error [TransformError]: plataforma incompatible\n# Subtest: example.test.ts\nnot ok 1 - example.test.ts\n  ---\n  error: 'test failed'\n  ...\n1..1\n# tests 1\n# pass 0\n# fail 1`
 const result=parseTap(text,1)
 assert.equal(result.fail,1)
 assert.match(result.failures[0].message,/TransformError/)
})

test('muestra el valor real de una aserción multilínea en TAP anidado y evita duplicar el contenedor',()=>{
 const tap=`TAP version 13
# Subtest: suite grande
    # Subtest: prueba de permisos
    not ok 1 - prueba de permisos
      ---
      location: 'apps/api/src/tests/api.integration.test.ts:621:11'
      failureType: 'testCodeFailure'
      error: |-
        Expected values to be strictly equal:

        403 !== 400
      code: 'ERR_ASSERTION'
      ...
    1..1
not ok 1 - suite grande
  ---
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  ...
1..1
# tests 2
# pass 0
# fail 2`
 const actual=parseTap(tap,1)
 assert.equal(actual.fail,2,'Conservar recuentos exactos de Node TAP')
 assert.equal(actual.failures.length,1,'La envoltura de suite no se presenta como un segundo defecto')
 assert.equal(actual.failures[0].name,'prueba de permisos')
 assert.match(actual.failures[0].message,/403 !== 400/)
 assert.match(actual.failures[0].location,/api.integration.test.ts:621/)
})
test('sin subpruebas, no suprime el error del contenedor',()=>{
 const tap=`TAP version 13\nnot ok 1 - suite rota\n  ---\n  error: '1 subtest failed'\n  ...\n1..1\n# tests 1\n# pass 0\n# fail 1`
 const result=parseTap(tap,1)
 assert.equal(result.failures.length,1)
})
