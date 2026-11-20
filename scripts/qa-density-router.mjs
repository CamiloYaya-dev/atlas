import {createRequire} from 'node:module'
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
const require=createRequire(import.meta.url),ts=require('typescript')
const root='apps/web/src/features/editor/domain/'
const cache=new Map()
function load(file){if(cache.has(file))return cache.get(file)
 const exports={};cache.set(file,exports)
 const transformed=ts.transpileModule(fs.readFileSync(root+file+'.ts','utf8'),{fileName:file+'.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(transformed,{exports,require:id=>id==='./manual-edge-routing'?load('manual-edge-routing'):require(id),console,Math,Set,Map},{filename:file});return exports
}
const {routeDenseDiagram,wireInterference}=load('density-router')
const boxes=[]
for(let i=0;i<14;i++)boxes.push({id:String(i),x:350*(i%5),y:210*Math.floor(i/5),width:235,height:130})
const edges=[]
for(let i=1;i<12;i++)edges.push({source:'0',target:String(i)})
for(let i=1;i<12;i++)edges.push({source:String(i),target:'13'})
for(let i=1;i<10;i++)edges.push({source:String(i),target:String(i+1)})
for(let i=0;i<edges.length;i++){
 const e=edges[i],a=boxes.find(b=>b.id===e.source),b=boxes.find(b=>b.id===e.target)
 e.id='edge-'+i
 e.from={x:a.x+a.width,y:a.y+a.height/2};e.to={x:b.x,y:b.y+b.height/2};e.sourceSide='right';e.targetSide='left'
}
const then=performance.now()
const result=routeDenseDiagram(edges,boxes)
const elapsed=Math.round(performance.now()-then)
console.log('34+ edges: routed',result.size,'of',edges.length,'in',elapsed,'ms')
assert.ok(result.size>=Math.floor(edges.length*.7),'Most dense edges must have obstacle-safe route')
for(const r of result.values())for(let i=1;i<r.points.length;i++)assert.ok(r.points[i].x===r.points[i-1].x||r.points[i].y===r.points[i-1].y,'Manhattan segments only')
assert.ok(elapsed<2500,'Router too slow for interactive editor')
let crossing=0
for(const r of result.values())crossing+=r.crossings
console.log('Total incremental crossings:',crossing)
assert.deepEqual([...routeDenseDiagram(edges,boxes).entries()],[...result.entries()],'Router deterministic')
assert.equal(wireInterference({x:0,y:20},{x:100,y:20},{x:50,y:0},{x:50,y:100}).cross,true)
assert.equal(wireInterference({x:0,y:20},{x:100,y:20},{x:25,y:20},{x:80,y:20}).overlap,55)
