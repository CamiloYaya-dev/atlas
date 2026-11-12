import {scrypt as scryptCallback,randomBytes,timingSafeEqual,createHash} from 'node:crypto'

// Mantiene el formato de hash de ATLAS V4.2. No invalida contraseñas existentes.
// N=2^15, r=8, p=3; configuración explícita para compatibilidad.
const options={N:32768,r:8,p:3,maxmem:64*1024*1024}

// El overload con opciones de crypto.scrypt no es preservado por promisify
// en algunas versiones de @types/node. Adaptador asíncrono tipado explícito.
function deriveKey(password:string,salt:Buffer):Promise<Buffer>{
 return new Promise<Buffer>((resolve,reject)=>{
  scryptCallback(password,salt,64,options,(error,key)=>{
   if(error){reject(error);return}
   resolve(key)
  })
 })
}

export async function hashPassword(password:string):Promise<string>{
 if(password.length<12||password.length>128)throw Object.assign(new Error('Contraseña entre 12 y 128 caracteres'),{statusCode:400})
 const salt=randomBytes(24)
 const key=await deriveKey(password,salt)
 return `scrypt$32768$8$3$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password:string,stored:string):Promise<boolean>{
 const chunks=stored.split('$')
 if(chunks.length!==6||chunks[0]!=='scrypt')return false
 const [n,r,p]=chunks.slice(1,4).map(Number)
 if(n!==32768||r!==8||p!==3)return false
 const salt=Buffer.from(chunks[4],'base64url'),expected=Buffer.from(chunks[5],'base64url')
 if(salt.length!==24||expected.length!==64)return false
 const actual=await deriveKey(password,salt)
 return timingSafeEqual(actual,expected)
}

export const hashSecret=(value:string)=>createHash('sha256').update(value).digest('hex')
