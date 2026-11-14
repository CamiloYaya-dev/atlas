/** Node dimensions belong to each appearance in a diagram, not to the shared element. */
import type {DiagramType,ElementType,DiagramNode,ModelElement} from './index'
import {umlContainerSize} from './uml-containers'
export function atlasNodeMinimum(diagram:DiagramType,type:ElementType){
 if(diagram==='uml-activity'&&type==='uml-partition')return {width:250,height:180}
 if(diagram==='uml-activity'&&['uml-start','uml-end','uml-flow-final'].includes(type))return {width:48,height:48}
 if(diagram==='uml-activity'&&type==='uml-decision')return {width:68,height:68}
 if(diagram==='uml-activity'&&type==='uml-fork')return {width:90,height:20}
 if(diagram==='uml-composite'&&type==='uml-class')return {width:320,height:230}
 if(['uml-package','uml-profile','uml-usecase'].includes(diagram)&&['uml-package','uml-subpackage','uml-model','uml-profile','uml-subject'].includes(type))return {width:190,height:130}
 if(diagram==='uml-deployment'&&['uml-node','uml-device','uml-execution'].includes(type))return {width:190,height:145}
 if(diagram==='uml-composite'&&type==='uml-port')return {width:110,height:64}
 return {width:95,height:65}
}
export function atlasNodeSize(diagram:DiagramType,element:ModelElement,node?:Pick<DiagramNode,'width'|'height'>,depth=0,hasChildren=false){
 let width=250,height=125
 const type=element.type
 if(diagram==='uml-activity'&&type==='uml-partition'){width=570;height=380}
 else if(diagram==='uml-activity'&&type==='uml-action'){width=210;height=92}
 else if(diagram==='uml-activity'&&type==='uml-object-node'){width=205;height=96}
 else if(diagram==='uml-composite'&&['uml-class','uml-part','uml-port','uml-reference-role'].includes(type)){
  const base=umlContainerSize(type,depth);width=base.width;height=base.height
 }else if(diagram.startsWith('uml-')&&['uml-package','uml-subpackage','uml-model','uml-profile','uml-subject'].includes(type)){
  const base=umlContainerSize(type,depth);width=base.width;height=base.height
 }else if(diagram==='uml-deployment'){
  if(type==='uml-node'||type==='uml-device'){width=hasChildren?570:260;height=hasChildren?370:128}
  else if(type==='uml-execution'){width=hasChildren?360:260;height=hasChildren?235:128}
  else{width=260;height=128}
 }else if(diagram==='uml-composite'&&type==='uml-collaboration'){width=205;height=110}
 else if(diagram==='uml-component'&&type==='component'){width=270;height=115}
 else if(['uml-class','uml-object'].includes(diagram)){
  const lines=(element.uml?.attributes?.length||0)+(element.uml?.operations?.length||0)+(element.uml?.slots?.length||0)
  width=290;height=Math.max(145,95+lines*21)
 }else if(type==='uml-start'||type==='uml-end'||type==='uml-flow-final'){width=54;height=54}
 else if(type==='uml-decision'){width=84;height=84}
 else if(type==='uml-fork'){width=160;height=28}
 else if(type==='uml-lifeline'){width=170;height=260}
 const min=atlasNodeMinimum(diagram,type)
 return {width:Math.max(min.width,node?.width??width),height:Math.max(min.height,node?.height??height)}
}
