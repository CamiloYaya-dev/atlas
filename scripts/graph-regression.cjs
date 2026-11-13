/** Regression test without esbuild/Rollup native binaries: exercises real TS source through tsc transpilation. */
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');const ts=require('typescript');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
function load(rel,stubs={}){
 const filename=path.join(root,rel);
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 const sandbox={module,exports:module.exports,require:(id)=>{
  if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];
  if(id.startsWith('node:'))return require(id);
  throw Error(`Unexpected require ${id} in ${rel}`);
 },console,crypto:global.crypto,structuredClone:global.structuredClone};
 vm.runInNewContext(code,sandbox,{filename,timeout:5000});return module.exports;
}
const commands=load('apps/web/src/features/editor/domain/document-commands.ts');
const parallel=load('apps/web/src/features/editor/domain/parallel-edges.ts');
const progress=load('apps/web/src/features/academy/progress.ts');
const exportFields=load('packages/contracts/src/export-fields.ts');
const contract=load('packages/contracts/src/index.ts',{'./permissions':{},'./collaboration':{},'./export-fields':exportFields});
const roles={allowed:()=>true,requirePermission:()=>{}};
class DomainError extends Error{constructor(message,status){super(message);this.statusCode=status}}
const policy=load('apps/api/src/modules/projects/application/document-policy.ts',{'@atlas/contracts':{relationScope:()=> 'mixed'},'../../../security/roles':roles,'../../../domain/errors':{DomainError}});
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
 const atlas=load('apps/web/src/components/organisms/AtlasNode.tsx',{
  'lucide-react':icons,
  '@xyflow/react':{Handle:({id,type,position})=>React.createElement('span',{'data-port':id,'data-kind':type,'data-side':position}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '../../types':{diagramLabels:{c2:'C2'},elementLabels:{container:'Contenedor'}},
  'react/jsx-runtime':require('react/jsx-runtime')
 });
 const html=renderToStaticMarkup(React.createElement(atlas.AtlasNode,{data:{element:e('a','container'),mode:'mixed',graphType:'c2'},selected:false}));
 for(const id of ['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'])assert.match(html,new RegExp(`data-port="${id}"`));
 assert.equal((html.match(/data-port=/g)||[]).length,8)
});
test('el render de relaciones muestra ambas flechas y respeta el trazo',()=>{
 const hook=load('apps/web/src/features/editor/hooks/useGraphView.ts',{
  '../domain/graph-selection':{graphSelection:d=>({nodeIds:d.nodes.map(n=>n.id),edgeIds:d.edges.map(e=>e.id)})},
  '../domain/parallel-edges':parallel,
  'react':{useMemo:cb=>cb()},
  '@xyflow/react':{MarkerType:{ArrowClosed:'arrowclosed'}}
 });
 const v=doc();v.diagrams[0].edges[0]={...v.diagrams[0].edges[0],direction:'both',lineStyle:'dashed',pathStyle:'bezier',sourceHandle:'top-2',targetHandle:'bottom-1'};
 const graph=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true});
 const rel=graph.edges[0];assert.equal(rel.type,'bezier');assert.equal(rel.markerEnd.type,'arrowclosed');assert.equal(rel.markerStart.type,'arrowclosed');assert.equal(rel.style.strokeDasharray,'7 5');assert.equal(rel.sourceHandle,'top-2');assert.equal(rel.targetHandle,'bottom-1');
 const old=graph.edges[1];assert.equal(old.sourceHandle,'right');assert.equal(old.targetHandle,'left');assert.ok(old.markerEnd);assert.equal(old.markerStart,undefined)
});
test('el backend exige relation.delete antes de permitir borrar una relación',()=>{
 const guarded=load('apps/api/src/modules/projects/application/document-policy.ts',{
  '@atlas/contracts':{relationScope:()=> 'mixed'},
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
  '@atlas/contracts':{relationScope:()=> 'mixed'},
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
  '@xyflow/react':{MarkerType:{ArrowClosed:'arrowclosed'}}
 })
 const v=doc()
 v.diagrams[0].edges.push(edge('r3','na','nb',{sourceHandle:'top-1',targetHandle:'bottom-1'}))
 v.diagrams[0].edges.push(edge('r4','na','nb',{sourceHandle:'right',targetHandle:'left',pathStyle:'bezier'}))
 const view=hook.useGraphView({diagram:v.diagrams[0],doc:v,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true})
 assert.equal(view.edges.filter(e=>e.type==='atlas-parallel').length,3)
 assert.equal(new Set(view.edges.filter(e=>e.type==='atlas-parallel').map(e=>e.data.parallelOffset)).size,3)
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
 const edgeComponent=load('apps/web/src/components/organisms/AtlasParallelEdge.tsx',{
  '@xyflow/react':{
   BaseEdge:({path,interactionWidth})=>React.createElement('path',{'data-path':path,'data-hit':interactionWidth}),
   EdgeLabelRenderer:({children})=>React.createElement('span',{'data-edge-label':true},children)
  },
  '../../features/editor/domain/parallel-edges':parallel,
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=renderToStaticMarkup(React.createElement(edgeComponent.AtlasParallelEdge,{
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
 const atlas=load('apps/web/src/components/organisms/AtlasNode.tsx',{
  'lucide-react':new Proxy({}, {get:()=>Stub}),
  '@xyflow/react':{Handle:({id,type})=>React.createElement('span',{'data-port':id,'data-direction':type}),Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'}},
  '../../types':{diagramLabels:{c2:'C2 · Contenedores'},elementLabels:{container:'Contenedor'}},
  'react/jsx-runtime':require('react/jsx-runtime')
 })
 const html=renderToStaticMarkup(React.createElement(atlas.AtlasNode,{data:{element:e('a','container'),mode:'mixed',graphType:'c2'},selected:false}))
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
