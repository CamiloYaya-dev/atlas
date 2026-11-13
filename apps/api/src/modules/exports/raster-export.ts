import sharp from 'sharp'
import {DomainError} from '../../domain/errors'

/** Accepts only browser PNG pixels; export permissions, watermark and audit are server-owned. */
export async function encodeCapturedDiagram(base64:string,format:'png'|'jpg',watermarked:boolean):Promise<Buffer>{
 if(typeof base64!=='string'||base64.length>18_000_000||base64.length<20||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new DomainError('Captura de diagrama inválida',400)
 const data=Buffer.from(base64,'base64')
 if(data.length>13_500_000||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new DomainError('Solo se admite captura PNG',400)
 let meta:sharp.Metadata
 try{meta=await sharp(data,{limitInputPixels:20_000_000,failOn:'error'}).metadata()}catch{throw new DomainError('La captura PNG está dañada',422)}
 const width=meta.width||0,height=meta.height||0
 if(!width||!height||width>5000||height>5000||width*height>20_000_000)throw new DomainError('Dimensiones de exportación excesivas',413)
 const input=sharp(data,{limitInputPixels:20_000_000,failOn:'error'}).flatten({background:'#f7faff'})
 if(watermarked){
  const label='ATLAS · USO NO COMERCIAL'
  const tiles:string[]=[]
  for(let y=-220;y<height+350;y+=185)for(let x=-300;x<width+450;x+=440){
   tiles.push(`<text x="${x}" y="${y}" fill="#27496d" font-size="27" font-weight="700" font-family="Arial,sans-serif" transform="rotate(-23 ${x} ${y})">${label}</text>`)
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g opacity=".17">${tiles.join('')}</g></svg>`
  input.composite([{input:Buffer.from(svg),top:0,left:0}])
 }
 return format==='png'?input.png({compressionLevel:9}).toBuffer():input.jpeg({quality:94,mozjpeg:true}).toBuffer()
}
