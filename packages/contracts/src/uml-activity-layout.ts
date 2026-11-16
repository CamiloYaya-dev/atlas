import type {DiagramNode} from './index'
export const activityActionSize=(node?:Pick<DiagramNode,'width'|'height'>)=>({width:Math.max(95,node?.width??210),height:Math.max(65,node?.height??92)})
export const activityPinSize=(node?:Pick<DiagramNode,'width'|'height'>)=>({width:Math.max(24,node?.width??48),height:Math.max(24,node?.height??48)})
/** Centre of pin adheres to the correct side; constrain the offset to the action height. */
export function activitySnapPin(parent:{width:number;height:number},pin:{width:number;height:number},role:string|undefined,y:number){return {x:role==='output'?parent.width-pin.width/2:-pin.width/2,y:Math.max(0,Math.min(Math.max(0,parent.height-pin.height),y))}}
