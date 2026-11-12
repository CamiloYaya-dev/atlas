export class DomainError extends Error {constructor(message:string,public statusCode:number){super(message);this.name='DomainError'}}
export const forbidden=()=>new DomainError('No tienes permisos en este espacio de trabajo',403)
export const notFound=()=>new DomainError('Recurso no encontrado',404)
export function cleanName(name:unknown,max=160){if(typeof name!=='string'||name.trim().length<2||name.length>max)throw new DomainError('Nombre inválido',400);return name.trim()}
export function assertUUID(id:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new DomainError('Identificador no válido',400)}
