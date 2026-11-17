import {COMPONENT_PORT_SIZE} from './uml-component-catalog'
import {sequenceFragmentSize} from './uml-sequence-geometry'
import {activityActionSize,activityPinSize} from './uml-activity-layout'
/** Node dimensions belong to each appearance in a diagram, not to the shared element. */
import type {DiagramType,ElementType,DiagramNode,ModelElement} from './index'
import {umlContainerSize} from './uml-containers'
export function atlasNodeMinimum(diagram:DiagramType,type:ElementType){
 if(diagram==='uml-component'&&type==='uml-port')return COMPONENT_PORT_SIZE
 if(diagram==='uml-activity'&&type==='uml-activity-pin')return {width:24,height:24}
 if(diagram==='uml-activity'&&type==='uml-activity-parameter')return {width:95,height:48}
 if(diagram==='uml-activity'&&type==='uml-activity-interruptible-region')return {width:250,height:180}
 if(diagram==='uml-activity'&&type==='uml-partition')return {width:250,height:180}
 if(diagram==='uml-activity'&&['uml-start','uml-end','uml-flow-final'].includes(type))return {width:48,height:48}
 if(diagram==='uml-activity'&&type==='uml-decision')return {width:68,height:68}
 if(diagram==='uml-activity'&&type==='uml-fork')return {width:90,height:20}
 if(diagram==='uml-state'&&type==='uml-region')return {width:260,height:180}
 if(diagram==='uml-state'&&type==='uml-state')return {width:170,height:90}
 if(diagram==='uml-state'&&type==='uml-decision')return {width:52,height:52}
 if(diagram==='uml-state'&&type==='uml-fork')return {width:90,height:16}
 if(diagram==='uml-state'&&['uml-start','uml-end','uml-history-shallow','uml-history-deep','uml-entry-point','uml-exit-point'].includes(type))return {width:48,height:48}
 if(diagram==='uml-state'&&type==='uml-terminate')return {width:42,height:42}
 if(['uml-sequence','uml-communication'].includes(diagram)&&type==='uml-frame')return {width:260,height:160}
 if(diagram==='uml-sequence'&&type==='uml-activation')return {width:48,height:70}
 if(diagram==='uml-sequence'&&type==='uml-destruction')return {width:48,height:48}
 if(diagram==='uml-sequence'&&type==='uml-gate')return {width:48,height:48}
 if(diagram==='uml-sequence'&&type==='uml-interaction')return {width:220,height:78}
 if(diagram==='uml-composite'&&type==='uml-class')return {width:320,height:230}
 if(['uml-package','uml-profile','uml-usecase'].includes(diagram)&&['uml-package','uml-subpackage','uml-model','uml-profile','uml-subject'].includes(type))return {width:190,height:130}
 if(diagram==='uml-deployment'&&['uml-node','uml-device','uml-execution'].includes(type))return {width:190,height:145}
 if(diagram==='uml-composite'&&type==='uml-port')return {width:110,height:64}
 return {width:95,height:65}
}
export function atlasNodeSize(diagram:DiagramType,element:ModelElement,node?:Pick<DiagramNode,'width'|'height'>,depth=0,hasChildren=false){
 let width=250,height=125
 const type=element.type
 if(diagram==='uml-component'&&type==='uml-port')return COMPONENT_PORT_SIZE
 if(diagram==='uml-sequence'&&['uml-frame','uml-interaction'].includes(type))return sequenceFragmentSize(type,node)
 if(diagram==='uml-usecase'&&['actor','usecase'].includes(type)){
  const detail=element.useCaseDetail||{},rectangular=detail.presentation==='rectangle',actor=type==='actor'&&!rectangular,points=detail.extensionPoints||[],members=rectangular?(element.uml?.attributes?.length||0)+(element.uml?.operations?.length||0):0
  width=actor?Math.max(130,Math.min(300,element.name.length*7+20)):Math.max(220,Math.min(560,element.name.length*8+55,...points.map(p=>(p.name.length+(p.description?.length||0))*7+65)))
  const actualWidth=node?.width??width,characters=Math.max(12,Math.floor(actualWidth*(rectangular?.88:.65)/7)),rows=(value:string)=>value.split(/\n/).reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/characters)),0)
  const titleRows=rows(element.name)+(detail.stereotype?rows(detail.stereotype):0)+((detail.leaf??element.uml?.leaf)?1:0),pointRows=points.reduce((n,p)=>n+rows(p.name+(p.description?`: ${p.description}`:'')),0)
  height=actor?Math.max(150,105+titleRows*16):Math.max(105,62+titleRows*17+(points.length?22+pointRows*20:0)+members*21)
  // Explicit per-occurrence width is retained. Height never clips names/points.
  return {width:Math.max(atlasNodeMinimum(diagram,type).width,actualWidth),height:Math.max(height,node?.height||0)}
 }
 else if(diagram==='uml-activity'&&['uml-partition','uml-activity-interruptible-region'].includes(type)){width=570;height=380}
 else if(diagram==='uml-activity'&&type==='uml-activity-pin'){return activityPinSize(node)}
 else if(diagram==='uml-activity'&&type==='uml-activity-parameter'){width=145;height=65}
 else if(diagram==='uml-activity'&&type==='uml-fork'&&element.activityDetail?.orientation==='vertical'){return {width:node?.width??48,height:Math.max(90,node?.height??160)}}
 else if(diagram==='uml-activity'&&type==='uml-action'){return activityActionSize(node)}
 else if(diagram==='uml-activity'&&type==='uml-object-node'){width=205;height=96}
 else if(diagram==='uml-composite'&&['uml-class','uml-part','uml-port','uml-reference-role'].includes(type)){
  const base=umlContainerSize(type,depth);width=base.width;height=base.height
 }else if(diagram.startsWith('uml-')&&['uml-package','uml-subpackage','uml-model','uml-profile','uml-subject'].includes(type)){
  const base=umlContainerSize(type,depth);width=base.width;height=base.height
 }else if(diagram==='uml-deployment'){
  if(type==='uml-node'||type==='uml-device'){width=hasChildren?570:260;height=hasChildren?370:128}
  else if(type==='uml-execution'){width=hasChildren?360:260;height=hasChildren?235:128}
  else{width=260;height=128}
  const detail=element.uml?.deployment;const lines=(element.uml?.attributes?.length||0)+(element.uml?.operations?.length||0)+(detail?.kind==='instance'?detail.slots?.length||0:0);if(!hasChildren){width=Math.max(width,Math.min(720,element.name.length*7+45));height=Math.max(height,90+lines*18)}
 }else if(diagram==='uml-composite'&&type==='uml-collaboration'){width=205;height=110}
 else if(diagram==='uml-component'&&type==='component'){width=270;height=Math.max(115,85+((element.uml?.attributes?.length||0)+(element.uml?.operations?.length||0))*21)}
 else if(diagram==='uml-component'&&['uml-part','uml-reference-role'].includes(type)){width=260;height=118}
 else if(diagram==='uml-component'&&['uml-class','uml-interface','uml-datatype','uml-artifact'].includes(type)){width=290;height=Math.max(145,95+((element.uml?.attributes?.length||0)+(element.uml?.operations?.length||0))*21)}
 else if(['uml-class','uml-object'].includes(diagram)){
  const lines=(element.uml?.attributes?.length||0)+(element.uml?.operations?.length||0)+(element.uml?.slots?.length||0)+(element.uml?.literals?.length||0)
  width=290;height=Math.max(145,95+lines*21)
 }else if(type==='uml-start'||type==='uml-end'||type==='uml-flow-final'){width=54;height=54}
 else if(type==='uml-decision'){width=84;height=84}
 else if(type==='uml-fork'){width=160;height=28}
 else if(type==='uml-history-shallow'||type==='uml-history-deep'||type==='uml-entry-point'||type==='uml-exit-point'){width=54;height=54}
 else if(type==='uml-terminate'){width=40;height=40}
 else if(diagram==='uml-sequence'&&type==='uml-gate'){width=48;height=48}
 else if(diagram==='uml-sequence'&&['uml-sequence-invariant','uml-sequence-continuation'].includes(type)){width=170;height=48}
 else if(type==='uml-lifeline'){width=170;height=260}
 else if(diagram==='uml-sequence'&&type==='uml-activation'){width=48;height=120}
 else if(diagram==='uml-sequence'&&type==='uml-destruction'){width=48;height=48}
 const min=atlasNodeMinimum(diagram,type)
 return {width:Math.max(min.width,node?.width??width),height:Math.max(min.height,node?.height??height)}
}
