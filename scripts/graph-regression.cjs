/** Regression test without esbuild/Rollup native binaries: exercises real TS source through tsc transpilation. */
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');const ts=require('typescript');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
// Resolve the real shared TypeScript modules, including transitive dependencies.
const contractCache=new Map();
function loadContract(filename){
 filename=path.resolve(filename);if(!path.extname(filename))filename+='.ts';
 if(contractCache.has(filename))return contractCache.get(filename).exports;
 const mod={exports:{}};contractCache.set(filename,mod);
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const run=vm.runInThisContext('(function(module,exports,require){'+code+'\n})',{filename});
 run(mod,mod.exports,id=>{if(id.startsWith('.'))return loadContract(path.resolve(path.dirname(filename),id));if(id.startsWith('node:'))return require(id);throw Error('Dependencia de contrato no prevista '+id)});return mod.exports;
}
const actualContracts=loadContract(path.join(root,'packages/contracts/src/index.ts'));
function load(rel,stubs={}){
 const filename=path.join(root,rel);
 if(rel.startsWith('packages/contracts/src/'))return loadContract(filename);
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 const sandbox={module,exports:module.exports,require:(id)=>{
  if(id==='@xyflow/react'&&Object.prototype.hasOwnProperty.call(stubs,id))return {...stubs[id],useUpdateNodeInternals:()=>()=>{}};
  if(Object.prototype.hasOwnProperty.call(stubs,id))return id==='@novzi/contracts'?{...actualContracts,...stubs[id]}:stubs[id];
  if(id==='react'||id.startsWith('node:'))return require(id);
  if(id.endsWith('/diagram-beautify'))return diagramBeautifyModule;
  throw Error(`Unexpected require ${id} in ${rel}`);
 },console,crypto:global.crypto,structuredClone:global.structuredClone};
 const execute=vm.runInThisContext('(function(module,exports,require,console,crypto,structuredClone){'+code+'\n})',{filename});
 execute(module,module.exports,sandbox.require,console,global.crypto,global.structuredClone);return module.exports;
}
const diagramBeautifyModule=load('apps/web/src/features/editor/domain/diagram-beautify.ts',{'@novzi/contracts':actualContracts});
const classPolicy=load('packages/contracts/src/uml-class-policy.ts');
const umlContainers=load('packages/contracts/src/uml-containers.ts',{'./uml-class-policy':classPolicy});
const sizing=load('packages/contracts/src/node-sizing.ts',{'./uml-containers':umlContainers,'./uml-class-policy':classPolicy});
const sequenceLayout=load('packages/contracts/src/uml-sequence-layout.ts');
const sequencePorts=load('packages/contracts/src/uml-sequence-ports.ts');
const commands=load('apps/web/src/features/editor/domain/document-commands.ts',{'@novzi/contracts':{...classPolicy,...umlContainers,...sizing,...sequenceLayout,...sequencePorts,validNodeDimension:n=>Number.isInteger(n)&&n>=48&&n<=4000}});
const parallel=loadContract(path.join(root,'packages/contracts/src/parallel-edges.ts'));
const assembly=load('apps/web/src/components/organisms/uml-assembly.ts');
const progress=load('apps/web/src/features/academy/progress.ts');
const umlStructure=load('packages/contracts/src/uml-structure.ts');
const uml=load('packages/contracts/src/uml.ts',{'./uml-class-policy':classPolicy});
const umlNotation=load('packages/contracts/src/uml-notation.ts',{'./uml':uml});
const exportFields=load('packages/contracts/src/export-fields.ts',{'./uml-structure':umlStructure,'./uml-class-policy':classPolicy,'./uml-notation':umlNotation});
const classScene=load('packages/contracts/src/uml-class-scene.ts',{'./uml-structure':umlStructure,'./uml-class-policy':classPolicy,'./uml-notation':umlNotation,'./uml-containers':umlContainers,'./node-sizing':sizing});
const umlPolicy={...classPolicy,...umlNotation,...umlContainers,...sizing,...sequenceLayout,...sequencePorts,validNodeDimension:n=>Number.isInteger(n)&&n>=48&&n<=4000,relationScope:()=> 'mixed',umlElementAllowed:uml.umlElementAllowed,umlRelationAllowed:uml.umlRelationAllowed,umlRelationEndpointValid:uml.umlRelationEndpointValid,validUmlDetail:umlStructure.validUmlDetail,isUmlDiagram:umlNotation.isUmlDiagram,validUmlEdgeNotation:umlNotation.validUmlEdgeNotation};
const contract=load('packages/contracts/src/index.ts',{'./uml-class-policy':classPolicy,'./uml-class-scene':classScene,'./permissions':{},'./collaboration':{},'./export-fields':exportFields,'./uml':uml,'./uml-structure':umlStructure,'./uml-notation':umlNotation,'./uml-containers':umlContainers,'./node-sizing':sizing,'./uml-sequence-layout':sequenceLayout,'./uml-sequence-ports':sequencePorts});
const roles={allowed:()=>true,requirePermission:()=>{}};
class DomainError extends Error{constructor(message,status){super(message);this.statusCode=status}}
const policy=load('apps/api/src/modules/projects/application/document-policy.ts',{'@novzi/contracts':umlPolicy,'../../../security/roles':roles,'../../../domain/errors':{DomainError}});
const e=(id,type,name=id)=>({id,type,name,summary:'',description:'',owner:'',author:'test',status:'Borrador',createdAt:'2026-11-12',updatedAt:'2026-11-12',links:[],fields:{}});
const d=(id,type,nodes=[],edges=[])=>({id,type,name:id,description:'',createdAt:'2026-11-12',nodes,edges});
const node=(id,elementId)=>({id,elementId,x:100,y:150});
const edge=(id,source,target,opts={})=>({id,source,target,...opts});
const doc=()=>({schema:1,elements:{a:e('a','container'),b:e('b','service'),c:e('c','database')},fieldDefinitions:[],diagrams:[d('c2','c2',[node('na','a'),node('nb','b'),node('nc','c')],[edge('r1','na','nb'),edge('r2','nb','nc')]) ]});
test('documento legado sigue siendo importable',()=>assert.equal(contract.isProjectDocument(doc()),true));
test('modificar dirección y tipo de línea preserva el par de nodos',()=>{
 const v=commands.editRelation(doc(),'c2','r1',{direction:'both',lineStyle:'dashed',pathStyle:'bezier',label:'HTTPS'});
 assert.equal(v.diagrams[0].edges[0].direction,'both');assert.equal(v.diagrams[0].edges[0].lineStyle,'dashed');assert.equal(v.diagrams[0].edges[0].pathStyle,'bezier');assert.equal(v.diagrams[0].edges[0].label,'HTTPS');assert.equal(v.diagrams[0].edges[0].source,'na');assert.equal(v.diagrams[0].edges[1].id,'r2');policy.ensureUniqueIds(v);assert.equal(contract.isProjectDocument(v),true);
});
test('eliminar relación conserva las cajas, el resto de relaciones y los datos',()=>{
 const v=commands.removeRelation(doc(),'c2','r1');assert.equal(v.diagrams[0].edges.length,1);assert.equal(v.diagrams[0].edges[0].id,'r2');assert.equal(v.diagrams[0].nodes.length,3);assert.equal(Object.keys(v.elements).length,3);policy.ensureUniqueIds(v)
});
test('se impide reemplazar los extremos de una relación existente',()=>assert.throws(()=>commands.editRelation(doc(),'c2','r1',{source:'nc'}),/extremos/));
test('puertos superiores/inferiores y líneas bidireccionales pasan el modelo',()=>{
 const v=commands.editRelation(doc(),'c2','r1',{sourceHandle:'top-2',targetHandle:'bottom-3',direction:'both',lineStyle:'dotted',pathStyle:'step'});policy.ensureUniqueIds(v);assert.equal(contract.isProjectDocument(v),true)
});
test('el backend rechaza enlaces a cajas inexistentes',()=>{
 const v=doc();v.elements.a.childDiagramId='c2';v.elements.a.childNodeId='missing';assert.throws(()=>policy.ensureUniqueIds(v),/Caja vinculada inexistente/)
});
test('eliminar una caja enlazada degrada el vínculo a vista general',()=>{
 const v=doc();v.elements.a.childDiagramId='c2';v.elements.a.childNodeId='nc';const out=commands.removeElementNode(v,'c2','c');assert.equal(out.elements.a.childDiagramId,'c2');assert.equal(out.elements.a.childNodeId,undefined);policy.ensureUniqueIds(out)
});
test('la insignia C2 admite sentido inverso en conexiones correctas',()=>{
 const v=doc();v.diagrams[0].edges=[edge('r1','nb','na'),edge('r2','nc','nb')];const result=progress.assessAcademy(v,true,'technical','c2');assert.equal(result.technical[0].done,true)
});
test('no se concede C2 por conexiones que omiten API ↔ BD',()=>{
 const v=doc();v.diagrams[0].edges=[edge('r1','na','nb'),edge('r2','nc','na')];const result=progress.assessAcademy(v,true,'technical','c2');assert.equal(result.technical[0].done,false)
});
test('navegación exacta: IDs de nodos únicos verificables en documento',()=>{
 const v=doc();v.elements.a.childDiagramId='c2';v.elements.a.childNodeId='nb';policy.ensureUniqueIds(v);assert.equal(v.diagrams.find(d=>d.id===v.elements.a.childDiagramId).nodes.find(n=>n.id===v.elements.a.childNodeId).elementId,'b')
});

