import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PERMISSIONS} from '@novzi/contracts'
import {demoDocument} from '@novzi/fixtures'
import {allowed,type Access} from './roles'
import {projectVisible} from '../modules/projects/application/document-policy'

test('alcance limitado: permite lectura pero nunca edición, exportación ni gestión funcional',()=>{
 const a:Access={roleId:'r-viewer',roleKey:'viewer',roleName:'Lector',permissions:new Set(PERMISSIONS),diagramIds:new Set(['c1'])}
 for(const permission of ['project.read','diagram.view.c1','element.view.system'])assert.equal(allowed(a,permission),true,permission)
 for(const permission of ['diagram.create.c1','diagram.edit.c1','diagram.layout.c1','element.edit.system','relation.create.functional','artifact.export','functional.read','project.delete','project.members.manage'])assert.equal(allowed(a,permission),false,permission)
})

test('lectura limitada: oculta diagramas y fichas exclusivas de vistas ajenas sin mutar el origen',()=>{
 const document=demoDocument(),target=document.diagrams[0],secret=document.diagrams[1]
 const a:Access={roleId:'r-viewer',roleKey:'viewer',roleName:'Lector',permissions:new Set(PERMISSIONS),diagramIds:new Set([target.id])}
 const initial=JSON.stringify(document)
 const visible=projectVisible(document,a)
 assert.equal(visible.diagrams.length,1)
 assert.equal(visible.diagrams[0].id,target.id)
 assert.equal(visible.diagrams.some(d=>d.id===secret.id),false)
 const visibleIds=new Set(target.nodes.map(n=>n.elementId))
 for(const key of Object.keys(visible.elements))assert.ok(visibleIds.has(key),`Ficha no autorizada: ${key}`)
 assert.equal(JSON.stringify(document),initial,'La proyección no debe alterar el documento histórico')
})
