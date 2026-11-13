import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {DomainError} from '../../domain/errors'
export interface Provenance {version:1;exportId:string;workspaceId:string;projectId:string;diagramId:string;actorId:string;documentVersion:number;format:'png'|'jpg';planCode:string;licenseActive:boolean;watermarkApplied:boolean;exportedAt:string;imageSha256:string}
const PREFIX='ATLAS-PROVENANCE-v1:'
export const sha256=(buf:Buffer)=>createHash('sha256').update(buf).digest('hex')
export function signature(data:Provenance,key:string){return createHmac('sha256',key).update(JSON.stringify(data)).digest('hex')}
export function signaturesMatch(actual:string,expected:string){const a=Buffer.from(actual,'hex'),b=Buffer.from(expected,'hex');return a.length===b.length&&a.length===32&&timingSafeEqual(a,b)}
const pngSignature=Buffer.from('89504e470d0a1a0a','hex')
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0})
function crc32(data:Buffer){let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
function pngChunk(type:string,data:Buffer){const len=Buffer.alloc(4),crc=Buffer.alloc(4),label=Buffer.from(type);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));return Buffer.concat([len,label,data,crc])}
export function embedProvenance(image:Buffer,format:'png'|'jpg',proof:Provenance,secret:string):Buffer{
 const token=Buffer.from(JSON.stringify({proof,signature:signature(proof,secret)})).toString('base64url')
 const data=Buffer.from(PREFIX+token,'utf8')
 if(format==='png'){
  if(!image.subarray(0,8).equals(pngSignature))throw new DomainError('Imagen PNG inválida',422)
  const offset=8+12+image.readUInt32BE(8)
  return Buffer.concat([image.subarray(0,offset),pngChunk('tEXt',Buffer.concat([Buffer.from('ATLAS.Provenance\0'),data])),image.subarray(offset)])
 }
 if(image[0]!==0xff||image[1]!==0xd8)throw new DomainError('Imagen JPG inválida',422)
 if(data.length>65000)throw new Error('Firma de procedencia demasiado larga')
 const len=Buffer.alloc(2);len.writeUInt16BE(data.length+2)
 return Buffer.concat([image.subarray(0,2),Buffer.from([0xff,0xfe]),len,data,image.subarray(2)])
}
export function readProvenance(image:Buffer):{format:'png'|'jpg';proof:Provenance;sig:string;unsignedImage:Buffer}|null{
 let token:string|undefined,original:Buffer,format:'png'|'jpg'
 if(image.length>32&&image.subarray(0,8).equals(pngSignature)){
  format='png';let pos=8,removed=false;const chunks:Buffer[]=[image.subarray(0,8)]
  while(pos+12<=image.length){const n=image.readUInt32BE(pos),end=pos+12+n;if(n>20_000_000||end>image.length)throw new DomainError('PNG dañado',422)
   const type=image.toString('ascii',pos+4,pos+8),payload=image.subarray(pos+8,pos+8+n)
   if(type==='tEXt'&&payload.toString('utf8',0,17).startsWith('ATLAS.Provenance')){
    if(removed)throw new DomainError('Múltiples firmas ATLAS',422)
    const mark=payload.indexOf(0);token=payload.subarray(mark+1).toString('utf8');removed=true
   }else chunks.push(image.subarray(pos,end))
   pos=end;if(type==='IEND')break
  }
  if(!removed)return null;original=Buffer.concat(chunks)
 }else if(image.length>4&&image[0]===0xff&&image[1]===0xd8){
  format='jpg';if(image[2]!==0xff||image[3]!==0xfe)return null
  const length=image.readUInt16BE(4),end=4+length
  if(length<3||end>image.length)throw new DomainError('JPG dañado',422)
  token=image.subarray(6,end).toString('utf8');original=Buffer.concat([image.subarray(0,2),image.subarray(end)])
 }else throw new DomainError('Solo PNG o JPG',422)
 if(!token?.startsWith(PREFIX))return null
 try{
  const parsed=JSON.parse(Buffer.from(token.slice(PREFIX.length),'base64url').toString('utf8')) as {proof:Provenance;signature:string}
  if(parsed.proof?.version!==1||parsed.proof.format!==format||typeof parsed.signature!=='string')return null
  return {format,proof:parsed.proof,sig:parsed.signature,unsignedImage:original}
 }catch{return null}
}
