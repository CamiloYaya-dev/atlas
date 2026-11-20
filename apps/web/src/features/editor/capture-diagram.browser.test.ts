import {test,expect,vi,afterEach} from 'vitest'
import {captureDiagramPng} from './capture-diagram'
import type {ExportField} from '@novzi/contracts'
const box=(x:number,y:number,width:number,height:number)=>({x,y,left:x,top:y,right:x+width,bottom:y+height,width,height,toJSON:()=>({})}) as DOMRect
function scene(){
 const root=document.createElement('div');root.innerHTML='<div class="react-flow__viewport"><div class="react-flow__node" data-id="a"><span class="node-title">Cuenta QA</span></div><div class="react-flow__node" data-id="b">Sin título</div><svg><path class="react-flow__edge-path" d="M 0 0 L 20 20"/><path class="react-flow__edge-path"/><path class="react-flow__edge-path"/></svg></div>'
 document.body.appendChild(root);vi.spyOn(root,'getBoundingClientRect').mockReturnValue(box(10,20,900,700));const nodes=root.querySelectorAll<HTMLElement>('.react-flow__node');vi.spyOn(nodes[0],'getBoundingClientRect').mockReturnValue(box(60,70,100,60));vi.spyOn(nodes[1],'getBoundingClientRect').mockReturnValue(box(310,170,120,80));const paths=root.querySelectorAll('path');Object.defineProperty(paths[0],'getBBox',{value:()=>({x:-30,y:-40,width:500,height:200})});Object.defineProperty(paths[1],'getBBox',{value:()=>{throw new Error('no disponible')}});Object.defineProperty(paths[2],'getBBox',{value:()=>({x:NaN,y:0,width:0,height:0})});return root
}
function raster({error=false,context=true,format='data:image/png;base64,QUJD'}={}){
 let source='';const drawImage=vi.fn(),fillRect=vi.fn()
 // jsdom does not implement browser rasterization. Preserve the real SVG/DOM
 // serialization and assert its inputs; only the image decoder/canvas are faked.
 vi.stubGlobal('DOMMatrix',class {a=1;e=0;f=0;constructor(value?:string){if(value?.includes('matrix(')){const parts=value.slice(7,-1).split(',').map(Number);this.a=parts[0];this.e=parts[4];this.f=parts[5]}}})
 vi.stubGlobal('Image',class {onload?:()=>void;onerror?:()=>void;set src(value:string){source=value;queueMicrotask(()=>error?this.onerror?.():this.onload?.())}})
 const get=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>context?{fillStyle:'',fillRect,drawImage}:null) as unknown as typeof HTMLCanvasElement.prototype.getContext)
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue(format)
 return {get,drawImage,fillRect,svg:()=>decodeURIComponent(source.split(',').slice(1).join(','))}
}
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML=''})
test('exportación rechaza lienzo todavía no montado y diagrama sin cajas',async()=>{
 const root=document.createElement('div');await expect(captureDiagramPng(root)).rejects.toThrow('aún no terminó');root.innerHTML='<div class="react-flow__viewport"></div>';await expect(captureDiagramPng(root)).rejects.toThrow('No hay cajas')
})
test('captura incluye extremos de relaciones y escala en SVG sin alterar el viewport original',async()=>{
 const root=scene(),r=raster();const before=root.innerHTML;const png=await captureDiagramPng(root);expect(png).toBe('QUJD');expect(r.svg()).toContain('width="700"');expect(r.svg()).toContain('Cuenta QA');expect(r.svg()).not.toContain('Fichas de elementos');expect(r.drawImage).toHaveBeenCalledTimes(1);expect(r.fillRect).toHaveBeenCalledWith(0,0,700,470);expect(root.innerHTML).toBe(before)
})
test('metadatos se exportan en franja aparte, limitados y con texto escapado',async()=>{
 const root=scene(),r=raster();const fields:ExportField[]=Array.from({length:25},(_,i)=>({key:String(i),label:`Campo${i}`,value:i===0?'<script>NO</script>'+ 'x'.repeat(400):`Valor ${i}`}));await captureDiagramPng(root,{a:fields,b:[{key:'last',label:'Estado',value:'Aprobado'}]});const source=r.svg();expect(source).toContain('Fichas de elementos');expect(source).toContain('1. Cuenta QA');expect(source).toContain('2. Elemento');expect(source).toContain('Campo23');expect(source).not.toContain('Campo24');expect(source).toContain('&lt;script&gt;NO&lt;/script&gt;');expect(source).not.toContain('<script>NO</script>');expect(source).toContain('…');expect(source).toContain('Aprobado')
})
test('captura con zoom y escena muy grande mantiene límite de 4000 px',async()=>{
 const root=scene(),r=raster();const v=root.querySelector<HTMLElement>('.react-flow__viewport')!;v.style.transform='matrix(2, 0, 0, 2, 40, 80)';vi.spyOn(root.querySelector('.react-flow__node')!,'getBoundingClientRect').mockReturnValue(box(0,0,18000,17000));await captureDiagramPng(root);const match=r.svg().match(/<svg[^>]*width="(\d+)" height="(\d+)"/)!;expect(Number(match[1])).toBeLessThanOrEqual(4000);expect(Number(match[2])).toBeLessThanOrEqual(4000);expect(Number(match[1])*Number(match[2])).toBeLessThanOrEqual(22000000)
})
test('errores de imagen y canvas se propagan sin informar exportación exitosa',async()=>{
 const root=scene();raster({error:true});await expect(captureDiagramPng(root)).rejects.toThrow('No fue posible capturar');vi.restoreAllMocks();raster({context:false});await expect(captureDiagramPng(root)).rejects.toThrow('Canvas no disponible');vi.restoreAllMocks();raster({format:'data:image/jpeg;base64,QUJD'});await expect(captureDiagramPng(root)).rejects.toThrow('Formato de captura inválido')
})


test('captura con transform none y caja sin identificador conserva una imagen válida',async()=>{
 const root=scene(),r=raster();root.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform='none';root.querySelector<HTMLElement>('.react-flow__node')!.removeAttribute('data-id')
 expect(await captureDiagramPng(root)).toBe('QUJD');expect(r.svg()).toContain('Cuenta QA');expect(r.drawImage).toHaveBeenCalledOnce()
})


test('captura reduce PNG demasiado grande antes de enviar imagen al backend',async()=>{
 const root=scene(),r=raster()
 const data=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL')
 data.mockReset().mockReturnValueOnce('data:image/png;base64,'+'A'.repeat(5_500_100)).mockReturnValue('data:image/png;base64,QUJD')
 expect(await captureDiagramPng(root)).toBe('QUJD')
 expect(data).toHaveBeenCalledTimes(2)
 expect(r.drawImage.mock.calls.length).toBeGreaterThan(1)
})
