import {test,expect,vi,afterEach} from 'vitest'
import {requestFile,setCsrf,projectEventsUrl} from './http'
afterEach(()=>{setCsrf('');vi.unstubAllGlobals()})
test('descarga binaria conserva cookies, CSRF, contenido e ID de auditoría',async()=>{
 const response=new Response('archivo QA',{status:200,headers:{'X-NOVZI-Export-Id':'audit-qa','Content-Type':'application/pdf'}});const fetch=vi.fn().mockResolvedValue(response);vi.stubGlobal('fetch',fetch);setCsrf('csrf-qa');const result=await requestFile('/exports',{format:'pdf'});expect(result.exportId).toBe('audit-qa');expect(result.blob.size).toBe(10);expect(result.blob.type).toBe('application/pdf');expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/exports'),{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':'csrf-qa'},credentials:'include',cache:'no-store',body:'{"format":"pdf"}'})
})
test('descarga sin CSRF ni auditoría conserva datos y no inventa cabeceras',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('QA',{status:200}));vi.stubGlobal('fetch',fetch);const result=await requestFile('/exports',{});expect(result.exportId).toBeNull();expect(fetch.mock.calls[0][1].headers).toEqual({'Content-Type':'application/json'})
})
test('descarga diferencia rechazo de licencia, respuesta no JSON y fallo de red',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({message:'Requiere PRO'}),{status:403})).mockResolvedValueOnce(new Response('gateway',{status:502})).mockRejectedValueOnce(new Error('offline'));vi.stubGlobal('fetch',fetch);await expect(requestFile('/exports',{})).rejects.toThrow('Requiere PRO');await expect(requestFile('/exports',{})).rejects.toThrow('Error HTTP 502');await expect(requestFile('/exports',{})).rejects.toThrow('No se pudo conectar')
})
test('SSE escapa identificadores para no alterar ruta ni parámetros',()=>{
 expect(projectEventsUrl('p/1','a&b=c')).toContain('/api/v1/projects/p%2F1/events?clientId=a%26b%3Dc')
})
