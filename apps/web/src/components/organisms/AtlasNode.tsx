import { UserRound, Boxes, Database, Code2, BookOpen, FileText, Workflow, Cloud, Layers, Maximize2 } from 'lucide-react'
import {Handle,Position} from '@xyflow/react'
import type {NodeProps} from '@xyflow/react'
import {diagramLabels,elementLabels} from '../../types'
import type {DiagramType,ModelElement,Perspective} from '../../types'
export function IconFor({type}:{type:string}){switch(type){case 'actor':return <UserRound size={15}/>;case 'system':return <Boxes size={15}/>;case 'database':return <Database size={15}/>;case 'endpoint':return <Code2 size={15}/>;case 'requirement':return <BookOpen size={15}/>;case 'usecase':return <FileText size={15}/>;case 'process':case 'activity':return <Workflow size={15}/>;case 'external':return <Cloud size={15}/>;default:return <Layers size={15}/>}}
export function AtlasNode({data,selected}:NodeProps){
 const element=data.element as ModelElement|undefined; const mode=data.mode as Perspective;const graphType=data.graphType as DiagramType
 if(!element)return <div className="node missing">Elemento no disponible</div>
 const technical=mode!=='functional';const feature=diagramLabels[graphType]
 return <div className={`atlas-node kind-${element.type} ${selected?'selected':''}`}>
  <Handle type="target" position={Position.Left} className="node-handle"/>
  <div className="node-top"><span className="node-kind"><IconFor type={element.type}/>{elementLabels[element.type]}</span>{element.childDiagramId&&<span className="node-drill"><Maximize2 size={11}/></span>}</div>
  <div className="node-title">{element.name}</div>
  {mode!=='technical'&&element.summary&&<div className="node-summary">{element.summary}</div>}
  {technical&&element.technical&&<div className="node-tech"><Code2 size={12}/><span>{element.technical}</span></div>}
  {graphType==='trace'&&<span className="node-mini-label">{feature}</span>}
  <Handle type="source" position={Position.Right} className="node-handle"/>
 </div>
}
export const nodeTypes={atlas:AtlasNode}

