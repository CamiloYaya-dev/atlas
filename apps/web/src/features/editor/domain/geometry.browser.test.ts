import {test} from 'vitest'
import assert from 'node:assert/strict'
import {parallelRoute,parallelOffsets} from './parallel-edges'
import type {PortSide} from './parallel-edges'
import {assemblyAnchor} from '../../../components/organisms/uml-assembly'
import type {EdgePathStyle} from '@atlas/contracts'
const styles:EdgePathStyle[]=['straight','step','smoothstep','bezier']
const sides:PortSide[]=['left','right','top','bottom']
const near=(a:number,b:number,tolerance=.05)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`)
for(const pathStyle of styles){
 test(`ruta ${pathStyle}: extremos exactos y etiquetas separadas en horizontal y vertical`,()=>{
  for(const [targetX,targetY] of [[300,25],[10,340],[10,25]]){
   const a=parallelRoute({sourceX:10,sourceY:25,targetX,targetY,offset:38,pathStyle})
   const b=parallelRoute({sourceX:10,sourceY:25,targetX,targetY,offset:-38,pathStyle})
   assert.match(a.path,/^M 10,25/);assert.ok(a.path.endsWith(`${targetX},${targetY}`));assert.notEqual(a.path,b.path)
   assert.ok(Number.isFinite(a.labelX)&&Number.isFinite(a.labelY));assert.notDeepEqual([a.labelX,a.labelY],[b.labelX,b.labelY])
  }
 })
 test(`ruta ${pathStyle}: todos los puertos conservan extremos y separación`,()=>{
  for(const sourcePosition of sides)for(const targetPosition of sides)for(const [targetX,targetY] of [[300,90],[15,340]]){
   const input={sourceX:10,sourceY:25,targetX,targetY,pathStyle,sourcePosition,targetPosition}
   const a=parallelRoute({...input,offset:38}),b=parallelRoute({...input,offset:-38})
   assert.ok(a.path.startsWith('M 10,25'));assert.ok(a.path.endsWith(`${targetX},${targetY}`));assert.notEqual(a.path,b.path)
   assert.notDeepEqual([a.labelX,a.labelY],[b.labelX,b.labelY]);assert.ok(!/NaN|Infinity/.test(a.path))
  }
 })
}
test('relaciones paralelas: identidad estable por ID, sentido inverso y par independiente',()=>{
 const edges=[{id:'c',source:'A',target:'B'},{id:'a',source:'A',target:'B'},{id:'b',source:'B',target:'A'},{id:'z',source:'A',target:'C'}]
 const offsets=parallelOffsets(edges,40)
 assert.equal(offsets.get('a'),-40);assert.equal(offsets.get('b'),0);assert.equal(offsets.get('c'),40);assert.equal(offsets.get('z'),0)
 assert.deepEqual([...parallelOffsets([...edges].reverse(),40)].sort(),[...offsets].sort());assert.equal(parallelOffsets([]).size,0)
})
test('ensamblaje se ancla sobre el segmento recto más largo con su tangente real',()=>{
 const a=assemblyAnchor('M 0,0 L 0,30 L 120,30 L 120,90');near(a.x,60);near(a.y,30);near(a.angle,0)
 const b=assemblyAnchor('M 10,100 L 10,0');near(b.x,10);near(b.y,50);near(b.angle,-90)
 const c=assemblyAnchor('M 0,0 L 20,0 L 20,20');near(c.x,20);near(c.y,0)
})
test('ensamblaje sigue curvas Q y C en lugar de unir sus extremos',()=>{
 const q=assemblyAnchor('M 0,0 Q 50,100 100,0');near(q.x,50,1);near(q.y,50,1);assert.ok(Math.abs(q.angle)<10)
 const c=assemblyAnchor('M 0,0 C 0,100 100,100 100,0');near(c.x,50,1);near(c.y,75,1);assert.ok(Math.abs(c.angle)<10)
})
test('ensamblaje: rutas vacías, puntos repetidos y comandos inválidos',()=>{
 assert.deepEqual(assemblyAnchor(''),{x:0,y:0,angle:0});assert.deepEqual(assemblyAnchor('M 10,20'),{x:10,y:20,angle:0})
 assert.deepEqual(assemblyAnchor('M 0,0 L 0,0'),{x:0,y:0,angle:0});assert.throws(()=>assemblyAnchor('M 0'),/inválida/);assert.throws(()=>assemblyAnchor('m 0,0'),/no soportado/)
})
