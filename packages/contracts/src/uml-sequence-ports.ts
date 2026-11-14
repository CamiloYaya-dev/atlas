/** UML Sequence: multiple independent message endpoints along the vertical
 * edges of each execution specification (activation bar). The bar is a single
 * semantic element; its connection capacity grows with the rendered height.
 * Each handle is addressable so reply/call edges never overwrite each other.
 */
export type SequenceMessageSide='left'|'right'
export type SequenceMessagePort={id:string;side:SequenceMessageSide;topPercent:number}
const LEGACY_HANDLES=new Set(['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'])
export function sequenceActivationPorts(height:number,spacing=20):SequenceMessagePort[]{
 if(!Number.isFinite(height)||height<=0)throw new Error('Altura de activación inválida')
 const bounded=Math.max(48,Math.min(4000,height))
 const gap=Math.max(12,Math.min(40,spacing))
 const margin=Math.min(16,bounded/5)
 const count=Math.max(2,Math.floor((bounded-2*margin)/gap)+1)
 const ports:SequenceMessagePort[]=[]
 for(const side of ['left','right'] as const){
  for(let i=0;i<count;i++){
   const y=margin+(i*(bounded-2*margin))/(count-1)
   // Do not place a new handle directly on the legacy centered anchor.
   const topPercent=Math.round(y/bounded*10000)/100
   if(Math.abs(topPercent-50)<0.01)continue // Legacy left/right lives at mid-height.
   ports.push({id:`seq-${side}-${i+1}`,side,topPercent})
  }
 }
 return ports
}
export function sequenceActivationHandleValid(handle:string|undefined):boolean{
 if(!handle)return false
 if(LEGACY_HANDLES.has(handle))return true
 const match=/^seq-(?:left|right)-([1-9]\d{0,2})$/.exec(handle)
 return !!match&&Number(match[1])<=200
}
export function sequenceActivationSide(handle:string|undefined,role:'source'|'target'):SequenceMessageSide{
 if(handle?.startsWith('seq-left-')||handle==='left')return 'left'
 if(handle?.startsWith('seq-right-')||handle==='right')return 'right'
 return role==='source'?'right':'left'
}
/** Historical top/bottom handles are translated only at render time: saved
 * documents retain their original IDs and remain importable. */
export function sequenceRenderedHandle(handle:string|undefined,role:'source'|'target'):string{
 if(handle?.startsWith('seq-left-')||handle?.startsWith('seq-right-'))return handle
 return sequenceActivationSide(handle,role)
}

/** Pick the closest visible lateral anchor to an absolute message timestamp.
 * This keeps UML messages horizontal when two activation bars are offset. */
export function sequenceNearestPort(height:number,side:SequenceMessageSide,localY:number):SequenceMessagePort{
 const options=sequenceActivationPorts(height).filter(p=>p.side===side)
 if(!Number.isFinite(localY))throw new Error('Tiempo de mensaje inválido')
 return options.reduce((closest,p)=>Math.abs(p.topPercent*height/100-localY)<Math.abs(closest.topPercent*height/100-localY)?p:closest)
}