test('las cajas presentan tres puertos arriba y tres abajo además de izquierda/derecha',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const Stub=()=>React.createElement('i');
 const icons=new Proxy({}, {get:()=>Stub});
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':icons,
  '@xyflow/react':{Handle:({id,type,position})=>React.createElement('span',{'data-port':id,'data-kind':type,'data-side':position}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '@novzi/contracts':{...classPolicy,diagramLabels:{c2:'C2'},elementLabels:{container:'Contenedor'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 });
 const html=renderToStaticMarkup(React.createElement(novzi.NovziNode,{data:{element:e('a','container'),mode:'mixed',graphType:'c2'},selected:false}));
 for(const id of ['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'])assert.match(html,new RegExp(`data-port="${id}"`));
 assert.equal((html.match(/data-port=/g)||[]).length,8)
});
test('el render de relaciones muestra ambas flechas y respeta el trazo',()=>{
 const hook=load('apps/web/src/features/editor/hooks/useGraphView.ts',{
  '../domain/graph-selection':{graphSelection:d=>({nodeIds:d.nodes.map(n=>n.id),edgeIds:d.edges.map(e=>e.id)})},
  '../domain/parallel-edges':parallel,
  'react':{useMemo:cb=>cb()},
  '@xyflow/react':{MarkerType:{ArrowClosed:'arrowclosed'}},'@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing}
 });
 const v=doc();v.diagrams[0].edges[0]={...v.diagrams[0].edges[0],direction:'both',lineStyle:'dashed',pathStyle:'bezier',sourceHandle:'top-2',targetHandle:'bottom-1'};
 const graph=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true});
 const rel=graph.edges[0];assert.equal(rel.type,'novzi-parallel');assert.equal(rel.data.parallelPath,'bezier');assert.ok(rel.data.routeObstacles.length>0);assert.equal(rel.markerEnd.type,'arrowclosed');assert.equal(rel.markerStart.type,'arrowclosed');assert.equal(rel.style.strokeDasharray,'7 5');assert.equal(rel.sourceHandle,'top-2');assert.equal(rel.targetHandle,'bottom-1');
 const old=graph.edges[1];assert.equal(old.sourceHandle,'right');assert.equal(old.targetHandle,'left');assert.ok(old.markerEnd);assert.equal(old.markerStart,undefined)
});
test('el backend exige relation.delete antes de permitir borrar una relación',()=>{
 const guarded=load('apps/api/src/modules/projects/application/document-policy.ts',{
  '@novzi/contracts':umlPolicy,
  '../../../security/roles':{allowed:()=>true,requirePermission:(_access,permission)=>{if(permission==='relation.delete.mixed')throw new DomainError('Permiso insuficiente',403)}},
  '../../../domain/errors':{DomainError}
 });
 const original=doc();const modified=commands.removeRelation(original,'c2','r1');
 assert.throws(()=>guarded.applyAuthorizedChange(original,modified,{}),/Permiso insuficiente/)
});
test('las relaciones nuevas sobreviven exportación e importación JSON sin modificar schema',()=>{
 const original=doc();const modified=commands.editRelation(original,'c2','r1',{direction:'both',lineStyle:'dotted',pathStyle:'straight',sourceHandle:'bottom-3',targetHandle:'top-1'});
 const copy=JSON.parse(JSON.stringify(modified));assert.equal(copy.schema,1);assert.equal(copy.diagrams[0].edges[0].sourceHandle,'bottom-3');assert.equal(copy.diagrams[0].edges[0].direction,'both');assert.equal(contract.isProjectDocument(copy),true);policy.ensureUniqueIds(copy)
});
test('el backend no permite vincular un nodo de una vista sin permiso',()=>{
 const protectedPolicy=load('apps/api/src/modules/projects/application/document-policy.ts',{
  '@novzi/contracts':umlPolicy,
  '../../../security/roles':{allowed:()=>true,requirePermission:(_access,permission)=>{if(permission==='diagram.view.c2')throw new DomainError('Vista restringida',403)}},
  '../../../domain/errors':{DomainError}
 });
 const original=doc();const edited=structuredClone(original);edited.elements.a.childDiagramId='c2';edited.elements.a.childNodeId='nb';
 assert.throws(()=>protectedPolicy.applyAuthorizedChange(original,edited,{}),/Vista restringida/)
});


test('permite dos o más relaciones entre las mismas cajas y distintos puertos',()=>{
 let v=doc()
 v=commands.connectNodes(v,'c2',edge('r3','na','nb',{sourceHandle:'top-1',targetHandle:'bottom-3',label:'Auditoría'}))
 v=commands.connectNodes(v,'c2',edge('r4','na','nb',{sourceHandle:'right',targetHandle:'left',label:'Notificaciones'}))
 v=commands.connectNodes(v,'c2',edge('r5','nb','na',{sourceHandle:'bottom-1',targetHandle:'top-3',label:'Respuesta'}))
 assert.equal(v.diagrams[0].edges.length,5)
 policy.ensureUniqueIds(v)
 assert.equal(contract.isProjectDocument(v),true)
 assert.throws(()=>commands.connectNodes(v,'c2',edge('r5','na','nb')),/ID de relación duplicado/)
 const bad=structuredClone(v);bad.diagrams[0].edges[4].id='r3';assert.throws(()=>policy.ensureUniqueIds(bad),/duplicada/i)
})
test('rutas separadas para relaciones paralelas en ambos sentidos y mismo puerto',()=>{
 const edges=[edge('a','na','nb'),edge('b','na','nb'),edge('c','nb','na'),edge('d','na','nb')]
 const offsets=parallel.parallelOffsets(edges)
 assert.equal(offsets.size,4)
 const curves=edges.map(x=>parallel.parallelRoute({sourceX:x.source==='na'?0:300,sourceY:80,targetX:x.target==='nb'?300:0,targetY:80,offset:offsets.get(x.id),pathStyle:'bezier'}))
 assert.equal(new Set(curves.map(r=>r.path)).size,4)
 assert.equal(new Set(curves.map(r=>r.labelY)).size,4)
 for(const style of ['straight','bezier','step','smoothstep']){
  const route=parallel.parallelRoute({sourceX:10,sourceY:50,targetX:300,targetY:50,offset:35,pathStyle:style})
  assert.ok(route.path.startsWith('M 10,50'));assert.ok(route.path.endsWith('300,50'))
  assert.ok(route.labelY>50)
 }
})
test('adaptador ReactFlow da una ruta única a cada relación del mismo par',()=>{
 const hook=load('apps/web/src/features/editor/hooks/useGraphView.ts',{
  '../domain/graph-selection':{graphSelection:d=>({nodeIds:d.nodes.map(n=>n.id),edgeIds:d.edges.map(e=>e.id)})},
  '../domain/parallel-edges':parallel,
  'react':{useMemo:cb=>cb()},
  '@xyflow/react':{MarkerType:{ArrowClosed:'arrowclosed'}},'@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing}
 })
 const v=doc()
 v.diagrams[0].edges.push(edge('r3','na','nb',{sourceHandle:'top-1',targetHandle:'bottom-1'}))
 v.diagrams[0].edges.push(edge('r4','na','nb',{sourceHandle:'right',targetHandle:'left',pathStyle:'bezier'}))
 const view=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true})
 const related=view.edges.filter(e=>['r1','r3','r4'].includes(e.id))
 assert.equal(related.filter(e=>e.type==='novzi-parallel').length,3)
 assert.equal(new Set(related.map(e=>e.data.parallelOffset)).size,3)
 assert.ok(view.edges.find(e=>e.id==='r2').data.routeObstacles.length>0)
 assert.equal(view.edges.find(e=>e.id==='r3').sourceHandle,'top-1')
 assert.equal(view.edges.find(e=>e.id==='r4').data.parallelPath,'bezier')
})
test('identidad de los cuatro niveles C4 y de vistas de procesos',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const badge=load('apps/web/src/components/atoms/DiagramTypeBadge.tsx',{'react/jsx-runtime':require('react/jsx-runtime')})
 for(const level of ['c1','c2','c3','c4']){
  const html=renderToStaticMarkup(React.createElement(badge.DiagramTypeBadge,{type:level}))
  assert.match(html,new RegExp('>'+level.toUpperCase()+'<'))
 }
 assert.match(renderToStaticMarkup(React.createElement(badge.DiagramTypeBadge,{type:'process'})),/>PROC</)
})

