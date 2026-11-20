import {describe,it,expect} from 'vitest'
import {compactPolyline,editableRoute,insertDogleg,isValidManualRoute,orthogonalize,polylinePath,shiftSegment,toManualRoute} from './manual-edge-routing'

describe('P0 / editar líneas sin mover cajas',()=>{
 it('mantiene fijos los extremos aunque se desplace un segmento',()=>{
  const source={x:0,y:0},target={x:240,y:0}
  const route=editableRoute(source,target,undefined,'right','left')
  const shifted=shiftSegment(route,Math.floor((route.length-1)/2),70)
  expect(shifted[0]).toEqual(source)
  expect(shifted.at(-1)).toEqual(target)
  expect(toManualRoute(shifted).points.length).toBeGreaterThan(0)
  expect(shifted).not.toEqual(route)
 })
 it('crea giros ortogonales y los serializa para autosave/import/export',()=>{
  const original=[{x:0,y:0},{x:160,y:0}]
  const bent=insertDogleg(original,0,42)
  expect(bent).toEqual([{x:0,y:0},{x:0,y:42},{x:160,y:42},{x:160,y:0}])
  const authored=toManualRoute(bent)
  expect(isValidManualRoute(authored)).toBe(true)
  const restored=editableRoute(original[0],original[1],JSON.parse(JSON.stringify(authored)),'right','left')
  expect(restored).toEqual(bent)
  expect(polylinePath(restored).path).toContain('L 160 42')
 })
 it('elimina dobles puntos y segmentos innecesarios',()=>{
  const route=compactPolyline([{x:0,y:0},{x:0,y:0},{x:30,y:0},{x:90,y:0},{x:90,y:50}])
  expect(route).toEqual([{x:0,y:0},{x:90,y:0},{x:90,y:50}])
 })
 it('rechaza payload inválido antes de escribir o renderizar',()=>{
  expect(isValidManualRoute({version:1,points:[{x:Infinity,y:0}]})).toBe(false)
  expect(isValidManualRoute({version:1,points:[{x:1e20,y:0}]})).toBe(false)
  expect(isValidManualRoute({version:1,points:Array.from({length:25},(_,i)=>({x:i,y:0}))})).toBe(false)
  expect(()=>toManualRoute([{x:0,y:0},...Array.from({length:25},(_,i)=>({x:i*10,y:i%2?10:20})),{x:400,y:0}])).toThrow(/Máximo/)
 })
 it('ajusta puntos arbitrarios a un recorrido ortogonal según el lado del puerto',()=>{
  const path=orthogonalize([{x:0,y:0},{x:100,y:70},{x:180,y:20}], 'right','left')
  expect(path[0]).toEqual({x:0,y:0})
  expect(path.at(-1)).toEqual({x:180,y:20})
  for(let i=1;i<path.length;i++)expect(path[i].x===path[i-1].x||path[i].y===path[i-1].y).toBe(true)
 })
})
