import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const layout='apps/web/src/features/editor/domain/diagram-beautify.ts'
const stubs={novziNodeSize:(_type,element,node)=>({width:node.width||255,height:node.height||145}),newActivityIssues:()=>[],newClassIssues:()=>[],newUseCaseIssues:()=>[],newComponentIssues:()=>[],newDeploymentIssues:()=>[],newSequenceIssues:()=>[]}
const code=ts.transpileModule(fs.readFileSync(layout,'utf8'),{fileName:layout,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exports={}
vm.runInNewContext(code,{exports,require:(name)=>name==='@novzi/contracts'?stubs:require(name),console,Math,Set,Map},{filename:layout})
const {beautifyDiagram,rebaseManualRoutes}=exports
const names=[['Entrada HTTP y controladores','component'],['Autenticación y cuentas','service'],['Profesionales y cumplimiento','service'],['Catálogo y búsqueda','service'],['Administración y seguridad','service'],['Llamadas y sesiones','service'],['Pagos y operaciones','service'],['Mensajería y notificaciones','service'],['Integración de agendas','service'],['Reservas y disponibilidad','service'],['Documentos, imágenes y adjuntos','service'],['Adaptadores de terceros','component'],['Acceso a datos y repositorios','component'],['Base de datos SQL Server','database']]
const edges=[]
for(let i=1;i<=10;i++)edges.push([0,i])
for(let i=1;i<=11;i++)edges.push([i,12])
for(let i=1;i<=10;i+=2)edges.push([i,11],[i,(i+1)%10+1])
edges.push([12,13],[8,11],[11,6])
const sample={schema:1,elements:Object.fromEntries(names.map(([name,type],i)=>[String(i),{id:String(i),type,name,links:[],fields:{}}])),diagrams:[{id:'C3',type:'c3',name:'C3 API',nodes:names.map((_,i)=>({id:String(i),elementId:String(i),x:(i%5)*280,y:Math.floor(i/5)*195,width:255,height:145})),edges:edges.map(([a,b],i)=>({id:'e-'+i,source:String(a),target:String(b),label:'Conector '+i}))},{id:'C1',type:'c1',name:'Unrelated',nodes:[],edges:[]}],fieldDefinitions:[]}
const old=JSON.parse(JSON.stringify(sample))
const changed=beautifyDiagram(sample,'C3','presentation')
const d=changed.diagrams[0]
assert.deepEqual(sample,old,'No mutation')
assert.deepEqual(changed.diagrams[1],old.diagrams[1],'Other diagram unaffected')
assert.equal(d.edges.length,edges.length)
assert.deepEqual(d.edges.map(e=>e.id),sample.diagrams[0].edges.map(e=>e.id))
const find=i=>d.nodes.find(n=>n.id===String(i))
for(let i=1;i<d.nodes.length;i++)for(let j=0;j<i;j++){
 const a=d.nodes[i],b=d.nodes[j]
 assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`Overlapping ${a.id},${b.id}`)
}
assert.ok(find(0).x<find(1).x,'Entry must be left')
assert.ok(find(1).x<find(12).x,'Domain before repository')
assert.ok(find(12).x<find(13).x,'Storage at far right')
assert.deepEqual(beautifyDiagram(changed,'C3','presentation'),changed,'Stable/idempotent layout')
const compact=beautifyDiagram(sample,'C3','compact')
const span=doc=>Math.max(...doc.diagrams[0].nodes.map(n=>n.x+n.width))-Math.min(...doc.diagrams[0].nodes.map(n=>n.x))
assert.ok(span(compact)<span(changed),'Compact should use less horizontal space')
// Rebase manual waypoints when its box moves; all other edges remain unchanged.
const withManual=JSON.parse(JSON.stringify(changed))
withManual.diagrams[0].edges[0].manualRoute={version:1,points:[{x:480,y:140},{x:700,y:140}]}
const after=JSON.parse(JSON.stringify(withManual))
after.diagrams[0].nodes[0].x+=150
const rebased=rebaseManualRoutes(withManual,after,'C3')
assert.notDeepEqual(rebased.diagrams[0].edges[0].manualRoute,withManual.diagrams[0].edges[0].manualRoute)
assert.equal(rebased.diagrams[0].edges[0].id,withManual.diagrams[0].edges[0].id)
assert.deepEqual(withManual.diagrams[0].edges[1],rebased.diagrams[0].edges[1])
// Authored port preferences are protected from automatic rerouting.
const authored=JSON.parse(JSON.stringify(sample))
authored.diagrams[0].edges[0].sourceHandle='bottom-3'
authored.diagrams[0].edges[0].targetHandle='top-1'
authored.diagrams[0].edges[0].portsLocked=true
const fixed=beautifyDiagram(authored,'C3','presentation').diagrams[0].edges[0]
assert.equal(fixed.sourceHandle,'bottom-3')
assert.equal(fixed.targetHandle,'top-1')
assert.equal(fixed.portsLocked,true)
console.log('OK: 14 componentes, 34+ relaciones, zonas arquitectónicas, solapamiento cero, semántica intacta, compactación, idempotencia y rebasing manual')
