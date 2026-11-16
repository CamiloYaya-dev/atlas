import {activitySvgScene,classSvgScene,sequenceSvgScene,umlEdgeLabel,isUmlDiagram} from '@atlas/contracts'
import type {Diagram,ProjectDocument} from '@atlas/contracts'
/** Static SVG, no editing listeners. Coordinates and labels come only from the authorized snapshot. */
export default function VersionDiagramPreview({diagram,document}:{diagram:Diagram;document:ProjectDocument}){
 if(['uml-class','uml-usecase','uml-activity','uml-sequence'].includes(diagram.type)){const scene=diagram.type==='uml-activity'?activitySvgScene(document,diagram):diagram.type==='uml-sequence'?sequenceSvgScene(document,diagram):classSvgScene(document,diagram);return <div className="revision-canvas"><svg role="img" aria-label={`Vista histórica del diagrama ${diagram.name}`} viewBox={`${scene.minX} ${scene.minY} ${scene.width} ${scene.height}`} dangerouslySetInnerHTML={{__html:scene.markup}}/>{!diagram.nodes.length&&<p>Esta revisión no contiene cajas en el diagrama.</p>}</div>}
 const width=190,height=76,padding=48
 const nodes=new Map(diagram.nodes.map(n=>[n.id,n]))
 const minX=diagram.nodes.length?Math.min(...diagram.nodes.map(n=>n.x)):0
 const minY=diagram.nodes.length?Math.min(...diagram.nodes.map(n=>n.y)):0
 const maxX=diagram.nodes.length?Math.max(...diagram.nodes.map(n=>n.x))+width:600
 const maxY=diagram.nodes.length?Math.max(...diagram.nodes.map(n=>n.y))+height:280
 const viewBox=`${minX-padding} ${minY-padding} ${Math.max(420,maxX-minX+padding*2)} ${Math.max(240,maxY-minY+padding*2)}`
 return <div className="revision-canvas">
  <svg role="img" aria-label={`Vista histórica del diagrama ${diagram.name}`} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
   {diagram.edges.map(e=>{const from=nodes.get(e.source),to=nodes.get(e.target);if(!from||!to)return null
    const label=isUmlDiagram(diagram.type)?umlEdgeLabel(diagram.type,e):e.label
    return <g key={e.id}><line x1={from.x+width/2} y1={from.y+height/2} x2={to.x+width/2} y2={to.y+height/2} stroke="#7c93b5" strokeWidth="2"/>{label&&<text x={(from.x+to.x)/2+width/2} y={(from.y+to.y)/2+height/2-7} textAnchor="middle" fontSize="12" fill="#344b69">{label}</text>}</g>
   })}
   {diagram.nodes.map(n=>{const element=document.elements[n.elementId];if(!element)return null
    return <g key={n.id}><rect x={n.x} y={n.y} width={width} height={height} rx="10" fill="#fff" stroke="#6794cd" strokeWidth="2"/>
     <text x={n.x+12} y={n.y+27} fill="#1f3b60" fontWeight="bold" fontSize="13">{element.name.length>25?element.name.slice(0,24)+'…':element.name}</text>
     <text x={n.x+12} y={n.y+51} fill="#657a96" fontSize="11">{element.type}</text></g>
   })}
  </svg>
  {!diagram.nodes.length&&<p>Esta revisión no contiene cajas en el diagrama.</p>}
 </div>
}
