import type {ExportField} from '@atlas/contracts'

/** Export only the actual React Flow scene: nodes, labels, all ports and SVG edge paths.
 * No independent reconstruction of edge geometry. The backend controls licenses,
 * applies the watermark and signs the resulting pixels. */
export async function captureDiagramPng(root:HTMLElement,embedded:Record<string,ExportField[]>={}):Promise<string>{
 const viewport=root.querySelector<HTMLElement>('.react-flow__viewport')
 if(!viewport)throw new Error('El diagrama aún no terminó de renderizarse')
 const nodes=[...viewport.querySelectorAll<HTMLElement>('.react-flow__node')]
 if(!nodes.length)throw new Error('No hay cajas visibles para exportar')
 const transform=getComputedStyle(viewport).transform
 const m=transform==='none'?new DOMMatrix():new DOMMatrix(transform)
 const z=m.a||1
 const bounds=nodes.map(node=>{
  const r=node.getBoundingClientRect(),parent=root.getBoundingClientRect()
  return {x:(r.left-parent.left-m.e)/z,y:(r.top-parent.top-m.f)/z,w:r.width/z,h:r.height/z}
 })
 const minX=Math.min(...bounds.map(b=>b.x)),minY=Math.min(...bounds.map(b=>b.y))
 const maxX=Math.max(...bounds.map(b=>b.x+b.w))
 // La ficha de exportación se coloca junto a la caja, sin cambiar su geometría ni las rutas de las flechas.
 const embeddedHeight=(id:string)=>Math.min(24,embedded[id]?.length||0)*58+(embedded[id]?.length?48:0)
 const maxY=Math.max(...bounds.map((b,i)=>b.y+b.h+embeddedHeight(nodes[i].dataset.id||'')))
 const padding=110,rawWidth=maxX-minX+padding*2,rawHeight=maxY-minY+padding*2
 const scale=Math.min(1,3200/rawWidth,3200/rawHeight,Math.sqrt(18_000_000/(rawWidth*rawHeight)))
 const width=Math.max(1,Math.ceil(rawWidth*scale)),height=Math.max(1,Math.ceil(rawHeight*scale))
 const clone=viewport.cloneNode(true) as HTMLElement
 const originalElements=[viewport,...viewport.querySelectorAll('*')]
 const copiedElements=[clone,...clone.querySelectorAll('*')]
 originalElements.forEach((original,i)=>{
  const copy=copiedElements[i] as HTMLElement|SVGElement|undefined
  if(!copy)return
  const style=getComputedStyle(original)
  const inline=Array.from(style).map(name=>`${name}:${style.getPropertyValue(name)};`).join('')
  copy.setAttribute('style',inline)
 })
 // Tarjetas no interactivas exclusivamente para exportación. El diagrama original no cambia.
 for(const node of clone.querySelectorAll<HTMLElement>('.react-flow__node')){
  const fields=embedded[node.dataset.id||'']||[]
  if(!fields.length)continue
  const box=document.createElement('div')
  box.style.cssText='position:absolute;top:calc(100% + 8px);left:0;width:100%;background:#fff;border:1px solid #cbdcf0;border-radius:8px;box-shadow:0 3px 10px #182f4c20;padding:10px;box-sizing:border-box;color:#243a59;font:12px/1.35 Arial,sans-serif;z-index:20;'
  const heading=document.createElement('strong');heading.textContent='Campos del elemento';heading.style.cssText='display:block;margin-bottom:6px;color:#365e98;';box.appendChild(heading)
  for(const field of fields.slice(0,24)){
   const row=document.createElement('div');row.style.cssText='display:block;white-space:normal;overflow-wrap:anywhere;padding:5px 0;border-top:1px solid #edf1f8;max-height:48px;overflow:hidden;'
   const key=document.createElement('strong');key.textContent=field.label+': ';row.appendChild(key)
   const value=document.createElement('span');value.textContent=field.value.length>300?field.value.slice(0,300)+'…':field.value;row.appendChild(value);box.appendChild(row)
  }
  node.appendChild(box)
 }
 clone.style.transform=`translate(${(padding-minX)*scale}px,${(padding-minY)*scale}px) scale(${scale})`
 clone.style.transformOrigin='0 0'
 clone.style.position='absolute'
 clone.style.top='0';clone.style.left='0'
 clone.style.width=`${rawWidth}px`;clone.style.height=`${rawHeight}px`
 const wrapper=document.createElement('div')
 wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml')
 wrapper.style.cssText=`position:relative;overflow:hidden;width:${width}px;height:${height}px;background:#f7faff;font-family:Arial,sans-serif;`
 wrapper.appendChild(clone)
 const serialized=new XMLSerializer().serializeToString(wrapper)
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`
 const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
 try{
  const image=new Image()
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('No fue posible capturar el diagrama'));image.src=url})
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas no disponible')
  ctx.fillStyle='#f7faff';ctx.fillRect(0,0,width,height)
  ctx.drawImage(image,0,0)
  const data=canvas.toDataURL('image/png')
  if(!data.startsWith('data:image/png;base64,'))throw new Error('Formato de captura inválido')
  return data.slice('data:image/png;base64,'.length)
 }finally{/* data URL, no object URL to release */}
}
