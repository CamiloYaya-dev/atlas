/** Ejecución sin binarios nativos: valida selección, licencias, HTML y ZIP reales. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),{inflateRawSync}=require('node:zlib'),{test}=require('node:test')
const root=path.resolve(__dirname,'..')
function load(rel,stubs={}){
 const filename=path.join(root,rel)
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const mod={exports:{}}
 vm.runInNewContext(code,{module:mod,exports:mod.exports,Buffer,console,require:(id)=>{
  if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id]
  if(id.startsWith('node:'))return require(id)
  throw Error('Dependencia no prevista '+id)
 }},{filename,timeout:5000})
 return mod.exports
}
const fields=load('packages/contracts/src/export-fields.ts')
const docs=load('apps/api/src/modules/exports/advanced-document.ts',{'@atlas/contracts':fields})
const licensing=load('apps/api/src/modules/licensing/licensing-policy.ts')
const document={schema:1,elements:{
 a:{id:'a',name:'Usuario <final>',type:'actor',summary:'Solicitud & pago',description:'',owner:'Camilo',author:'ATLAS',status:'Activo',createdAt:'2026-11-13',updatedAt:'2026-11-13',links:[],fields:{channel:'Web'}},
 b:{id:'b',name:'Plataforma',type:'system',summary:'',description:'',owner:'',author:'',status:'',createdAt:'',updatedAt:'',links:[],fields:{}}
 },fieldDefinitions:[{id:'channel',label:'Canal',forType:'actor',kind:'text'}],diagrams:[{id:'c1',name:'C1 test',description:'Contexto',type:'c1',createdAt:'2026-11-13',nodes:[{id:'na',elementId:'a',x:0,y:0},{id:'nb',elementId:'b',x:230,y:0}],edges:[{id:'r1',source:'na',target:'nb',label:'Usa',direction:'forward'}]}]}
const diagram=document.diagrams[0]
test('plan gratuito no autoriza documentación premium, pro la autoriza',()=>{
 const free=licensing.resolveEntitlements('w',null,new Date('2026-11-13'))
 assert.equal(free.features['diagram.export.advanced'],false)
 const pro=licensing.resolveEntitlements('w',{plan_code:'pro',status:'active',starts_at:new Date('2026-01-01'),ends_at:null,features:{}},new Date('2026-11-13'))
 assert.equal(pro.features['diagram.export.advanced'],true)
})
test('respeta campos de inspector y relaciones reales de cada caja',()=>{
 const available=fields.availableExportFields(document,diagram,'a')
 assert.equal(available.find(f=>f.key==='custom:channel').value,'Web')
 assert.match(available.find(f=>f.key==='@relations').value,/Usa/)
 const req=fields.validateAdvancedExport(document,diagram,{mode:'both',fields:{na:{summary:'embed','custom:channel':'dictionary','@relations':'dictionary'}}})
 assert.equal(fields.exportFieldsFor(document,diagram,document.elements.a,'na',req,'embed').map(f=>f.key).join(','),'summary')
 assert.equal(fields.exportFieldsFor(document,diagram,document.elements.a,'na',req,'dictionary').length,2)
})
test('bloquea campos y cajas ajenas e inyección de destinos',()=>{
 for(const [mode,choose] of [
 ['both',{missing:{summary:'embed'}}],['both',{na:{'no-autorizado':'embed'}}],['dictionary',{na:{summary:'embed'}}],['both',{na:{summary:'invalid'}}]
 ])assert.throws(()=>fields.validateAdvancedExport(document,diagram,{mode,fields:choose}))
})
test('HTML queda escapado y ZIP es extraíble con CRC correcto',()=>{
 const req=fields.validateAdvancedExport(document,diagram,{mode:'dictionary',fields:{na:{summary:'dictionary','custom:channel':'dictionary','@relations':'dictionary'}}})
 const html=docs.buildDiagramDictionary(document,diagram,req,'a-1')
 assert.match(html,/Usuario &lt;final&gt;/);assert.match(html,/Solicitud &amp; pago/)
 const img=Buffer.from('notreallyanimage'),zip=docs.zipFiles([{name:'ATLAS_C1.png',bytes:img},{name:'ATLAS_Diccionario.html',bytes:Buffer.from(html)}])
 assert.equal(zip.subarray(0,4).toString('hex'),'504b0304')
 const name=Buffer.from('ATLAS_Diccionario.html'),start=zip.indexOf(name)
 const header=start-30,len=zip.readUInt32LE(header+18),compressed=zip.subarray(start+name.length,start+name.length+len)
 assert.equal(inflateRawSync(compressed).toString('utf8'),html)
})

test('dos apariciones del mismo elemento mantienen selección independiente',()=>{
 const duplicated=structuredClone(document)
 duplicated.diagrams[0].nodes.push({id:'nc',elementId:'a',x:450,y:200})
 const view=duplicated.diagrams[0]
 const req=fields.validateAdvancedExport(duplicated,view,{mode:'both',fields:{na:{summary:'embed'},nc:{summary:'dictionary'}}})
 assert.equal(fields.exportFieldsFor(duplicated,view,duplicated.elements.a,'na',req,'embed').length,1)
 assert.equal(fields.exportFieldsFor(duplicated,view,duplicated.elements.a,'nc',req,'dictionary').length,1)
 assert.equal(fields.exportFieldsFor(duplicated,view,duplicated.elements.a,'nc',req,'embed').length,0)
})
