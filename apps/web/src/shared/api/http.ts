const apiRoot=(import.meta.env?.VITE_API_BASE_URL||'').trim().replace(/\/$/,'')
let csrfToken=''
export const setCsrf=(value:string)=>{csrfToken=value}
export const cloudEnabled=true // closed multi-user API; no unauthenticated demo mode
export async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 const method=String(options.method||'GET').toUpperCase()
 const headers:Record<string,string>={'Content-Type':'application/json',...(options.headers as Record<string,string>||{})}
 if(!['GET','HEAD','OPTIONS'].includes(method)&&csrfToken)headers['X-CSRF-Token']=csrfToken
 const endpoint=`${apiRoot}/api/v1${path}`
 let response:Response
 try{response=await fetch(endpoint,{...options,headers,credentials:'include',cache:'no-store'})}
 catch{throw new Error(`API no disponible (${endpoint}). Inicia el backend y revisa CORS_ORIGINS.`)}
 const body=await response.json().catch(()=>({})) as Record<string,unknown>
 if(!response.ok)throw new Error(typeof body.message==='string'?body.message:`Error HTTP ${response.status}`)
 return body as T
}
