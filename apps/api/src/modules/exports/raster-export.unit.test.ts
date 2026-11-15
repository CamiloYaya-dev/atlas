import {test} from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {encodeCapturedDiagram} from './raster-export'

const sample=()=>sharp({create:{width:450,height:270,channels:4,background:'#fff'}}).png().toBuffer()
test('la exportación visual conserva la geometría exacta de la captura PNG sin licencia',async()=>{
 const source=await sample()
 const clean=await encodeCapturedDiagram(source.toString('base64'),'png',false)
 assert.deepEqual(await sharp(clean).metadata().then(x=>[x.width,x.height]),[450,270])
 const a=await sharp(source).removeAlpha().raw().toBuffer(),b=await sharp(clean).raw().toBuffer()
 assert.deepEqual(b,a,'con licencia no se dibujan líneas ni nodos adicionales sobre la captura')
})
test('el servidor añade marcas de agua al PNG aunque el navegador no lo solicite',async()=>{
 const source=(await sample()).toString('base64')
 const clean=await encodeCapturedDiagram(source,'png',false)
 const marked=await encodeCapturedDiagram(source,'png',true)
 assert.notDeepEqual(await sharp(clean).raw().toBuffer(),await sharp(marked).raw().toBuffer())
})
test('JPG conserva formato y dimensiones con marca y sin marca',async()=>{
 const source=(await sample()).toString('base64')
 for(const watermark of [true,false]){
  const jpg=await encodeCapturedDiagram(source,'jpg',watermark)
  const meta=await sharp(jpg).metadata()
  assert.equal(meta.format,'jpeg');assert.equal(meta.width,450);assert.equal(meta.height,270)
 }
})
test('rechaza formatos y capturas falsas',async()=>{
 await assert.rejects(encodeCapturedDiagram('aGVsbG8=','png',false),/Captura de diagrama inválida/)
 await assert.rejects(encodeCapturedDiagram('!%$','jpg',true),/Captura de diagrama inválida/)
})

test('rechaza tipos no textuales, caracteres no base64 y límites antes de decodificar',async()=>{
 for(const value of [null,42,'a'.repeat(18_000_001),'!'.repeat(24)]){
  await assert.rejects(encodeCapturedDiagram(value as string,'png',false),{statusCode:400,message:'Captura de diagrama inválida'})
 }
 await assert.rejects(encodeCapturedDiagram(Buffer.alloc(30).toString('base64'),'png',false),{statusCode:400,message:'Solo se admite captura PNG'})
})
test('rechaza PNG truncado y dimensiones fuera de política sin devolver bytes',async()=>{
 const truncated=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(24)])
 await assert.rejects(encodeCapturedDiagram(truncated.toString('base64'),'png',false),{statusCode:422,message:'La captura PNG está dañada'})
 for(const [width,height] of [[5001,1],[1,5001]]){
  const png=await sharp({create:{width,height,channels:3,background:'white'}}).png().toBuffer()
  await assert.rejects(encodeCapturedDiagram(png.toString('base64'),'png',false),{statusCode:413,message:'Dimensiones de exportación excesivas'})
 }
})
