import type {DiagramEdge,ModelElement} from './index'
import type {PortSide,RouteEndpoints} from './parallel-edges'
import {parallelRoute} from './parallel-edges'
import {umlRelationNotation} from './uml-notation'
import type {UmlTerminal} from './uml-notation'
import {isAssociation} from './uml-class-policy'
export type ClassPoint={x:number;y:number}
export type ClassBounds=ClassPoint&{width:number;height:number}
export function classPort(r:ClassBounds,handle:string|undefined,source:boolean):ClassPoint&{side:PortSide}{
 const p=handle||(source?'right':'left');if(p==='left')return {x:r.x,y:r.y+r.height/2,side:'left'};if(p==='right')return {x:r.x+r.width,y:r.y+r.height/2,side:'right'}
 const ratio=p.endsWith('-1')?.2:p.endsWith('-3')?.8:.5,side=p.startsWith('bottom')?'bottom':'top';return {x:r.x+r.width*ratio,y:r.y+(side==='bottom'?r.height:0),side}
}
export function classFacingPort(r:ClassBounds,towards:ClassPoint){
 const dx=towards.x-r.x-r.width/2,dy=towards.y-r.y-r.height/2
 return classPort(r,Math.abs(dx)/r.width>=Math.abs(dy)/r.height?(dx>=0?'right':'left'):(dy>=0?'bottom-2':'top-2'),false)
}
export const classPortAngle=(side:PortSide)=>({right:0,left:180,top:-90,bottom:90})[side]
export function classRelationRoute(input:RouteEndpoints,self:boolean){
 if(!self)return parallelRoute(input)
 const {sourceX:sx,sourceY:sy,targetX:tx,targetY:ty,offset}=input
 // Keep self links outside the rectangle. A signed lateral displacement separates parallel loops.
 const radius=55+Math.abs(offset),lift=radius*2,mid=(sx+tx)/2+offset
 return {path:`M ${sx} ${sy} C ${sx+radius+offset} ${sy-lift}, ${tx-radius+offset} ${ty-lift}, ${tx} ${ty}`,labelX:mid,labelY:Math.min(sy,ty)-radius*1.5}
}
export function classEndTerminal(e:Pick<DiagramEdge,'relationKind'|'wholeEnd'|'sourceNavigability'|'targetNavigability'>,side:'source'|'target'):UmlTerminal{
 const n=umlRelationNotation(e.relationKind||'association')
 if(e.relationKind==='containment')return side==='source'?'ownership':'none'
 if(!isAssociation(e.relationKind))return side==='source'?n.start:n.end
 const whole=e.wholeEnd||'source';if(whole===side&&['aggregation','composition'].includes(e.relationKind||''))return e.relationKind==='composition'?'diamond-filled':'diamond-open'
 const nav=side==='source'?e.sourceNavigability:e.targetNavigability
 if(nav)return nav==='navigable'?'open-arrow':nav==='non-navigable'?'cross':'none'
 const old=side==='source'?n.start:n.end;return old.startsWith('diamond')?'none':old
}
export function classEndLabel(point:ClassPoint,side:PortSide){const vector=({left:[-20,-15],right:[20,-15],top:[20,-15],bottom:[20,15]})[side];return {x:point.x+vector[0],y:point.y+vector[1]}}
export function classTemplateFormalText(p:NonNullable<NonNullable<ModelElement['uml']>['templateParameters']>[number],names?:Readonly<Record<string,string>>){return p.name+(p.typeId?`: ${names?.[p.typeId]||'Tipo no disponible'}`:'')+(p.constraint?` {${p.constraint}}`:'')}