test('ReactFlow renderiza rutas paralelas seleccionables y etiquetas independientes',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const edgeComponent=load('apps/web/src/components/organisms/NovziParallelEdge.tsx',{
  '@xyflow/react':{
   BaseEdge:({path,interactionWidth})=>React.createElement('path',{'data-path':path,'data-hit':interactionWidth}),
   EdgeLabelRenderer:({children})=>React.createElement('span',{'data-edge-label':true},children)
  },
  '../../features/editor/domain/parallel-edges':parallel,'./uml-assembly':assembly,
  '@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=renderToStaticMarkup(React.createElement(edgeComponent.NovziParallelEdge,{
  id:'r3',sourceX:0,sourceY:0,targetX:300,targetY:0,
  data:{parallelOffset:30,parallelPath:'smoothstep'},label:'Entrega evento',style:{stroke:'#123'}
 }))
 assert.match(html,/data-hit="26"/)
 assert.match(html,/Entrega evento/)
 assert.match(html,/\bQ /) // esquinas redondeadas en las rutas smoothstep
})
test('los ocho puertos pueden iniciar y recibir conexiones en modo loose',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({}, {get:()=>Stub}),
  '@xyflow/react':{Handle:({id,type})=>React.createElement('span',{'data-port':id,'data-direction':type}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '@novzi/contracts':{...classPolicy,diagramLabels:{c2:'C2 · Contenedores'},elementLabels:{container:'Contenedor'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=renderToStaticMarkup(React.createElement(novzi.NovziNode,{data:{element:e('a','container'),mode:'mixed',graphType:'c2'},selected:false}))
 assert.equal((html.match(/data-direction="source"/g)||[]).length,8)
})
test('backend conserva todas las relaciones paralelas y permite borrar una sola con ACL',()=>{
 const original=doc()
 const updated=structuredClone(original)
 updated.diagrams[0].edges.push(edge('r3','na','nb',{sourceHandle:'top-2',targetHandle:'bottom-2'}))
 updated.diagrams[0].edges.push(edge('r4','na','nb',{sourceHandle:'right',targetHandle:'left'}))
 const saved=policy.applyAuthorizedChange(original,updated,{})
 assert.equal(saved.diagrams[0].edges.length,4)
 const revised=structuredClone(saved)
 revised.diagrams[0].edges=revised.diagrams[0].edges.filter(e=>e.id!=='r3')
 const deleted=policy.applyAuthorizedChange(saved,revised,{})
 assert.equal(deleted.diagrams[0].edges.length,3)
 assert.ok(deleted.diagrams[0].edges.some(e=>e.id==='r4'))
})

test('conectores superiores e inferiores terminan con flecha perpendicular y lateral horizontal',()=>{
 const sample=(sourcePosition,targetPosition)=>parallel.parallelRoute({sourceX:20,sourceY:100,targetX:250,targetY:150,offset:38,pathStyle:'step',sourcePosition,targetPosition})
 const top=sample('bottom','top');assert.match(top.path,/L 250,124 L 250,150$/)
 const bottom=sample('top','bottom');assert.match(bottom.path,/L 250,176 L 250,150$/)
 const left=sample('right','left');assert.match(left.path,/L 224,150 L 250,150$/)
 const right=sample('left','right');assert.match(right.path,/L 276,150 L 250,150$/)
})

test('UML 2.5.1 registra 14 vistas en tres categorías y restringe tipos',()=>{
 assert.equal(uml.UML_DIAGRAMS.length,14);assert.equal(new Set(uml.UML_DIAGRAMS).size,14);
 assert.deepEqual(Array.from(uml.UML_DIAGRAM_GROUPS.map(g=>g.types.length)),[7,3,4]);
 assert.equal(uml.umlElementAllowed('uml-usecase','usecase'),true);
 assert.equal(uml.umlElementAllowed('uml-class','usecase'),false);
 assert.equal(uml.umlRelationAllowed('uml-usecase','include'),true);
 assert.equal(uml.umlRelationAllowed('uml-deployment','include'),false);
});
test('UML uso: actor y caso de uso, vínculos a traza y permisos de persistencia',()=>{
 const v=doc();v.elements.a.type='actor';v.elements.b.type='usecase';
 v.diagrams=[d('usecases','uml-usecase',[node('na','a'),node('nb','b')],[edge('assoc','na','nb',{relationKind:'association'})]),d('trace','trace',[node('ra','b')],[])];
 v.elements.b.childDiagramId='usecases';v.elements.b.childNodeId='nb';
 policy.ensureUniqueIds(v);assert.equal(contract.isProjectDocument(v),true);
 const invalid=structuredClone(v);invalid.diagrams[0].edges[0].relationKind='composition';
 assert.throws(()=>policy.ensureUniqueIds(invalid),/Relación no permitida/);
 const invalidShape=structuredClone(v);invalidShape.diagrams[0].nodes[0].elementId='c';
 assert.throws(()=>policy.ensureUniqueIds(invalidShape),/Elemento no permitido/);
});

test('UML clases: atributos con tipo, longitud, multiplicidad y métodos con parámetros',()=>{
 const attr={id:'f1',name:'nombre',type:'String',length:80,visibility:'private',multiplicity:'0..1'}
 const op={id:'o1',name:'registrar',returnType:'Boolean',visibility:'public',parameters:[{id:'p1',name:'entrada',type:'Solicitud'}]}
 assert.equal(umlStructure.umlAttributeText(attr),'- nombre: String(80) [0..1]')
 assert.equal(umlStructure.umlOperationText(op),'+ registrar(entrada: Solicitud): Boolean')
 assert.equal(umlStructure.validUmlDetail({attributes:[attr],operations:[op]}),true)
 assert.equal(umlStructure.validUmlDetail({attributes:[{...attr,length:-1}]}),false)
 assert.equal(umlStructure.validUmlDetail({operations:[{...op,visibility:'invisible'}]}),false)
})
test('UML objetos: instancia subrayada y valores reales, sin campos genéricos',()=>{
 assert.equal(umlStructure.umlObjectTitle('solicitud1042','Solicitud'),'solicitud1042: Solicitud')
 assert.equal(umlStructure.validUmlDetail({classifier:'Solicitud',slots:[{id:'slot1',name:'estado',type:'String',value:'CREADA'}]}),true)
 assert.equal(umlStructure.validUmlDetail({classifier:'Solicitud',slots:[{id:'slot1',name:'estado',value:42}]}),false)
})
test('paquetes UML: contener caja convierte coordenadas relativas y desagrupar las restaura',()=>{
 const v=doc();v.elements.pkg=e('pkg','uml-package','Dominio.Solicitudes')
 v.diagrams[0]=d('uml-v','uml-class',[{id:'np',elementId:'pkg',x:150,y:100},{id:'na',elementId:'a',x:240,y:230}],[])
 v.elements.a.type='uml-class'
 const nested=commands.setNodePackage(v,'uml-v','na','np')
 const child=nested.diagrams[0].nodes.find(n=>n.id==='na')
 assert.equal(child.parentNodeId,'np');assert.deepEqual([child.x,child.y],[90,130]);policy.ensureUniqueIds(nested)
 const root=commands.setNodePackage(nested,'uml-v','na')
 const free=root.diagrams[0].nodes.find(n=>n.id==='na')
 assert.equal(free.parentNodeId,undefined);assert.deepEqual([free.x,free.y],[240,230]);policy.ensureUniqueIds(root)
})
test('UML: rechaza ciclos, destinos falsos y contención fuera de tipo',()=>{
 const v=doc();v.diagrams[0].type='uml-object';v.elements.a.type='uml-object'
 assert.throws(()=>commands.setNodePackage(v,'c2','na','na'),/sí mismo/)
 assert.throws(()=>commands.setNodePackage(v,'c2','na','nb'),/Contenedor UML incompatible/)
 v.diagrams[0].nodes[0].parentNodeId='nb'
 assert.throws(()=>policy.ensureUniqueIds(v),/Contención UML inválida/)
})
test('UML backend: no deja persistir detalles técnicos sin permisos',()=>{
 const original=doc();original.elements.a.uml={attributes:[{id:'a',name:'id',type:'String',visibility:'private'}]}
 const noTechnical={roleKey:'custom',permissions:['diagram.view.c2','element.view.container','element.view.service','element.view.database','element.edit.container','diagram.layout.c2']}
 const r={allowed:(_a,p)=>noTechnical.permissions.includes(p),requirePermission:(_a,p)=>{if(!noTechnical.permissions.includes(p))throw new DomainError('Permiso insuficiente '+p,403)}}
 const secured=load('apps/api/src/modules/projects/application/document-policy.ts',{
  '@novzi/contracts':umlPolicy,
  '../../../security/roles':r,'../../../domain/errors':{DomainError}
 })
 const visible=secured.projectVisible(original,noTechnical)
 assert.equal(visible.elements.a.uml,undefined)
 const changed=structuredClone(visible);changed.elements.a.name='Actualizado'
 const persisted=secured.applyAuthorizedChange(original,changed,noTechnical)
 assert.deepEqual(persisted.elements.a.uml,original.elements.a.uml)
})
test('UML grafo: se dibuja dentro del paquete y las conexiones usan notación propia',()=>{
 const hook=load('apps/web/src/features/editor/hooks/useGraphView.ts',{
  '../domain/graph-selection':{graphSelection:d=>({nodeIds:d.nodes.map(n=>n.id),edgeIds:d.edges.map(e=>e.id)})},
  '../domain/parallel-edges':parallel,'react':{useMemo:cb=>cb()},'@xyflow/react':{MarkerType:{ArrowClosed:'closed'}},'@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing}
 })
 const v=doc();v.elements.pkg=e('pkg','uml-package');v.elements.a.type='uml-class';v.elements.b.type='uml-class';v.diagrams[0]=d('uml','uml-class',[
  {id:'parent',elementId:'pkg',x:10,y:10},{id:'na',elementId:'a',x:30,y:90,parentNodeId:'parent'},{id:'nb',elementId:'b',x:670,y:90}
 ],[edge('association1','na','nb',{relationKind:'generalization',targetMultiplicity:'0..*'})])
 const graph=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'technical',selectedId:null,canEdit:true})
 assert.equal(graph.nodes[0].id,'parent');assert.equal(graph.nodes.find(n=>n.id==='na').parentId,'parent');assert.equal(graph.nodes.find(n=>n.id==='na').extent,'parent')
 assert.equal(graph.edges[0].type,'novzi-uml');assert.equal(graph.edges[0].data.relationKind,'generalization');assert.equal(graph.edges[0].data.targetMultiplicity,'0..*')
 policy.ensureUniqueIds(v)
})
test('UML clases, objetos y componentes usan compartimentos, valores y símbolo propio',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({}, {get:()=>Stub}),
  '@xyflow/react':{Handle:({id})=>React.createElement('span',{'data-port':id}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-class':'UML Clases','uml-object':'Objetos','uml-component':'Componentes'},elementLabels:{'uml-class':'Clase','uml-object':'Instancia',component:'Componente'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=(element,graphType)=>renderToStaticMarkup(React.createElement(novzi.NovziNode,{data:{element,mode:'technical',graphType},selected:false}))
 const klass={...e('cls','uml-class','Cliente'),uml:{attributes:[{id:'a',name:'id',type:'UUID',visibility:'private'}],operations:[{id:'o',name:'guardar',returnType:'void',visibility:'public',parameters:[]}]}}
 assert.match(html(klass,'uml-class'),/- id: UUID/);assert.match(html(klass,'uml-class'),/\+ guardar\(\): void/)
 const object={...e('obj','uml-object','c1'),uml:{classifier:'Cliente',slots:[{id:'s',name:'id',value:'abc'}]}}
 assert.match(html(object,'uml-object'),/c1: Cliente/);assert.match(html(object,'uml-object'),/id = abc/)
 assert.match(html(e('cmp','component','Motor'),'uml-component'),/Símbolo UML de componente/)
})
test('UML líneas: agregación, composición, herencia, realización y ball/socket',()=>{
 const edges=load('apps/web/src/components/organisms/NovziUmlEdge.tsx',{
  '@xyflow/react':{BaseEdge:()=>null,EdgeLabelRenderer:({children})=>children},
  'react':require('react'),
  '../../features/editor/domain/parallel-edges':parallel,'./uml-assembly':assembly,
  '@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const rel=edges.umlRelationAdornment
 assert.equal(rel('composition').start,'composition')
 assert.equal(rel('aggregation').start,'aggregation')
 assert.equal(rel('generalization').end,'triangle')
 assert.deepEqual([rel('realization').end,rel('realization').dash],['triangle',true])
 assert.equal(rel('provided-interface').end,'ball')
 assert.equal(rel('required-interface').end,'socket')
 assert.equal(rel('assembly').end,'ball-socket')
 assert.match(uml.umlRelationLabel('composition'),/rombo negro/)
})
test('UML atributos, operaciones, slots y paquete se ofrecen en fichas de exportación avanzada',()=>{
 const v=doc();v.elements.a.type='uml-class';v.elements.b.type='uml-object';v.elements.pkg=e('pkg','uml-package','Dominio')
 v.elements.a.uml={attributes:[{id:'x',name:'codigo',type:'String',length:30,visibility:'private'}],operations:[{id:'op',name:'guardar',returnType:'Boolean',visibility:'public',parameters:[]}]}
 v.elements.b.uml={classifier:'Solicitud',slots:[{id:'slot',name:'estado',value:'ACTIVA'}]}
 v.diagrams[0]=d('duml','uml-object',[{id:'pkg',elementId:'pkg',x:25,y:50},{id:'na',elementId:'a',x:25,y:80,parentNodeId:'pkg'},{id:'nb',elementId:'b',x:395,y:80,parentNodeId:'pkg'}],[])
 const classFields=exportFields.availableExportFields(v,v.diagrams[0],'a')
 const objectFields=exportFields.availableExportFields(v,v.diagrams[0],'b')
 assert.equal(classFields.find(x=>x.key==='uml.attributes').value,'- codigo: String(30)')
 assert.equal(classFields.find(x=>x.key==='uml.operations').value,'+ guardar(): Boolean')
 assert.equal(objectFields.find(x=>x.key==='uml.slots').value,'estado = ACTIVA')
 assert.equal(classFields.find(x=>x.key==='uml.package').value,'Dominio')
})
test('UML componentes: formas de marcador SVG para generalización y composición',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const el=load('apps/web/src/components/organisms/NovziUmlEdge.tsx',{
  '@xyflow/react':{BaseEdge:({id,path,markerStart,markerEnd,style})=>React.createElement('path',{id,d:path,'data-start':markerStart||'','data-end':markerEnd||'',style}),EdgeLabelRenderer:({children})=>React.createElement('g',null,children)},
  'react':React,'../../features/editor/domain/parallel-edges':parallel,'./uml-assembly':assembly,'@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing},'react/jsx-runtime':require('react/jsx-runtime')
 })
 const edge=(kind)=>renderToStaticMarkup(React.createElement(el.NovziUmlEdge,{id:'uml-edge-test',sourceX:10,sourceY:40,targetX:300,targetY:40,sourcePosition:'right',targetPosition:'left',data:{parallelOffset:0,parallelPath:'straight',relationKind:kind},label:''}))
 assert.match(edge('composition'),/data-uml-terminal="diamond-filled"/)
 assert.match(edge('composition'),/fill="#506986"/)
 assert.match(edge('aggregation'),/fill="white"/)
 assert.match(edge('generalization'),/data-uml-terminal="triangle"/)
 assert.match(edge('realization'),/stroke-dasharray:7 5/)
 assert.match(edge('assembly'),/data-uml-terminal="assembly"/)
})

test('los 14 tipos UML ofrecen notación fija para cada relación (trazo, sentido y símbolos)',()=>{
 assert.equal(uml.UML_DIAGRAMS.length,14)
 const everyType=uml.UML_DIAGRAMS.map(type=>({type,relations:uml.UML_RELATIONS_BY_DIAGRAM[type]}))
 for(const {type,relations} of everyType){
  assert.ok(relations.length>0,type)
  for(const kind of relations){
   assert.ok(umlNotation.UML_NOTATION[kind],`${type}: falta notación ${kind}`)
   const base=edge('x','a','b',{relationKind:kind})
   const normalized=umlNotation.canonicalUmlEdge(type,base)
   assert.equal(normalized.direction,umlNotation.umlRelationNotation(kind).direction)
   assert.equal(normalized.lineStyle,umlNotation.umlRelationNotation(kind).stroke)
   assert.ok(umlNotation.validUmlEdgeNotation(type,normalized))
   assert.equal(umlNotation.validUmlEdgeNotation(type,{...normalized,direction:'both'}),normalized.direction==='both')
  }
 }
 assert.equal(umlNotation.umlRelationNotation('composition').start,'diamond-filled')
 assert.equal(umlNotation.umlRelationNotation('aggregation').start,'diamond-open')
 assert.equal(umlNotation.umlRelationNotation('required-interface').end,'socket')
 assert.equal(umlNotation.umlRelationNotation('provided-interface').end,'ball')
})
test('orientación de símbolos UML sigue el lado del puerto, no el vector diagonal',()=>{
 const edges=load('apps/web/src/components/organisms/NovziUmlEdge.tsx',{
  '@xyflow/react':{BaseEdge:()=>null,EdgeLabelRenderer:({children})=>children},
  'react':require('react'),'@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing},
  '../../features/editor/domain/parallel-edges':parallel,'./uml-assembly':assembly,'react/jsx-runtime':require('react/jsx-runtime')
 })
 assert.equal(edges.terminalAngle('top',100,100,400,400),-90)
 assert.equal(edges.terminalAngle('bottom',100,100,400,400),90)
 assert.equal(edges.terminalAngle('left',100,100,400,400),180)
 assert.equal(edges.terminalAngle('right',100,100,400,400),0)
})
test('API rechaza nuevas relaciones UML semánticamente inválidas y conserva el documento original',()=>{
 const original=doc()
 delete original.elements.c
 original.elements.a.type='uml-class';original.elements.b.type='uml-class';original.diagrams=[d('uml1','uml-class',[node('na','a'),node('nb','b')],[])]
 const invalid=structuredClone(original)
 invalid.diagrams[0].edges.push(edge('new-rel','na','nb',{relationKind:'composition',direction:'both',lineStyle:'dotted'}))
 assert.throws(()=>policy.applyAuthorizedChange(original,invalid,{}),/notación|normativo/)
 const valid=structuredClone(original)
 valid.diagrams[0].edges.push(umlNotation.canonicalUmlEdge('uml-class',edge('new-rel','na','nb',{relationKind:'composition',direction:'both',lineStyle:'dotted'})))
 const saved=policy.applyAuthorizedChange(original,valid,{})
 assert.equal(saved.diagrams[0].edges[0].direction,'none')
 assert.equal(saved.diagrams[0].edges[0].lineStyle,'solid')
 assert.equal(original.diagrams[0].edges.length,0)
})
test('grafo UML antiguo se visualiza con notación correcta sin reescribir relaciones persistidas',()=>{
 const hook=load('apps/web/src/features/editor/hooks/useGraphView.ts',{
  '../domain/graph-selection':{graphSelection:d=>({nodeIds:d.nodes.map(n=>n.id),edgeIds:d.edges.map(e=>e.id)})},
  '../domain/parallel-edges':parallel,'react':{useMemo:cb=>cb()},'@xyflow/react':{MarkerType:{ArrowClosed:'closed'}},'@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing}
 })
 const v=doc();v.elements.a.type='uml-class';v.elements.b.type='uml-class'
 v.diagrams[0]=d('old','uml-class',[node('na','a'),node('nb','b')],[edge('r','na','nb',{relationKind:'composition',direction:'both',lineStyle:'dotted'})])
 const graph=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'technical',selectedId:null,canEdit:true})
 assert.equal(graph.edges[0].type,'novzi-uml')
 assert.equal(graph.edges[0].markerStart,undefined)
 assert.equal(graph.edges[0].markerEnd,undefined)
 assert.equal(graph.edges[0].style.strokeDasharray,undefined)
 assert.equal(v.diagrams[0].edges[0].direction,'both') // lectura sin mutar el historial
})

test('UML paquetes: catálogo nuevo sólo admite Package; subpaquete es paquete anidado',()=>{
 assert.deepEqual([...uml.UML_ELEMENTS_BY_DIAGRAM['uml-package']],['uml-package','uml-subpackage','uml-model','uml-profile'])
 assert.equal(uml.umlElementCreatable('uml-package','uml-class'),false)
 assert.equal(uml.umlElementAllowed('uml-package','uml-class'),true) // lectura histórica
 const v=doc();v.elements.p=e('p','uml-package','Dominio');v.elements.q=e('q','uml-package','Solicitudes');v.elements.r=e('r','uml-package','Validaciones')
 v.diagrams=[d('packages','uml-package',[{id:'p',elementId:'p',x:20,y:30},{id:'q',elementId:'q',x:120,y:150},{id:'r',elementId:'r',x:180,y:220}],[])]
 const child=commands.setNodePackage(v,'packages','q','p')
 const sub=commands.setNodePackage(child,'packages','r','q')
 assert.equal(sub.diagrams[0].nodes.find(n=>n.id==='r').parentNodeId,'q')
 assert.equal(umlContainers.umlAncestryValid(sub.diagrams[0],sub.diagrams[0].nodes.find(n=>n.id==='r'),sub.elements),true)
 policy.ensureUniqueIds(sub)
 assert.throws(()=>commands.setNodePackage(sub,'packages','p','r'),/ciclo/i)
})

test('UML estructura compuesta: puerto encajado en borde y jerarquía de dos niveles',()=>{
 const v=doc();v.elements.parent=e('parent','uml-class','SistemaPago');v.elements.part=e('part','uml-part','api:API');v.elements.port=e('port','uml-port','p:IPagos')
 v.diagrams=[d('composite','uml-composite',[
  {id:'parent',elementId:'parent',x:100,y:100},
  {id:'part',elementId:'part',x:260,y:230},
  {id:'port',elementId:'port',x:820,y:330}
 ],[])]
 const part=commands.setNodePackage(v,'composite','part','parent')
 const connected=commands.setNodePackage(part,'composite','port','parent')
 const port=connected.diagrams[0].nodes.find(n=>n.id==='port')
 assert.equal(port.parentNodeId,'parent')
 const {width,height}=umlContainers.UML_COMPOSITE_SIZE
 const alignedToBorder=[Math.abs(port.x+90)<=1,Math.abs(port.x+90-width)<=1,Math.abs(port.y+41)<=1,Math.abs(port.y+41-height)<=1]
 assert.ok(alignedToBorder.some(Boolean),'el puerto debe atravesar uno de los cuatro bordes')
 const moved=commands.moveNode(connected,'composite','port',port.x+20,port.y+10)
 const anchored=commands.setNodePackage(moved,'composite','port','parent')
 const p2=anchored.diagrams[0].nodes.find(n=>n.id==='port')
 assert.notDeepEqual([p2.x,p2.y],[port.x+20,port.y+10])
 assert.equal(umlContainers.umlAncestryValid(anchored.diagrams[0],p2,anchored.elements),true)
 policy.ensureUniqueIds(anchored)
 const nested=commands.setNodePackage(anchored,'composite','port','part')
 assert.equal(nested.diagrams[0].nodes.find(n=>n.id==='port').parentNodeId,'part')
 policy.ensureUniqueIds(nested)
})

test('UML despliegue: dispositivos y entornos son semánticamente diferentes y tienen iconos válidos',()=>{
 assert.deepEqual([...uml.UML_ELEMENTS_BY_DIAGRAM['uml-deployment']],['uml-node','uml-device','uml-execution','uml-artifact','uml-object','uml-part','component','uml-class','uml-interface','uml-datatype','uml-package','uml-comment','uml-constraint'])
 assert.deepEqual([...uml.UML_RELATIONS_BY_DIAGRAM['uml-deployment']],['communication-path','deployment','manifestation','dependency','usage','generalization','composition','containment','annotation'])
 assert.equal(uml.umlElementCreatable('uml-deployment','database'),false)
 assert.equal(uml.umlElementAllowed('uml-deployment','database'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-deployment','communication-path','uml-device','uml-node'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-deployment','communication-path','uml-artifact','uml-node'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-deployment','deployment','uml-artifact','uml-device'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-deployment','deployment','uml-device','uml-artifact'),false)
 assert.equal(umlStructure.validUmlDetail({deviceIcon:'android',runtimeIcon:'docker'}),true)
 assert.equal(umlStructure.validUmlDetail({deviceIcon:'made-up-device'}),false)
})

test('UML conexiones: geometría compartida para ensamblaje y terminales cuadrados entre partes',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const component=load('apps/web/src/components/organisms/NovziUmlEdge.tsx',{
  '@xyflow/react':{BaseEdge:()=>null,EdgeLabelRenderer:({children})=>children},
  'react':React,'../../features/editor/domain/parallel-edges':parallel,'./uml-assembly':assembly,
  '@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing},'react/jsx-runtime':require('react/jsx-runtime')
 })
 const svg=(kind,additional={})=>renderToStaticMarkup(React.createElement(component.NovziUmlEdge,{
  id:'relation',sourceX:30,sourceY:75,targetX:380,targetY:75,sourcePosition:'right',targetPosition:'left',
  data:{parallelOffset:0,parallelPath:'straight',relationKind:kind,...additional}
 }))
 const assembled=svg('assembly')
 assert.match(assembled,/data-uml-terminal="assembly"/)
 assert.match(assembled,/cx="-5" cy="0" r="7"/)
 assert.match(assembled,/M 3,-11 Q 25,0 3,11/)
 assert.match(assembled,/data-uml-terminal="assembly"/)
 const connector=svg('connector',{diagramType:'uml-composite',sourceElementType:'uml-part',targetElementType:'uml-part'})
 assert.equal((connector.match(/data-uml-terminal="port-square"/g)||[]).length,2)
})

