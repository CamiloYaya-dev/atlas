import type {ProjectDocument} from '@atlas/contracts'
export type RevisionChange={kind:'Diagrama'|'Elemento'|'Campo';action:'Agregado'|'Eliminado'|'Modificado';name:string;fields?:string[]}
/** Only compares data returned by the API after current ACL filtering. */
export function compareVersions(before:ProjectDocument,after:ProjectDocument):RevisionChange[]{
 const changes:RevisionChange[]=[]
 const check=(kind:RevisionChange['kind'],left:Record<string,unknown>,right:Record<string,unknown>)=>{
  for(const id of new Set([...Object.keys(left),...Object.keys(right)])){
   const old=left[id] as {name?:string;label?:string}|undefined
   const next=right[id] as {name?:string;label?:string}|undefined
   if(JSON.stringify(old)===JSON.stringify(next))continue
   const fields=old&&next?Array.from(new Set([...Object.keys(old),...Object.keys(next)]))
    .filter(k=>JSON.stringify((old as Record<string,unknown>)[k])!==JSON.stringify((next as Record<string,unknown>)[k])):[]
   const labels:Record<string,string>={name:'nombre',description:'descripción',summary:'resumen',status:'estado',owner:'responsable',links:'enlaces',fields:'campos personalizados',nodes:'cajas',edges:'relaciones',type:'tipo',label:'etiqueta',kind:'tipo de dato',options:'opciones',technical:'detalles técnicos'}
   changes.push({kind,action:old?(next?'Modificado':'Eliminado'):'Agregado',name:next?.name||next?.label||old?.name||old?.label||id,fields:fields.map(x=>labels[x]||x)})
  }
 }
 check('Diagrama',Object.fromEntries(before.diagrams.map(x=>[x.id,x])),Object.fromEntries(after.diagrams.map(x=>[x.id,x])))
 check('Elemento',before.elements,after.elements)
 check('Campo',Object.fromEntries(before.fieldDefinitions.map(x=>[x.id,x])),Object.fromEntries(after.fieldDefinitions.map(x=>[x.id,x])))
 return changes
}
