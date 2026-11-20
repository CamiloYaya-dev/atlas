import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
const mode=process.argv.includes('--apply')?'apply':process.argv.includes('--check')?'check':null
if(!mode){console.error('Uso: node scripts/apply-edge-editor-v3.mjs --check|--apply');process.exit(2)}
const specs=[]
const replace=(s,a,b,file)=>{
 if(s.includes(b))return s
 if(s.split(a).length!==2)throw Error(`${file}: ancla ausente o duplicada: ${a.slice(0,75)}`)
 return s.replace(a,b)
}
const patch=(file,update)=>{
 const path=join(process.cwd(),file)
 if(!existsSync(path))throw Error(`Falta ${file}`)
 const before=readFileSync(path,'utf8'),after=update(before)
 specs.push({file,path,before,after})
}
const h='apps/web/src/features/editor/hooks/useGraphView.ts',e='apps/web/src/features/editor/NovziEditor.tsx',c='packages/contracts/src/index.ts'
patch(h,source=>{
 let s=source
 s=replace(s,"import type {ManualRoute} from '../domain/manual-edge-routing'", "import type {ManualRoute,ManualLabelPosition} from '../domain/manual-edge-routing'\nimport {editableRoute,enforcePortLegs,compatibleSharedRoute} from '../domain/manual-edge-routing'",h)
 s=replace(s,'onManualRouteCommit?:(edgeId:string,route:ManualRoute|undefined)=>void;focusRelations?', 'onManualRouteCommit?:(edgeId:string,route:ManualRoute|undefined)=>void;onLabelPositionCommit?:(edgeId:string,position:ManualLabelPosition|undefined)=>void;focusRelations?',h)
 s=replace(s,'routeEditorEdgeId,onManualRouteCommit,focusRelations=false','routeEditorEdgeId,onManualRouteCommit,onLabelPositionCommit,focusRelations=false',h)
 const peers=`   // Only compatible presentation types share a corridor; semantic edges remain separate.
   const routePeers=uml?[]:visibleEdges.filter(other=>other.id!==e.id&&
    compatibleSharedRoute(other,e)).flatMap(other=>{
     const fromBox=bounds(other.source),toBox=bounds(other.target)
     if(!fromBox||!toBox)return []
     const a=classPort(fromBox,other.sourceHandle||'right',true),b=classPort(toBox,other.targetHandle||'left',false)
     const dense=denseRoutePlan?.get(other.id)
     const stored=other.manualRoute||(dense?{version:1 as const,points:dense.points.slice(1,-1)}:undefined)
     return [{id:other.id,points:enforcePortLegs(editableRoute({x:a.x,y:a.y},{x:b.x,y:b.y},stored,a.side,b.side),a.side,b.side)}]
    })
`
 s=replace(s,'   const classData=',peers+'   const classData=',h)
 s=replace(s,'manualRoute:e.manualRoute,routeEditing:routeEditorEdgeId===e.id,routeCanEdit:canEdit,onRouteCommit:onManualRouteCommit','manualRoute:e.manualRoute,labelPosition:e.labelPosition,routePeers,routeEditing:routeEditorEdgeId===e.id,routeCanEdit:canEdit,onRouteCommit:onManualRouteCommit,onLabelCommit:onLabelPositionCommit',h)
 s=replace(s,'routeEditorEdgeId,onManualRouteCommit,focusRelations,focusedElementId])','routeEditorEdgeId,onManualRouteCommit,onLabelPositionCommit,focusRelations,focusedElementId])',h)
 return s
})
patch(e,source=>{
 let s=source
 s=replace(s,"import type {ManualRoute} from './domain/manual-edge-routing'", "import type {ManualRoute,ManualLabelPosition} from './domain/manual-edge-routing'",e)
 const callback=` const updateLabelPosition=useCallback((edgeId:string,position:ManualLabelPosition|undefined)=>{
  if(!diagram||!doc||isUmlDiagram(diagram.type))return
  const relation=diagram.edges.find(item=>item.id===edgeId)
  const source=diagram.nodes.find(n=>n.id===relation?.source),target=diagram.nodes.find(n=>n.id===relation?.target)
  const a=source&&doc.elements[source.elementId],b=target&&doc.elements[target.elementId]
  if(!relation||!a||!b||!can('relation.edit.'+relationScope(a.type,b.type)))return
  if(position&&(!Number.isFinite(position.x)||!Number.isFinite(position.y)||Math.abs(position.x)>1e6||Math.abs(position.y)>1e6))return
  if(JSON.stringify(relation.labelPosition)===JSON.stringify(position))return
  const currentId=diagram.id
  patch(old=>({...old,diagrams:old.diagrams.map(d=>d.id!==currentId?d:{...d,edges:d.edges.map(item=>{
   if(item.id!==edgeId)return item
   if(position)return {...item,labelPosition:position}
   const {labelPosition:_unused,...rest}=item;return rest
  })})}))
 },[diagram,doc,patch,projectPolicy])
`
 s=replace(s,' const filtered=useGraphView(',callback+' const filtered=useGraphView(',e)
 s=replace(s,'onManualRouteCommit:updateManualRoute,selectedNodeId:', 'onManualRouteCommit:updateManualRoute,onLabelPositionCommit:updateLabelPosition,selectedNodeId:',e)
 s=replace(s,"announce('Arrastra los controles azules de la línea; los puntos amarillos ajustan los giros. Los cambios se guardan al soltar.')", "announce('Arrastra tramos y giros; pulsa − para quitar, ⇥ para simplificar. Arrastra el nombre o protocolo libremente. Se guarda al soltar.')",e)
 return s
})
const d='apps/web/src/features/editor/domain/diagram-beautify.ts'
patch(d,source=>{
 let s=source
 s=replace(s,"if(!route?.points?.length||!newNodes.has(edge.source)||!newNodes.has(edge.target))return edge", "if(!route?.points?.length&&old?.labelPosition?.mode!=='manual'||!newNodes.has(edge.source)||!newNodes.has(edge.target))return edge",d)
 s=replace(s,'const points=route.points.map(p=>{','const points=route?.points.map(p=>{',d)
 s=replace(s,'return {...edge,manualRoute:{version:1 as const,points}}',"return {...edge,...(points?{manualRoute:{version:1 as const,points}}:{}),...(old?.labelPosition?.mode==='manual'?{labelPosition:{mode:'manual' as const,x:Math.round(old.labelPosition.x+(dxA+dxB)/2),y:Math.round(old.labelPosition.y+(dyA+dyB)/2)}}:{})}",d)
 return s
})
patch(c,source=>{
 let s=source
 s=replace(s,'manualRoute?: {version:1;points:{x:number;y:number}[]}; portsLocked?',"manualRoute?: {version:1;points:{x:number;y:number}[]}; labelPosition?:{mode:'manual';x:number;y:number}; portsLocked?",c)
 s=replace(s,'(a.manualRoute===undefined||validManualRouteField(a.manualRoute))&&(a.portsLocked', '(a.manualRoute===undefined||validManualRouteField(a.manualRoute))&&(a.labelPosition===undefined||validEdgeLabelPosition(a.labelPosition))&&(a.portsLocked',c)
 const validator=`/** User-positioned relation labels cannot contain NaN, Infinity or huge coordinates. */
export function validEdgeLabelPosition(value:unknown):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const p=value as Record<string,unknown>
 return p.mode==='manual'&&typeof p.x==='number'&&Number.isFinite(p.x)&&Math.abs(p.x)<=1e6&&typeof p.y==='number'&&Number.isFinite(p.y)&&Math.abs(p.y)<=1e6
}
`
 s=replace(s,'export function validManualRouteField(value:unknown):boolean {',validator+'export function validManualRouteField(value:unknown):boolean {',c)
 return s
})
// Payload is staged under payload/: extraction NEVER overwrites production files.
for(const [file,oldMarker] of [
 ['apps/web/src/features/editor/domain/manual-edge-routing.ts','export function editableRoute'],
 ['apps/web/src/components/organisms/NovziParallelEdge.tsx','export function NovziParallelEdge']
]){
 const path=join(process.cwd(),file),payloadPath=join(process.cwd(),'payload',file)
 if(!existsSync(path)||!existsSync(payloadPath))throw Error(`Falta archivo del editor: ${file}`)
 const before=readFileSync(path,'utf8'),after=readFileSync(payloadPath,'utf8')
 if(!before.includes(oldMarker))throw Error(`Incompatible, archivo no reconocido: ${file}`)
 specs.push({file,path,before,after})
}
const changed=specs.filter(x=>x.before!==x.after)
for(const x of specs)console.log(`[NOVZI v3] ${x.file}: ${x.before===x.after?'ya actualizado':'compatible'}`)
if(mode==='check'){console.log(`[NOVZI v3] ${changed.length} archivos pendientes; sin escribir nada.`);process.exit(0)}
for(const x of changed){const backup=x.path+'.backup-edge-v3';if(!existsSync(backup))copyFileSync(x.path,backup);writeFileSync(x.path,x.after);console.log(`[NOVZI v3] Actualizado ${x.file} (respaldo disponible)`)}
console.log('[NOVZI v3] Cambios puntuales aplicados; historial, geometría y colaboración conservados.')
