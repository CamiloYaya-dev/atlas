const {readFileSync}=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),assert=require('node:assert/strict');
const load=(rel,bindings={})=>{
 const code=ts.transpileModule(readFileSync(path.join(root,rel),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(id.startsWith('node:'))return require(id);if(Object.hasOwn(bindings,id))return bindings[id];throw Error('No stub: '+id)},console,crypto:global.crypto,structuredClone});return module.exports;
};
const structural=load('packages/contracts/src/uml-structure.ts'),uml=load('packages/contracts/src/uml.ts'),contracts=load('packages/contracts/src/index.ts',{'./permissions':{},'./collaboration':{},'./export-fields':{},'./uml':uml,'./uml-structure':structural});
const roles={allowed:()=>true,requirePermission:()=>{}},DomainError=class extends Error{constructor(message,status){super(message);this.status=status}};
const policy=load('apps/api/src/modules/projects/application/document-policy.ts',{'@atlas/contracts':{relationScope:()=> 'mixed',umlElementAllowed:uml.umlElementAllowed,umlRelationAllowed:uml.umlRelationAllowed,validUmlDetail:structural.validUmlDetail},'../../../security/roles':roles,'../../../domain/errors':{DomainError}});
const file=path.join(root,'qa','ATLAS_CIRCUITO_UML_3_VISTAS_QA.json');const json=JSON.parse(readFileSync(file,'utf8'));const d=json.document;
assert.equal(contracts.isProjectDocument(d),true);policy.ensureUniqueIds(d);
for(const type of ['uml-class','uml-object','uml-component'])assert.ok(d.diagrams.find(x=>x.type===type));
assert.ok(d.diagrams.flatMap(v=>v.nodes).filter(x=>x.parentNodeId).length>=6);
assert.ok(Object.values(d.elements).filter(x=>x.uml?.attributes?.length).length>=3);
assert.ok(Object.values(d.elements).filter(x=>x.uml?.slots?.length).length>=2);
console.log('ATLAS UML QA validado: 4 vistas, 3 diagramas UML, contención y datos tipados');
