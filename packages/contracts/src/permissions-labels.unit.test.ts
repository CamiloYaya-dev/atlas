import {test} from 'node:test'
import assert from 'node:assert/strict'
import {permissionLabel,PERMISSIONS} from './permissions'
test('el catálogo de permisos tiene etiquetas legibles y no duplica claves',()=>{
 assert.equal(new Set(PERMISSIONS).size,PERMISSIONS.length)
 for(const key of PERMISSIONS)assert.ok(permissionLabel(key).trim(),key)
 assert.equal(permissionLabel('workspace.rename'),'Renombrar espacio')
 assert.equal(permissionLabel('project.members.manage'),'Administrar usuarios del proyecto')
 assert.equal(permissionLabel('diagram.view.uml-class'),'Ver vista UML-CLASS')
 assert.equal(permissionLabel('element.edit.actor'),'Editar actor')
 assert.equal(permissionLabel('relation.delete.functional'),'Eliminar relaciones functional')
})
test('las claves futuras conservan una etiqueta de fallback sin romper el inspector',()=>{
 for(const key of ['workspace.future','project.future','artifact.future'])assert.equal(permissionLabel(key),key.replace(/\./g,' · '))
 assert.equal(permissionLabel('diagram.future.c1'),'future vista C1')
 assert.equal(permissionLabel('element.future.actor'),'future actor')
 assert.equal(permissionLabel('relation.future.mixed'),'future relaciones mixed')
})
