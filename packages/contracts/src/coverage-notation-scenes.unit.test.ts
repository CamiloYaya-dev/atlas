import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createElement} from './index'
import type {ProjectDocument,DiagramEdge} from './index'
import {assemblyAnchor,componentAssemblyDirection,componentGlyph,componentHandle,componentSvgScene} from './uml-component-geometry'
import {deploymentEndpointValid} from './uml-deployment-catalog'
import {componentEndpointValid} from './uml-component-catalog'
import {classPort,classFacingPort,classRelationRoute,classEndTerminal,classEndLabel,classTemplateFormalText,useCaseEllipseIntersection,useCasePort} from './uml-class-geometry'
import {deploymentFacingPort,deploymentGlyph,deploymentPort,deploymentSvgScene} from './uml-deployment-geometry'
const fixture=(name:string):ProjectDocument=>JSON.parse(readFileSync(new URL(`../../../qa/ATLAS_QA_UML_${name}.json`,import.meta.url),'utf8'))
const r={x:0,y:0,width:200,height:100}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)

test('Ensamblaje: ruta recta larga prioriza tramo estable, curvas mantienen punto y tangente',()=>{
 assert.deepEqual(assemblyAnchor('M 0 0 L 20 0 L 20 120'),{x:20,y:60,angle:90})
 assert.deepEqual(assemblyAnchor('M 0 0 L 20 0 L 20 40'),{x:20,y:10,angle:90})
 const q=assemblyAnchor('M 0 0 Q 50 50 100 0');close(q.x,50);close(q.y,25);assert.ok(Math.abs(q.angle)<3)
 const c=assemblyAnchor('M 0 0 C 25 0 75 0 100 0');close(c.x,50);close(c.y,0);close(c.angle,0)
 assert.deepEqual(assemblyAnchor('M -1e2 20'),{x:-100,y:20,angle:0});assert.deepEqual(assemblyAnchor('M 4 5 L 4 5'),{x:4,y:5,angle:0});assert.deepEqual(assemblyAnchor(''),{x:0,y:0,angle:0})
 assert.throws(()=>assemblyAnchor('M 0'),/Ruta SVG inválida/);assert.throws(()=>assemblyAnchor('M 0 0 L 10'),/Ruta SVG inválida/);assert.throws(()=>assemblyAnchor('M 0 0 q 10 10 20 20'),/no soportado/)
})
test('Componente: proyección de contratos e inversión visual conservan símbolo y puertos',()=>{
 const d=fixture('COMPONENTES'),v=d.diagrams[0],wire=v.edges.find(e=>e.id==='wire')!,before=structuredClone(d)
 const direction=componentAssemblyDirection(d,v,wire);assert.ok(direction);assert.equal(componentAssemblyDirection(d,v,{...wire,source:wire.target,target:wire.source}),direction==='forward'?'reverse':'forward')
 assert.equal(componentAssemblyDirection(d,v,{...wire,relationKind:'dependency'}),undefined);assert.equal(componentAssemblyDirection(d,v,{...wire,target:'missing'}),undefined);assert.equal(componentAssemblyDirection(d,v,{...wire,componentEnds:[{id:'a',nodeId:wire.source},{id:'b',nodeId:wire.target},{id:'c',nodeId:'other-port'}]}),undefined)
 for(const [handle,expected] of [['top-1','top-2'],['top-3','top-2'],['bottom-1','bottom-2'],['left','left']] as const){assert.equal(componentHandle(handle,true),expected);assert.equal(componentHandle(handle,false),handle)}assert.equal(componentHandle(undefined,true),undefined)
 const scene=componentSvgScene(d,v);assert.ok(scene.width>0&&scene.height>0);assert.match(scene.markup,/«component»/);assert.match(scene.markup,/IPago/);assert.doesNotMatch(scene.markup,/NaN|Infinity/);assert.deepEqual(d,before)
})
test('Componente: glifos de paquetes, notas, roles, atributos y archivo conservan notación y escapan texto',()=>{
 const d=fixture('COMPONENTES'),names=Object.fromEntries(Object.values(d.elements).map(e=>[e.id,e.name])),size={width:380,height:340}
 for(const [id,tag] of [['web','«component»'],['ipay','«interface»'],['artifact','«artifact»'],['web-port','Port'],['api-role','Part'],['cache-role','Reference Role'],['pkg','Package']] as const)assert.match(componentGlyph(d.elements[id],size,names,false),new RegExp(tag))
 assert.match(componentGlyph(d.elements['cache-role'],size,names,false),/stroke-dasharray="6 4"/)
 assert.match(componentGlyph(d.elements.web,size,names,true),/internal structure/)
 const cls={...d.elements.impl,uml:{abstract:true,attributes:[{id:'x',name:'saldo',type:'Integer',visibility:'private' as const}],operations:[{id:'o',name:'calcular',visibility:'public' as const,returnType:'void',parameters:[]}]}}
 const glyph=componentGlyph(cls,size,names,false);assert.match(glyph,/saldo/);assert.match(glyph,/calcular/);assert.match(glyph,/font-style="italic"/);assert.doesNotMatch(componentGlyph(cls,{width:200,height:45},names,false),/saldo|calcular/)
 const note={...d.elements.note,name:'Nota',uml:{note:'<b> & "dato"'}};assert.match(componentGlyph(note,size,names,false),/&lt;b&gt; &amp; &quot;dato&quot;/);assert.match(componentGlyph({...d.elements.constraint,uml:{expression:'x < 5'}},size,names,false),/\{x &lt; 5\}/)
 assert.match(componentGlyph({...d.elements.artifact,uml:{component:{kind:'artifact',fileName:'archivo.jar'}}},size,names,false),/archivo.jar/)
 const long=componentGlyph({...d.elements.web,name:'Nombre extraordinariamente largo'},{width:100,height:100},names,false);assert.match(long,/…/)
})
test('Terminales UML: composición en el todo, navegabilidad explícita, contención y herencia',()=>{
 const cases:[Partial<DiagramEdge>,'source'|'target',string][]=[[{relationKind:'containment'},'source','ownership'],[{relationKind:'containment'},'target','none'],[{relationKind:'composition',wholeEnd:'target'},'target','diamond-filled'],[{relationKind:'composition',wholeEnd:'target'},'source','none'],[{relationKind:'aggregation'},'source','diamond-open'],[{relationKind:'association',targetNavigability:'navigable'},'target','open-arrow'],[{relationKind:'communication-path',sourceNavigability:'non-navigable'},'source','cross'],[{relationKind:'association',targetNavigability:'unspecified'},'target','none'],[{relationKind:'generalization'},'target','triangle']]
 for(const [edge,side,expected] of cases)assert.equal(classEndTerminal(edge,side),expected,JSON.stringify(edge))
 assert.deepEqual(classPort(r,undefined,true),{x:200,y:50,side:'right'});assert.deepEqual(classPort(r,undefined,false),{x:0,y:50,side:'left'});assert.deepEqual(classPort(r,'bottom-3',false),{x:160,y:100,side:'bottom'});assert.deepEqual(classFacingPort(r,{x:-50,y:50}),{x:0,y:50,side:'left'});assert.deepEqual(classFacingPort(r,{x:100,y:200}),{x:100,y:100,side:'bottom'})
 const loop=classRelationRoute({sourceX:0,sourceY:0,targetX:0,targetY:0,offset:-20,pathStyle:'straight'},true);assert.match(loop.path,/^M 0 0 C/);assert.ok(loop.labelY<0);assert.deepEqual(classEndLabel({x:10,y:20},'bottom'),{x:30,y:35});assert.equal(classTemplateFormalText({id:'t',name:'T',typeId:'gone',constraint:'x'}),'T: Tipo no disponible {x}')
})
test('Despliegue: puertos de silueta, glifo sin clasificador y rutas n-arias no generan coordenadas inválidas',()=>{
 const d=fixture('DESPLIEGUE'),v=d.diagrams[0],size={width:360,height:300}
 assert.deepEqual(deploymentFacingPort(r,true,{x:-50,y:50}),{x:1,y:50,side:'left'});assert.deepEqual(deploymentFacingPort(r,true,{x:100,y:200}),{x:100,y:99,side:'bottom'});assert.equal(deploymentPort({x:0,y:0,width:40,height:50},true,'top-1',true).y,12-7*11/12)
 const missing={...d.elements['host-instance'],uml:{deployment:{kind:'instance' as const,classifierIds:['missing']}}};assert.match(deploymentGlyph(d,missing,size,false),/Tipo no disponible/)
 assert.match(deploymentGlyph(d,{...d.elements.host,uml:{...d.elements.host.uml,leaf:true,deviceIcon:'server'}},size,false),/\{leaf\}/);assert.match(deploymentGlyph(d,{...d.elements.host,uml:{...d.elements.host.uml,deviceIcon:'server'}},size,false),/server/)
 assert.match(deploymentGlyph(d,{...d.elements.runtime,uml:{...d.elements.runtime.uml,runtimeIcon:'nodejs'}},size,false),/nodejs/)
 const s=deploymentSvgScene(d,v);assert.match(s.markup,/<polygon/);assert.match(s.markup,/stroke-dasharray/);assert.doesNotMatch(s.markup,/NaN|Infinity/)
})
test('Matrices de conexión no admiten tipos/categorías desconocidos ni invierten generalización de Device',()=>{
 assert.equal(deploymentEndpointValid('generalization','uml-device','uml-node'),true);assert.equal(deploymentEndpointValid('generalization','uml-node','uml-device'),false);assert.equal(deploymentEndpointValid('composition','uml-object','uml-object'),true);assert.equal(deploymentEndpointValid('containment','uml-node','uml-part'),true);assert.equal(deploymentEndpointValid('containment','uml-package','uml-comment'),false);assert.equal(deploymentEndpointValid('annotation','uml-comment','uml-device'),true);assert.equal(deploymentEndpointValid('other','uml-device','uml-node'),false);assert.equal(deploymentEndpointValid('dependency','actor','uml-node'),false)
 assert.equal(componentEndpointValid('annotation','uml-constraint','component'),true);assert.equal(componentEndpointValid('assembly','uml-part','uml-reference-role'),true);assert.equal(componentEndpointValid('containment','uml-class','uml-part'),true);assert.equal(componentEndpointValid('other','component','component'),false);assert.equal(componentEndpointValid('dependency','actor','component'),false)
 const actor=createElement('Actor','actor'),uc=createElement('Use case','usecase');assert.deepEqual(useCaseEllipseIntersection(r,{x:100,y:50}),{x:200,y:50});assert.equal(useCasePort(r,uc,'top-1',true).x,100);assert.deepEqual(useCasePort(r,{...actor,useCaseDetail:{presentation:'rectangle'}},'right',true),classPort(r,'right',true));assert.notEqual(useCasePort(r,actor,'right',true).x,200)
})