test('UML editor: cuatro vistas permiten sólo sus relaciones de creación y preservan las heredadas',()=>{
 assert.deepEqual([...uml.UML_RELATIONS_BY_DIAGRAM['uml-composite']],['connector','assembly'])
 assert.equal(uml.umlRelationCreatable('uml-composite','delegation'),false)
 assert.equal(uml.umlRelationAllowed('uml-composite','delegation'),true)
 assert.equal(uml.umlRelationCreatable('uml-composite','composition'),false)
 assert.equal(uml.umlRelationAllowed('uml-composite','composition'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-composite','connector','uml-part','uml-part'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-composite','delegation','uml-port','uml-part'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-composite','connector','uml-class','uml-part'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-package','import','uml-package','uml-package'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-package','import','uml-class','uml-package'),false)
})

test('QA CIRCUITO: importar cuatro vistas estructurales y navegar entre cajas conserva jerarquía',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'QA_EJEMPLO_UML_4_VISTAS.json'),'utf8')).document
 assert.equal(contract.isProjectDocument(fixture),true)
 assert.equal(fixture.diagrams.length,4)
 policy.ensureUniqueIds(fixture)
 for(const diagram of fixture.diagrams){
  assert.ok(diagram.nodes.length>=4)
  for(const node of diagram.nodes)assert.ok(umlContainers.umlAncestryValid(diagram,node,fixture.elements))
  for(const relation of diagram.edges){
   const origin=fixture.elements[diagram.nodes.find(n=>n.id===relation.source).elementId]
   const target=fixture.elements[diagram.nodes.find(n=>n.id===relation.target).elementId]
   const valid=uml.umlRelationEndpointValid(diagram.type,relation.relationKind,origin.type,target.type)
   if(!valid){
    // One 2026 historical relation predates typed interface constraints; it must
    // remain loadable without allowing newly created invalid connectors.
    assert.equal(diagram.type,'uml-component')
    assert.equal(relation.id,'relation-833c01c9')
    assert.equal(relation.relationKind,'required-interface')
    assert.equal(origin.type,'component')
    assert.equal(target.type,'uml-port')
    assert.deepEqual(actualContracts.newComponentIssues(fixture,structuredClone(fixture)),[])
    const introduced=structuredClone(fixture)
    introduced.diagrams.find(d=>d.id===diagram.id).edges.push({...relation,id:'qa-new-invalid-ux'})
    assert.ok(actualContracts.newComponentIssues(fixture,introduced).some(issue=>issue.severity==='error'))
   }else assert.ok(valid,`${diagram.name}/${relation.relationKind}`)
  }
 }
})

