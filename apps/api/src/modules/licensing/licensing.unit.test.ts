import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveEntitlements,featureAllowed} from './licensing-policy'
const now=new Date('2026-11-12T15:00:00.000Z')
test('sin registro de licencia: imagen habilitada, marca de agua obligatoria',()=>{
 const rights=resolveEntitlements('w',null,now)
 assert.equal(rights.licenseActive,false)
 assert.equal(featureAllowed(rights,'diagram.export.png'),true)
 assert.equal(featureAllowed(rights,'diagram.export.jpg'),true)
 assert.equal(featureAllowed(rights,'diagram.export.clean'),false)
 assert.equal(featureAllowed(rights,'diagram.export.advanced'),false)
})
test('licencia PRO activa y dentro de vigencia: elimina solo marca visible',()=>{
 const rights=resolveEntitlements('w',{plan_code:'pro',status:'active',starts_at:new Date('2026-01-01'),ends_at:new Date('2027-01-01'),features:{}},now)
 assert.equal(rights.licenseActive,true)
 assert.equal(rights.planCode,'pro')
 assert.equal(featureAllowed(rights,'diagram.export.clean'),true)
 assert.equal(featureAllowed(rights,'diagram.export.advanced'),true)
})
test('licencia revocada, futura o caducada no habilita exportación limpia',()=>{
 const base={plan_code:'pro' as const,status:'active' as const,starts_at:new Date('2026-01-01'),ends_at:new Date('2026-11-01'),features:{'diagram.export.clean':true}}
 assert.equal(resolveEntitlements('w',base,now).features['diagram.export.clean'],false)
 assert.equal(resolveEntitlements('w',{...base,status:'revoked',ends_at:null},now).features['diagram.export.clean'],false)
 assert.equal(resolveEntitlements('w',{...base,starts_at:new Date('2026-12-01'),ends_at:null},now).features['diagram.export.clean'],false)
})
test('el catálogo admite restringir funcionalidades nuevas por concesión administrativa',()=>{
 const rights=resolveEntitlements('w',{plan_code:'enterprise',status:'active',starts_at:new Date('2026-01-01'),ends_at:null,features:{'diagram.export.jpg':false}},now)
 assert.equal(rights.features['diagram.export.jpg'],false)
 assert.equal(rights.features['diagram.export.png'],true)
 assert.equal(rights.features['diagram.export.clean'],true)
 assert.equal(rights.features['diagram.export.advanced'],true)
})
