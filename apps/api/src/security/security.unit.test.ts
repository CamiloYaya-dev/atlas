import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {hashPassword,verifyPassword,hashSecret} from './password'
import {PERMISSIONS,ROLE_PRESETS,DIAGRAM_KINDS,ELEMENT_KINDS,relationScope,permissionLabel} from '@atlas/contracts'
import {allowed,requirePermission,requireValidPermissions} from './roles'
import type {Access} from './roles'
const access=(roleKey:string,permissions:string[]=[]):Access=>({roleId:'x',roleKey,roleName:'test',permissions:new Set(permissions)})
test('contraseñas: hash con salt individual, verificación, credencial equivocada',async()=>{
 const password='ClaveDePrueba!2026',h1=await hashPassword(password),h2=await hashPassword(password)
 assert.notEqual(h1,h2)
 assert.equal(await verifyPassword(password,h1),true)
 assert.equal(await verifyPassword('OtraClave!2026',h1),false)
})
test('contraseñas: rechaza menores a 12 y mayores a 128 caracteres',async()=>{
 await assert.rejects(()=>hashPassword('corta'),/12 y 128/)
 await assert.rejects(()=>hashPassword('x'.repeat(129)),/12 y 128/)
})
test('contraseñas: hashes inválidos no autentican',async()=>{
 for(const value of ['', 'texto', 'scrypt$2$8$3$abc$def', 'scrypt$32768$8$3$bad$bad'])assert.equal(await verifyPassword('ClaveDePrueba!2026',value),false)
})
test('hash de sesión estable y sensible a cambios',()=>{
 assert.equal(hashSecret('a'),hashSecret('a'))
 assert.notEqual(hashSecret('a'),hashSecret('b'))
 assert.equal(hashSecret('a').length,64)
})
test('roles: propietario total, lector limitado y permisos individuales',()=>{
 assert.ok(allowed(access('owner'), 'workspace.roles.manage'))
 assert.equal(allowed(access('viewer'), 'element.edit.endpoint'),false)
 assert.equal(allowed(access('custom',['diagram.view.c1']), 'diagram.view.c1'),true)
 assert.equal(allowed(access('custom',['diagram.view.c1']), 'diagram.view.c3'),false)
 assert.throws(()=>requirePermission(access('viewer'),'artifact.export'),/artifact.export/)
})
test('catálogo cubre todas las vistas, los tipos de elemento y las relaciones',()=>{
 for(const x of DIAGRAM_KINDS)for(const op of ['view','create','edit','delete','layout'])assert.ok(PERMISSIONS.includes(`diagram.${op}.${x}` as never))
 for(const x of ELEMENT_KINDS)for(const op of ['view','create','edit','delete'])assert.ok(PERMISSIONS.includes(`element.${op}.${x}` as never))
 for(const kind of ['functional','technical','mixed'])for(const op of ['create','edit','delete'])assert.ok(PERMISSIONS.includes(`relation.${op}.${kind}` as never))
})
test('ACL: validación de permisos rechaza desconocidos, duplicados y formatos inválidos',()=>{
 assert.deepEqual(requireValidPermissions(['diagram.view.c1','diagram.view.c1']),['diagram.view.c1'])
 for(const input of ['a',{},['invalid_permission'],[42],Array(PERMISSIONS.length+1).fill('project.read')])assert.throws(()=>requireValidPermissions(input),/Catálogo/)
})
test('clasificación funcional, técnica y mixta de relaciones',()=>{
 assert.equal(relationScope('activity','requirement'),'functional')
 assert.equal(relationScope('endpoint','database'),'technical')
 assert.equal(relationScope('activity','endpoint'),'mixed')
 assert.equal(permissionLabel('diagram.edit.c2'),'Editar vista C2')
})
test('presets: cada permiso pertenece al catálogo, sin entradas duplicadas',()=>{
 const keys=new Set<string>()
 for(const role of ROLE_PRESETS){assert.equal(keys.has(role.key),false);keys.add(role.key)
  assert.equal(role.permissions.length,new Set(role.permissions).size,`Permisos duplicados en ${role.key}`)
  for(const permission of role.permissions)assert.ok(PERMISSIONS.includes(permission as never),`Permiso inválido: ${permission}`)
 }
})
