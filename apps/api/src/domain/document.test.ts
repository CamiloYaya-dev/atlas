import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {emptyDoc,isProjectDocument} from '@atlas/contracts'
import {demoDocument} from '@atlas/fixtures'
import {cleanName,DomainError} from './errors'
test('documento ATLAS demo valido',()=>assert.ok(isProjectDocument(demoDocument())))
test('documento vacío valido',()=>assert.ok(isProjectDocument(emptyDoc())))
test('documentos malformados rechazados',()=>assert.equal(isProjectDocument({schema:1,elements:{},diagrams:'nulo',fieldDefinitions:[]}),false))
test('nombre inválido',()=>assert.throws(()=>cleanName(''),DomainError))