test('UML render: clasificador, puerto, dispositivos Docker y subpaquete son figuras distintas',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({}, {get:()=>Stub}),
  '@xyflow/react':{Handle:()=>React.createElement('i',{'data-port':1}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-composite':'Compuesta','uml-deployment':'Despliegue','uml-package':'Paquetes'},elementLabels:{'uml-class':'Clase UML','uml-port':'Puerto','uml-device':'Dispositivo','uml-execution':'Entorno','uml-package':'Paquete'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=(model,view,extra={})=>renderToStaticMarkup(React.createElement(novzi.NovziNode,{data:{element:model,mode:'technical',graphType:view,...extra},selected:false}))
 assert.match(html(e('s','uml-class','SistemaPago'),'uml-composite'),/uml-composite-classifier/)
 assert.match(html(e('port','uml-port','p:IPagos'),'uml-composite'),/uml-composite-port/)
 assert.match(html({...e('android','uml-device','Android'),uml:{deviceIcon:'android'}},'uml-deployment'),/«device»/)
 assert.match(html({...e('docker','uml-execution','Runtime'),uml:{runtimeIcon:'docker'}},'uml-deployment'),/docker/)
 assert.match(html(e('pkg','uml-package','Subpaquete'),'uml-package',{nestingDepth:1}),/uml-nested-level-1/)
})

test('UML despliegue: nodo contiene Docker y artefacto sin perder posición absoluta',()=>{
 const v=doc();v.elements.dev=e('dev','uml-device');v.elements.runtime=e('runtime','uml-execution');v.elements.artifact=e('artifact','uml-artifact')
 v.diagrams=[d('deployment','uml-deployment',[
  {id:'dev',elementId:'dev',x:100,y:200},{id:'runtime',elementId:'runtime',x:180,y:315},{id:'artifact',elementId:'artifact',x:240,y:400}
 ],[])]
 const a=commands.setNodePackage(v,'deployment','runtime','dev')
 assert.throws(()=>commands.setNodePackage(a,'deployment','artifact','runtime'));
 const assigned=actualContracts.createNestedDeployment(a,'deployment','artifact','runtime');
 const b=commands.setNodePackage(assigned,'deployment','artifact','runtime')
 assert.equal(b.diagrams[0].nodes.find(n=>n.id==='runtime').parentNodeId,'dev')
 assert.equal(b.diagrams[0].nodes.find(n=>n.id==='artifact').parentNodeId,'runtime')
 assert.equal(umlContainers.umlAbsolutePosition(b.diagrams[0],b.diagrams[0].nodes.find(n=>n.id==='artifact')).x,240);assert.equal(umlContainers.umlAbsolutePosition(b.diagrams[0],b.diagrams[0].nodes.find(n=>n.id==='artifact')).y,400)
 policy.ensureUniqueIds(b)
})

// Correcciones de visualización y resize (2026-11-13).
test('ensamblaje calcula la tangente de la RUTA real en horizontal, vertical y curvas',()=>{
 const h=assembly.assemblyAnchor('M 0,0 L 100,0')
 const v=assembly.assemblyAnchor('M 0,0 L 0,100')
 const bent=assembly.assemblyAnchor('M 0,0 L 70,0 L 70,30 L 130,30')
 const curve=assembly.assemblyAnchor('M 0,0 C 20,0 80,100 100,100')
 assert.equal(h.x,50);assert.equal(h.y,0);assert.equal(h.angle,0)
 assert.equal(v.x,0);assert.equal(v.y,50);assert.equal(v.angle,90)
 assert.equal(bent.angle,0) // Símbolo sobre el tramo recto largo, no en el codo
 assert.ok(curve.x>30&&curve.x<70&&curve.y>30&&curve.y<70)
})
test('redimensionar cambia únicamente la aparición seleccionada y persiste en el contrato',()=>{
 const v=doc();v.diagrams.push(d('other','custom',[{...node('n-other','a'),x:20,y:30}],[]))
 const out=commands.resizeNode(v,'c2','na',410,220,95,75)
 assert.deepEqual([out.diagrams[0].nodes[0].width,out.diagrams[0].nodes[0].height,out.diagrams[0].nodes[0].x,out.diagrams[0].nodes[0].y],[410,220,95,75])
 assert.equal(out.diagrams[1].nodes[0].width,undefined)
 assert.equal(v.diagrams[0].nodes[0].width,undefined)
 assert.equal(contract.isProjectDocument(out),true)
 policy.ensureUniqueIds(out)
})
test('servidor rechaza medidas falsas, negativas o excesivas',()=>{
 const v=doc();v.diagrams[0].nodes[0].width=-20
 assert.equal(contract.isProjectDocument(v),false)
 assert.throws(()=>policy.ensureUniqueIds(v),/Dimensiones/)
 assert.throws(()=>commands.resizeNode(doc(),'c2','na',20000,100),/4000/)
 assert.throws(()=>commands.resizeNode(doc(),'c2','na',90,50),/Tamaño mínimo/)
})
test('el clasificador sigue llevando su puerto al borde al cambiar de tamaño',()=>{
 const v=doc();v.elements={parent:e('parent','uml-class'),port:e('port','uml-port'),part:e('part','uml-part')}
 v.diagrams=[d('composite','uml-composite',[{id:'root',elementId:'parent',x:20,y:20},
  {id:'port',elementId:'port',x:690,y:120,parentNodeId:'root'},
  {id:'part',elementId:'part',x:280,y:150,parentNodeId:'root'}],[])]
 const out=commands.resizeNode(v,'composite','root',920,540)
 assert.equal(out.diagrams[0].nodes[1].x,830) // mitad de 180 desde el nuevo borde
 assert.equal(out.diagrams[0].nodes[2].x,280)
 policy.ensureUniqueIds(out)
 assert.throws(()=>commands.resizeNode(v,'composite','root',410,300),/elementos internos/)
})
test('delegación sigue legible en modelos antiguos pero no puede crearse desde el menú',()=>{
 assert.equal(uml.umlRelationAllowed('uml-composite','delegation'),true)
 assert.equal(uml.umlRelationCreatable('uml-composite','delegation'),false)
 assert.deepEqual([...uml.UML_RELATIONS_BY_DIAGRAM['uml-composite']],['connector','assembly'])
})

// QA 2026-11-14: paquetes, sujeto de casos de uso, perfiles y ensamble.
test('UML paquetes ofrece paquete, subpaquete, Model y Profile, manteniendo semántica de contención',()=>{
 assert.deepEqual([...uml.UML_ELEMENTS_BY_DIAGRAM['uml-package']],['uml-package','uml-subpackage','uml-model','uml-profile'])
 for(const parent of ['uml-package','uml-model'])assert.equal(umlContainers.umlContainerAllows('uml-package',parent,'uml-subpackage'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-package','uml-metaclass','uml-subpackage'),false)
 const d1=d('pack','uml-package',[{id:'parent',elementId:'parent',x:20,y:40},{id:'child',elementId:'child',x:100,y:110,parentNodeId:'parent'}],[])
 const v=doc();v.elements.parent=e('parent','uml-package');v.elements.child=e('child','uml-subpackage');v.diagrams=[d1]
 policy.ensureUniqueIds(v)
 const invalid=structuredClone(v);delete invalid.diagrams[0].nodes[1].parentNodeId
 assert.throws(()=>policy.ensureUniqueIds(invalid),/subpaquete debe estar contenido/)
})
test('UML casos de uso presenta catálogo contextual y sujeto; este encapsula casos',()=>{
 assert.deepEqual([...uml.UML_ELEMENTS_BY_DIAGRAM['uml-usecase']],['actor','usecase','uml-subject','uml-comment','uml-constraint','uml-class','uml-interface','uml-enumeration','uml-datatype','uml-primitive','uml-association-class','uml-signal','component'])
 assert.equal(uml.umlElementCreatable('uml-usecase','requirement'),false)
 assert.equal(uml.umlElementAllowed('uml-usecase','requirement'),true) // histórico
 assert.equal(umlContainers.umlContainerAllows('uml-usecase','uml-subject','usecase'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-usecase','uml-subject','requirement'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-usecase','include','usecase','usecase'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-usecase','include','actor','usecase'),false)
})
test('UML perfiles dispone de extensión, apply, reference y generalización con extremos reales',()=>{
 assert.deepEqual([...uml.UML_ELEMENTS_BY_DIAGRAM['uml-profile']],['uml-profile','uml-stereotype','uml-metaclass','uml-package'])
 assert.deepEqual([...uml.UML_RELATIONS_BY_DIAGRAM['uml-profile']],['extension','apply','reference','generalization'])
 for(const [kind,a,b] of [['extension','uml-stereotype','uml-metaclass'],['apply','uml-model','uml-profile'],['reference','uml-profile','uml-metaclass'],['generalization','uml-stereotype','uml-stereotype']]){
  assert.equal(uml.umlRelationEndpointValid('uml-profile',kind,a,b),true,kind)
  assert.equal(uml.umlRelationCreatable('uml-profile',kind),true)
 }
 assert.equal(uml.umlRelationEndpointValid('uml-profile','apply','uml-stereotype','uml-profile'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-profile','extension','uml-profile','uml-metaclass'),false)
 assert.equal(uml.umlRelationCreatable('uml-profile','stereotype-application'),false)
 assert.equal(uml.umlRelationAllowed('uml-profile','stereotype-application'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-profile','uml-profile','uml-stereotype'),true)
 assert.equal(umlNotation.umlRelationNotation('apply').label,'«apply»')
 assert.equal(umlNotation.umlRelationNotation('reference').label,'«reference»')
})
test('UML visibilidad admite sólo los cuatro valores estándar',()=>{
 for(const v of ['public','private','protected','package'])assert.equal(umlStructure.validUmlDetail({visibility:v}),true)
 assert.equal(umlStructure.validUmlDetail({visibility:'internal'}),false)
})
test('ensamblaje UML: la concavidad del socket mira a la bola, sobre tramos horizontales y verticales',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const component=load('apps/web/src/components/organisms/NovziUmlEdge.tsx',{
  '@xyflow/react':{BaseEdge:()=>null,EdgeLabelRenderer:({children})=>children},
  'react':React,'../../features/editor/domain/parallel-edges':parallel,'./uml-assembly':assembly,
  '@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing},'react/jsx-runtime':require('react/jsx-runtime')
 })
 const render=(kind,coordinates)=>renderToStaticMarkup(React.createElement(component.NovziUmlEdge,{id:'edge',
  ...coordinates,data:{parallelOffset:0,parallelPath:'straight',relationKind:kind}}))
 for(const coords of [
  {sourceX:20,sourceY:100,targetX:320,targetY:100,sourcePosition:'right',targetPosition:'left'},
  {sourceX:150,sourceY:0,targetX:150,targetY:340,sourcePosition:'bottom',targetPosition:'top'}
 ]){
  const xml=render('assembly',coords)
  assert.match(xml,/M 3,-11 Q 25,0 3,11/)
  assert.match(xml,/cx="-5" cy="0" r="7"/)
  assert.equal((xml.match(/data-uml-terminal="assembly"/g)||[]).length,1)
 }
})
test('al mover cajas con rutas ortogonales el ensamble se mantiene sobre un segmento, nunca en el codo',()=>{
 for(const path of ['M 0,0 L 90,0 L 90,40 L 200,40','M 50,50 L 50,170 L 90,170 L 90,310']){
  const anchor=assembly.assemblyAnchor(path)
  assert.ok(anchor.angle===0||anchor.angle===90)
  assert.ok(Number.isFinite(anchor.x)&&Number.isFinite(anchor.y))
 }
})
test('importación QA 5 vistas: estructuras anidadas y relaciones de perfiles y casos de uso',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/NOVZI_QA_UML_Cinco_Vistas_20261114.json'),'utf8')).document
 assert.equal(contract.isProjectDocument(fixture),true)
 assert.equal(fixture.diagrams.length,5)
 policy.ensureUniqueIds(fixture)
 for(const view of fixture.diagrams){
  for(const node of view.nodes)assert.ok(umlContainers.umlAncestryValid(view,node,fixture.elements),view.name+' / '+node.id)
  for(const rel of view.edges){
   const src=fixture.elements[view.nodes.find(n=>n.id===rel.source).elementId]
   const dst=fixture.elements[view.nodes.find(n=>n.id===rel.target).elementId]
   assert.ok(uml.umlRelationEndpointValid(view.type,rel.relationKind,src.type,dst.type),view.name+' / '+rel.relationKind)
   assert.equal(umlNotation.validUmlEdgeNotation(view.type,rel),true)
  }
 }
})

// NOVZI QA UML actividades — controles y formas nativas 14/11/2026.
test('UML actividades ofrece catálogo integral, dos flujos y relaciones auxiliares',()=>{
 assert.deepEqual([...uml.UML_ELEMENTS_BY_DIAGRAM['uml-activity']],['uml-start','uml-action','uml-decision','uml-fork','uml-end','uml-flow-final','uml-object-node','uml-partition','uml-activity-pin','uml-activity-parameter','uml-activity-interruptible-region','uml-comment','uml-constraint'])
 assert.deepEqual([...uml.UML_RELATIONS_BY_DIAGRAM['uml-activity']],['control-flow','object-flow','exception-handler','annotation'])
 assert.equal(uml.umlElementCreatable('uml-activity','uml-signal'),false)
 assert.equal(uml.umlElementAllowed('uml-activity','uml-signal'),true)
 for(const t of ['fork','join','exception']){
  assert.equal(uml.umlRelationCreatable('uml-activity',t),false)
  assert.equal(uml.umlRelationAllowed('uml-activity',t),true)
 }
})
test('UML actividades: no se pueden conectar particiones o salir de un final',()=>{
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-start','uml-action'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-action','uml-decision'),true)
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-object-node','uml-action'),true) // tipo potencialmente compatible; isControlType se valida en política
 assert.equal(uml.umlRelationEndpointValid('uml-activity','object-flow','uml-object-node','uml-action'),false) // datos requieren pin
 assert.equal(uml.umlRelationEndpointValid('uml-activity','object-flow','uml-action','uml-action'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-end','uml-action'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-flow-final','uml-action'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-action','uml-start'),false)
 assert.equal(uml.umlRelationEndpointValid('uml-activity','control-flow','uml-partition','uml-action'),false)
})
test('UML actividades: particiones encapsulan nodos, mantienen tamaño e identidad por vista',()=>{
 assert.equal(umlContainers.umlContainerAllows('uml-activity','uml-partition','uml-action'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-activity','uml-partition','uml-decision'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-activity','uml-partition','uml-object-node'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-activity','uml-action','uml-partition'),false)
 assert.equal(sizing.novziNodeSize('uml-activity',e('p','uml-partition')).width>=500,true)
 assert.equal(sizing.novziNodeSize('uml-activity',e('d','uml-decision')).width,sizing.novziNodeSize('uml-activity',e('d','uml-decision')).height)
})
test('UML perfiles no ofrece Modelo UML nuevo, pero continúa leyendo proyectos antiguos',()=>{
 assert.equal(uml.umlElementCreatable('uml-profile','uml-model'),false)
 assert.equal(uml.umlElementAllowed('uml-profile','uml-model'),true)
 assert.equal(uml.umlElementCreatable('uml-profile','uml-metaclass'),true)
})
test('Despliegue muestra nombre del grupo dependencia/despliegue/manifestación sin fusionar semántica',()=>{
 assert.match(uml.umlRelationLabel('deployment'),/Dependencia \/ Despliegue \/ Manifestación/)
 assert.match(uml.umlRelationLabel('manifestation'),/Dependencia \/ Despliegue \/ Manifestación/)
 assert.equal(umlNotation.umlRelationNotation('deployment').label,'«deploy»')
 assert.equal(umlNotation.umlRelationNotation('manifestation').label,'«manifest»')
})
test('UML actividades: las figuras son el nodo, sin tarjeta genérica ni rombo decorativo',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const nodeView=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({}, {get:()=>Stub}),
  '@xyflow/react':{Handle:({id})=>React.createElement('i',{'data-port':id}),NodeResizer:Stub,Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-activity':'Actividades'},elementLabels:{'uml-action':'Acción'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const render=type=>renderToStaticMarkup(React.createElement(nodeView.NovziNode,{id:'n-'+type,data:{element:e(type,type,'Prueba'),mode:'mixed',graphType:'uml-activity'},selected:false}))
 const expected=[['uml-decision','uml-decision-shape'],['uml-fork','uml-fork-symbol'],['uml-action','uml-action-label'],['uml-object-node','uml-object-node-label'],['uml-flow-final','uml-control-glyph'],['uml-partition','uml-partition-heading'],['uml-start','uml-control-glyph'],['uml-end','uml-control-glyph']]
 for(const [kind,css] of expected){const out=render(kind);assert.match(out,new RegExp(css),`${kind} debe contener ${css}`);assert.doesNotMatch(out,/class="node-top"/,`${kind} no debe heredar cabecera genérica`)}
 assert.match(render('uml-decision'),/polygon points="42,2 82,42 42,82 2,42"/)
 assert.match(render('uml-flow-final'),/M18 18L42 42M42 18L18 42/)
 assert.match(fs.readFileSync(path.join(root,'apps/web/src/styles.css'),'utf8'),/\.uml-diagram-uml-activity\.uml-decision-card/)
})
test('JSON QA UML actividades: válido con objetos, carriles y final de flujo',()=>{
 const v=JSON.parse(fs.readFileSync(path.join(root,'NOVZI_QA_UML_Actividades_20261114.json'),'utf8')).document
 assert.equal(contract.isProjectDocument(v),true)
 policy.ensureUniqueIds(v)
 assert.equal(v.diagrams[0].nodes.length,14)
 assert.equal(v.diagrams[0].edges.length,12)
 const partitionIds=new Set(v.diagrams[0].nodes.filter(n=>v.elements[n.elementId].type==='uml-partition').map(n=>n.id))
 assert.equal(partitionIds.size,2)
 assert.ok(v.diagrams[0].nodes.filter(n=>n.parentNodeId).every(n=>partitionIds.has(n.parentNodeId)))
})

test('UML actividades: decisiones, inicio y finales muestran exactamente cuatro puntos cardinales',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({},{get:()=>Stub}),
  '@xyflow/react':{
   Handle:({id,position,style})=>React.createElement('span',{'data-port':id,'data-side':position,'data-offset':style?.top||style?.bottom||style?.left||style?.right||''}),
   Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'},NodeResizer:Stub
  },
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-activity':'Actividades'},elementLabels:{'uml-start':'Inicial','uml-end':'Final','uml-flow-final':'Fin de flujo','uml-decision':'Decisión'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const seen=(type)=>renderToStaticMarkup(React.createElement(novzi.NovziNode,{id:'n-'+type,data:{element:e('n',type),mode:'mixed',graphType:'uml-activity'},selected:false}))
 for(const type of ['uml-start','uml-end','uml-flow-final','uml-decision']){
  const html=seen(type)
  assert.equal((html.match(/data-port=/g)||[]).length,4,type)
  for(const port of ['left','right','top-2','bottom-2'])assert.match(html,new RegExp(`data-port="${port}"`))
  assert.doesNotMatch(html,/data-port="top-[13]"|data-port="bottom-[13]"/)
  if(type==='uml-decision')assert.match(html,/data-offset="2.4%"/)
  else assert.match(html,/data-offset="6%"/)
 }
})

test('UML actividades: control symbols no muestran tarjeta y pintan solamente geometría SVG',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({},{get:()=>Stub}),
  '@xyflow/react':{Handle:({id})=>React.createElement('span',{'data-port':id}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'},NodeResizer:Stub},
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-activity':'Actividades'},elementLabels:{},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const view=type=>renderToStaticMarkup(React.createElement(novzi.NovziNode,{id:'qa-'+type,data:{element:e('n',type),mode:'mixed',graphType:'uml-activity'},selected:false}))
 for(const type of ['uml-start','uml-end','uml-flow-final','uml-decision','uml-fork']){
  const html=view(type)
  assert.match(html,/class="novzi-uml-control/,type)
  assert.doesNotMatch(html,/class="novzi-node/,type)
  assert.equal((html.match(/<svg /g)||[]).length,1,type)
  assert.doesNotMatch(html,/class="node-top"|node-title|node-summary/,type)
 }
 assert.match(view('uml-decision'),/points="42,2 82,42 42,82 2,42"/)
 assert.equal((view('uml-decision').match(/<polygon /g)||[]).length,1,'No extra decorative diamond')
 assert.match(view('uml-start'),/<circle cx="30" cy="30" r="27" fill="#344965"/)
 assert.equal((view('uml-end').match(/<circle /g)||[]).length,2)
 assert.match(view('uml-flow-final'),/<path d="M18 18L42 42M42 18L18 42"/)
 assert.equal((view('uml-fork').match(/<rect /g)||[]).length,1)
 const css=fs.readFileSync(path.join(root,'apps/web/src/styles.css'),'utf8')
 assert.match(css,/\.react-flow__node-novzi>\.novzi-uml-control/)
 assert.match(css,/background:transparent!important/)
})

test('UML actividades: barra de bifurcación mantiene tres puntos arriba y abajo, uno por lateral',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({},{get:()=>Stub}),
  '@xyflow/react':{Handle:({id,position,style})=>React.createElement('span',{'data-port':id,'data-side':position,'data-offset':style?.top||style?.bottom||''}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'},NodeResizer:Stub},
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-activity':'Actividades'},elementLabels:{'uml-fork':'Bifurcación'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=renderToStaticMarkup(React.createElement(novzi.NovziNode,{id:'fork',data:{element:e('fork','uml-fork'),mode:'mixed',graphType:'uml-activity'},selected:false}))
 assert.equal((html.match(/data-port=/g)||[]).length,8)
 for(const port of ['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'])assert.match(html,new RegExp(`data-port="${port}"`))
 assert.equal((html.match(/data-offset="29%"/g)||[]).length,6)
})

test('UML actividades: las conexiones históricas se alinean al único puerto sin reescribir el archivo',()=>{
 const hook=load('apps/web/src/features/editor/hooks/useGraphView.ts',{
  '../domain/graph-selection':{graphSelection:d=>({nodeIds:d.nodes.map(n=>n.id),edgeIds:d.edges.map(e=>e.id)})},
  '../domain/parallel-edges':parallel,
  'react':{useMemo:cb=>cb()},
  '@xyflow/react':{MarkerType:{ArrowClosed:'arrowclosed'}},
  '@novzi/contracts':{...classPolicy,...umlNotation,...umlContainers,...sizing}
 })
 const v={...doc(),elements:{start:e('start','uml-start'),decision:e('decision','uml-decision'),fork:e('fork','uml-fork')},diagrams:[d('act','uml-activity',[node('ns','start'),node('nd','decision'),node('nf','fork')],[
  edge('historica','ns','nd',{sourceHandle:'top-1',targetHandle:'bottom-3',relationKind:'control-flow'}),
  edge('barra','nf','nd',{sourceHandle:'top-3',targetHandle:'top-1',relationKind:'control-flow'})]) ]}
 const result=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true})
 assert.equal(result.edges[0].sourceHandle,'top-2')
 assert.equal(result.edges[0].targetHandle,'bottom-2')
 assert.equal(result.edges[1].sourceHandle,'top-3')
 assert.equal(result.edges[1].targetHandle,'top-2')
 assert.equal(v.diagrams[0].edges[0].sourceHandle,'top-1')
 assert.equal(v.diagrams[0].edges[0].targetHandle,'bottom-3')
})

test('Secuencia: un solo participante nuevo; se mantienen actores históricos y fragmentos combinados',()=>{
 assert.equal(uml.umlElementCreatable('uml-sequence','uml-lifeline'),true)
 assert.equal(uml.umlElementCreatable('uml-sequence','actor'),false)
 assert.equal(uml.umlElementAllowed('uml-sequence','actor'),true)
 assert.equal(uml.umlElementCreatable('uml-sequence','uml-frame'),true)
 assert.equal(uml.umlElementCreatable('uml-sequence','uml-interaction'),true)
 assert.equal(uml.umlElementCreatable('uml-sequence','uml-message'),false)
 assert.equal(umlContainers.umlContainerAllows('uml-sequence','uml-lifeline','uml-activation'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-sequence','uml-lifeline','uml-destruction'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-sequence','uml-activation','uml-destruction'),true)
 assert.equal(umlContainers.umlContainerAllows('uml-sequence','uml-activation','uml-activation'),false)
 assert.equal(umlContainers.umlContainerAllows('uml-sequence','uml-frame','uml-activation'),false)
})
test('Secuencia: activación centrada en línea de vida y destrucción encajada al final de participante/activación',()=>{
 assert.equal(sequenceLayout.sequenceIsParticipant('uml-lifeline'),true)
 assert.equal(sequenceLayout.sequenceIsAttachment('uml-destruction'),true)
 const activation=sequenceLayout.sequenceSnapChild('uml-lifeline','uml-activation',{width:170,height:320},{width:48,height:120},99)
 assert.equal(activation.x,61)
 assert.equal(activation.y,99)
 assert.deepEqual({...sequenceLayout.sequenceSnapChild('uml-lifeline','uml-destruction',{width:170,height:320},{width:48,height:48},13)}, {x:61,y:296})
 assert.deepEqual({...sequenceLayout.sequenceSnapChild('uml-activation','uml-destruction',{width:48,height:120},{width:48,height:48},32)}, {x:0,y:96})
 assert.throws(()=>sequenceLayout.sequenceSnapChild('uml-lifeline','uml-activation',{width:170,height:150},{width:48,height:120},80),/demasiado corta/)
})
test('Secuencia: contención persistida y desplazamiento se ajustan sin alterar fichas compartidas',()=>{
 const v={...doc(),elements:{participant:e('participant','uml-lifeline'),activation:e('activation','uml-activation'),end:e('end','uml-destruction')},diagrams:[d('seq','uml-sequence',[{id:'p',elementId:'participant',x:100,y:100,width:170,height:320},{id:'a',elementId:'activation',x:161,y:210},{id:'x',elementId:'end',x:161,y:340}],[])]}
 let out=commands.setNodePackage(v,'seq','a','p')
 out=commands.setNodePackage(out,'seq','x','a')
 assert.equal(out.diagrams[0].nodes.find(n=>n.id==='a').parentNodeId,'p')
 assert.equal(out.diagrams[0].nodes.find(n=>n.id==='a').x,61)
 assert.equal(out.diagrams[0].nodes.find(n=>n.id==='x').parentNodeId,'a')
 assert.equal(out.diagrams[0].nodes.find(n=>n.id==='x').y,96)
 out=commands.moveNode(out,'seq','a',95,130)
 assert.equal(out.diagrams[0].nodes.find(n=>n.id==='a').x,61)
 assert.equal(out.diagrams[0].nodes.find(n=>n.id==='a').y,130)
 out=commands.moveNode(out,'seq','p',250,200)
 assert.deepEqual([out.diagrams[0].nodes.find(n=>n.id==='a').x,out.diagrams[0].nodes.find(n=>n.id==='x').y],[61,96])
 policy.ensureUniqueIds(out)
 assert.equal(contract.isProjectDocument(out),true)
})
test('Selección por área: movimiento de múltiples nodos en un commit, sin mover dos veces al hijo seleccionado',()=>{
 const v={...doc(),elements:{p:e('p','uml-lifeline'),a:e('a','uml-activation'),b:e('b','uml-lifeline')},diagrams:[d('seq','uml-sequence',[{id:'p',elementId:'p',x:100,y:100,width:170,height:300},{id:'a',elementId:'a',x:61,y:75,parentNodeId:'p'},{id:'b',elementId:'b',x:400,y:100}],[])]}
 const result=commands.moveDiagramSelection(v,'seq',[{id:'p',x:200,y:140},{id:'a',x:161,y:115},{id:'b',x:475,y:170}])
 assert.equal(result.diagrams[0].nodes.find(n=>n.id==='p').x,200)
 assert.equal(result.diagrams[0].nodes.find(n=>n.id==='b').x,475)
 assert.equal(result.diagrams[0].nodes.find(n=>n.id==='a').x,61)
 assert.equal(result.diagrams[0].nodes.find(n=>n.id==='a').y,75)
 assert.equal(v.diagrams[0].nodes[0].x,100)
 policy.ensureUniqueIds(result)
})
test('Selección por área: borrar parcialmente un grupo limpia aristas y desacopla hijos sin borrar catálogo',()=>{
 const v={...doc(),elements:{p:e('p','uml-lifeline'),a:e('a','uml-activation'),b:e('b','uml-lifeline')},diagrams:[d('seq','uml-sequence',[{id:'p',elementId:'p',x:100,y:100,width:170,height:300},{id:'a',elementId:'a',x:61,y:75,parentNodeId:'p'},{id:'b',elementId:'b',x:400,y:100}],[edge('one','p','b',{relationKind:'message'}),edge('two','a','b',{relationKind:'reply'})])]}
 const out=commands.removeDiagramSelection(v,'seq',['p'],[])
 assert.deepEqual(out.diagrams[0].nodes.map(n=>n.id),['a','b'])
 const child=out.diagrams[0].nodes.find(n=>n.id==='a')
 assert.equal(child.parentNodeId,undefined)
 assert.deepEqual([child.x,child.y],[161,175])
 assert.equal(out.diagrams[0].edges.length,1)
 assert.equal(out.diagrams[0].edges[0].id,'two')
 assert.ok(out.elements.p)
 const clean=commands.removeDiagramSelection(out,'seq',['a'],['two'])
 assert.equal(clean.diagrams[0].nodes.length,1)
 assert.equal(clean.diagrams[0].edges.length,0)
 policy.ensureUniqueIds(clean)
})
test('Render UML de secuencia: fragmento combinado contiene operandos; activación y destrucción son símbolos',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const Stub=()=>React.createElement('i')
 const novzi=load('apps/web/src/components/organisms/NovziNode.tsx',{
  'lucide-react':new Proxy({},{get:()=>Stub}),
  '@xyflow/react':{Handle:({id})=>React.createElement('span',{'data-port':id}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'},NodeResizer:Stub},
  '@novzi/contracts':{...classPolicy,diagramLabels:{'uml-sequence':'Secuencia'},elementLabels:{'uml-frame':'Fragmento'},umlAttributeText:umlStructure.umlAttributeText,umlOperationText:umlStructure.umlOperationText,umlOperationTextResolved:umlStructure.umlOperationTextResolved,umlObjectTitle:umlStructure.umlObjectTitle,novziNodeMinimum:sizing.novziNodeMinimum,sequenceActivationPorts:sequencePorts.sequenceActivationPorts},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const make=(type,summary,uml)=>renderToStaticMarkup(React.createElement(novzi.NovziNode,{id:type,data:{element:{...e('x',type),summary,uml},mode:'technical',graphType:'uml-sequence'},selected:false}))
 const combined=make('uml-frame','[válido]\n[inválido]',{classifier:'alt'})
 assert.match(combined,/uml-combined-fragment/)
 assert.match(combined,/\[válido\]/)
 assert.match(combined,/\[inválido\]/)
 assert.match(combined,/uml-interaction-frame-tag">alt/)
 const activation=make('uml-activation','')
 assert.match(activation,/uml-sequence-activation-bar/)
 assert.doesNotMatch(activation,/class="node-top"/)
 const destruction=make('uml-destruction','')
 assert.match(destruction,/uml-sequence-destruction-mark/)
 assert.equal((destruction.match(/<svg/g)||[]).length,1)
})


test('UML secuencia: los anclajes de activación crecen con la altura y nunca aparecen arriba o abajo',()=>{
 const short=sequencePorts.sequenceActivationPorts(120)
 const long=sequencePorts.sequenceActivationPorts(420)
 assert.ok(short.length>=8)
 assert.ok(long.length>short.length)
 assert.ok(short.every(p=>['left','right'].includes(p.side)))
 assert.ok(short.every(p=>p.topPercent>0&&p.topPercent<100&&p.topPercent!==50))
 assert.ok(short.every(p=>sequencePorts.sequenceActivationHandleValid(p.id)))
 assert.equal(sequencePorts.sequenceActivationHandleValid('top-2'),true) // legacy only
 assert.equal(sequencePorts.sequenceActivationHandleValid('seq-top-1'),false)
 assert.equal(sequencePorts.sequenceRenderedHandle('top-2','source'),'right')
 assert.equal(sequencePorts.sequenceRenderedHandle('bottom-2','target'),'left')
 assert.equal(sequencePorts.sequenceNearestPort(420,'right',210).side,'right')
 assert.ok(Math.abs(sequencePorts.sequenceNearestPort(420,'right',210).topPercent-50)<6)
})

test('UML secuencia: dos ejecuciones aceptan múltiples mensajes independientes de ida y vuelta',()=>{
 const v={...doc(),elements:{p1:e('p1','uml-lifeline'),p2:e('p2','uml-lifeline'),a1:e('a1','uml-activation'),a2:e('a2','uml-activation')},
  diagrams:[d('seq','uml-sequence',[
   {id:'p1n',elementId:'p1',x:100,y:100,width:170,height:520},
   {id:'p2n',elementId:'p2',x:480,y:100,width:170,height:520},
   {id:'a1n',elementId:'a1',x:61,y:80,parentNodeId:'p1n',width:48,height:380},
   {id:'a2n',elementId:'a2',x:61,y:80,parentNodeId:'p2n',width:48,height:380},
  ],[])]}
 const ports=sequencePorts.sequenceActivationPorts(380)
 const right=ports.filter(p=>p.side==='right').map(p=>p.id)
 const left=ports.filter(p=>p.side==='left').map(p=>p.id)
 let next=v
 for(let i=0;i<8;i++)next=commands.connectNodes(next,'seq',{
  id:`msg-${i}`,source:i%2===0?'a1n':'a2n',target:i%2===0?'a2n':'a1n',
  sourceHandle:i%2===0?right[i]:left[i],targetHandle:i%2===0?left[i]:right[i],
  label:`mensaje-${i}`,relationKind:i%2===0?'message':'reply'
 })
 assert.equal(next.diagrams[0].edges.length,8)
 assert.equal(new Set(next.diagrams[0].edges.map(edge=>edge.id)).size,8)
 assert.equal(uml.umlRelationEndpointValid('uml-sequence','message','uml-activation','uml-activation'),true)
 policy.ensureUniqueIds(next)
 assert.equal(contract.isProjectDocument(next),true)
})
test('La API sólo admite los puertos múltiples de secuencia en barras de activación',()=>{
 const v=doc()
 v.diagrams[0].edges=[edge('r1','na','nb',{sourceHandle:'seq-right-3'})]
 assert.throws(()=>policy.ensureUniqueIds(v),/Puerto de salida inválido/)
 const seq={...doc(),elements:{p:e('p','uml-lifeline'),a:e('a','uml-activation'),q:e('q','uml-lifeline')},
  diagrams:[d('umlseq','uml-sequence',[
   {id:'p',elementId:'p',x:100,y:50,width:170,height:420},
   {id:'a',elementId:'a',x:61,y:80,parentNodeId:'p',width:48,height:260},
   {id:'q',elementId:'q',x:410,y:50,width:170,height:420}
  ],[edge('m','a','q',{relationKind:'message',sourceHandle:'seq-right-5',targetHandle:'left'})])]
 }
 policy.ensureUniqueIds(seq)
 seq.diagrams[0].edges[0].sourceHandle='seq-top-1'
 assert.throws(()=>policy.ensureUniqueIds(seq),/Puerto de salida inválido/)
})
