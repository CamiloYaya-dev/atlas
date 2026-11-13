const apiRoot=(import.meta.env?.VITE_API_BASE_URL||'').trim().replace(/\/$/,'')
export const projectEventsUrl=(projectId:string,clientId:string)=>`${apiRoot}/api/v1/projects/${encodeURIComponent(projectId)}/events?clientId=${encodeURIComponent(clientId)}`
let csrfToken=''
export const setCsrf=(value:string)=>{csrfToken=value}
export const cloudEnabled=true // closed multi-user API; no unauthenticated demo mode
export async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 const method=String(options.method||'GET').toUpperCase()
 const hasJsonBody=typeof options.body==='string'&&options.body.trim().length>0
 const headers:Record<string,string>={...(hasJsonBody?{'Content-Type':'application/json'}:{}),...(options.headers as Record<string,string>||{})}
 if(!hasJsonBody&&method==='DELETE'){delete headers['Content-Type'];delete headers['content-type']}
 if(!['GET','HEAD','OPTIONS'].includes(method)&&csrfToken)headers['X-CSRF-Token']=csrfToken
 const endpoint=`${apiRoot}/api/v1${path}`
 let response:Response
 try{response=await fetch(endpoint,{...options,headers,credentials:'include',cache:'no-store'})}
 catch{throw new Error(`API no disponible (${endpoint}). Inicia el backend y revisa CORS_ORIGINS.`)}
 const body=await response.json().catch(()=>({})) as Record<string,unknown>
 if(!response.ok)throw new Error(typeof body.message==='string'?body.message:`Error HTTP ${response.status}`)
 return body as T
}

/** Archivo binario: mantiene las mismas cookies, CSRF y tratamiento de errores que request(). */
export async function requestFile(path:string,payload:unknown):Promise<{blob:Blob;exportId:string|null}>{
 const endpoint=`${apiRoot}/api/v1${path}`
 let response:Response
 try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(csrfToken?{'X-CSRF-Token':csrfToken}:{})},credentials:'include',cache:'no-store',body:JSON.stringify(payload)})}
 catch{throw new Error('No se pudo conectar con la API de exportaciones')}
 if(!response.ok){const body=await response.json().catch(()=>({})) as {message?:string};throw new Error(body.message||`Error HTTP ${response.status}`)}
 return {blob:await response.blob(),exportId:response.headers.get('X-ATLAS-Export-Id')}
}
