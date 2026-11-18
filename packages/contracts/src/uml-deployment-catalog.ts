import type {ElementType} from './index'
export const DEPLOYMENT_TYPES:readonly ElementType[]=['uml-node','uml-device','uml-execution','uml-artifact','uml-object','uml-part','component','uml-class','uml-interface','uml-datatype','uml-package','uml-comment','uml-constraint']
export const DEPLOYMENT_RELATIONS=['communication-path','deployment','manifestation','dependency','usage','generalization','composition','containment','annotation'] as const
export const deploymentNode=(t?:ElementType)=>t==='uml-node'||t==='uml-device'||t==='uml-execution'
export const deploymentNote=(t?:ElementType)=>t==='uml-comment'||t==='uml-constraint'
export const deploymentPackageable=(t?:ElementType)=>!!t&&['uml-node','uml-device','uml-execution','uml-artifact','component','uml-class','uml-interface','uml-datatype','uml-package'].includes(t)
export const deploymentTargetType=(t?:ElementType)=>deploymentNode(t)||t==='uml-object'||t==='uml-part'
export function deploymentEndpointValid(kind:string,a:ElementType,b:ElementType):boolean{
 if(!DEPLOYMENT_TYPES.includes(a)||!DEPLOYMENT_TYPES.includes(b))return false
 switch(kind){
 case 'communication-path':return deploymentTargetType(a)&&deploymentTargetType(b)
 case 'deployment':return (a==='uml-artifact'||a==='uml-object')&&deploymentTargetType(b)
 case 'manifestation':return a==='uml-artifact'&&deploymentPackageable(b)
 case 'dependency':case 'usage':return !deploymentNote(a)&&!deploymentNote(b)
 case 'generalization':return (deploymentNode(a)&& (a===b||b==='uml-node'))||a===b&&['uml-artifact','component','uml-class','uml-interface','uml-datatype'].includes(a)
 case 'composition':return deploymentNode(a)&&deploymentNode(b)||a==='uml-artifact'&&b==='uml-artifact'||a==='uml-object'&&b==='uml-object'
 case 'containment':return a==='uml-package'&&deploymentPackageable(b)||deploymentNode(a)&&(deploymentNode(b)||b==='uml-part')||a==='uml-artifact'&&b==='uml-artifact'
 case 'annotation':return deploymentNote(a)
 default:return false
 }
}
