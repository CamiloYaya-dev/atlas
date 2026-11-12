import type {ProjectDocument} from './index'

/** Three-way merge for an ATLAS document. Distinct diagrams, elements, fields,
 * node positions and relations can be changed concurrently. Conflicting writes
 * to the same property MUST stop, never overwrite another person's work. */
export class MergeConflict extends Error {
 readonly path:string
 constructor(path:string){super(`Conflicto de colaboración en ${path}. Conservamos tus cambios locales.`);this.name='MergeConflict';this.path=path}
}
const MISSING=Symbol('missing')
type JsonValue=unknown | typeof MISSING
const object=(v:JsonValue):v is Record<string,unknown>=>v!==MISSING&&v!==null&&typeof v==='object'&&!Array.isArray(v)
const equal=(a:JsonValue,b:JsonValue):boolean=>{
 if(a===b)return true
 if(a===MISSING||b===MISSING||a===null||b===null||typeof a!==typeof b)return false
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]))
 if(object(a)&&object(b)){const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]))}
 return false
}
const keyed=(items:unknown[]):boolean=>items.every(item=>object(item)&&typeof item.id==='string')&&new Set(items.map(item=>(item as {id:string}).id)).size===items.length
const child=(v:Record<string,unknown>,key:string):JsonValue=>Object.hasOwn(v,key)?v[key]:MISSING
function reconcile(base:JsonValue,local:JsonValue,remote:JsonValue,path:string,choices?:Readonly<Record<string,'current'|'historical'>>,unresolved?:string[]):JsonValue{
 if(equal(local,base))return remote
 if(equal(remote,base))return local
 if(equal(local,remote))return local
 if(object(local)&&object(remote)&&(object(base)||base===MISSING)){
  const old=object(base)?base:{}
  const result:Record<string,unknown>={}
  for(const key of new Set([...Object.keys(old),...Object.keys(local),...Object.keys(remote)])){
   const value=reconcile(child(old,key),child(local,key),child(remote,key),`${path}.${key}`,choices,unresolved)
   if(value!==MISSING)Object.defineProperty(result,key,{value,writable:true,enumerable:true,configurable:true})
  }
  return result
 }
 if(Array.isArray(local)&&Array.isArray(remote)&&(Array.isArray(base)||base===MISSING)){
  const old=Array.isArray(base)?base:[]
  if(keyed(old)&&keyed(local)&&keyed(remote)){
   const before=new Map(old.map(x=>[(x as {id:string}).id,x]))
   const ours=new Map(local.map(x=>[(x as {id:string}).id,x]))
   const theirs=new Map(remote.map(x=>[(x as {id:string}).id,x]))
   // Keep current persisted order; append local additions in their order.
   const order=[...theirs.keys(),...ours.keys()].filter((id,i,all)=>all.indexOf(id)===i)
   const combined:unknown[]=[]
   for(const id of order){
    const result=reconcile(before.has(id)?before.get(id):MISSING,ours.has(id)?ours.get(id):MISSING,theirs.has(id)?theirs.get(id):MISSING,`${path}[${id}]`,choices,unresolved)
    if(result!==MISSING)combined.push(result)
   }
   return combined
  }
 }
 // A removed object versus a modified one, or competing scalar/array writes.
 if(choices?.[path]==='current')return remote
 if(choices?.[path]==='historical')return local
 if(unresolved){unresolved.push(path);return remote}
 throw new MergeConflict(path)
}
export function mergeProjectDocuments(base:ProjectDocument,local:ProjectDocument,remote:ProjectDocument):ProjectDocument{
 if(base.schema!==1||local.schema!==1||remote.schema!==1)throw new MergeConflict('schema')
 return structuredClone(reconcile(base,local,remote,'document')) as ProjectDocument
}

/** Preview every conflicting property; never save the preview as a document. */
export function previewProjectMerge(base:ProjectDocument,historical:ProjectDocument,current:ProjectDocument,choices:Readonly<Record<string,'current'|'historical'>>={}):{document:ProjectDocument;conflicts:string[]}{
 const unresolved:string[]=[]
 const document=structuredClone(reconcile(base,historical,current,'document',choices,unresolved)) as ProjectDocument
 return {document,conflicts:unresolved}
}
