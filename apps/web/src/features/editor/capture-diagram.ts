import type {ExportField} from '@atlas/contracts'

/** Captura fiel del viewport React Flow. Los metadatos se colocan en una franja
 * exterior; no se superponen a nodos, conectores, puertos ni trazos existentes.
 * El título de cada ficha identifica inequívocamente su caja de origen.
 */
export async function captureDiagramPng(root:HTMLElement,embedded:Record<string,ExportField[]>={}):Promise<string>{
 const viewport=root.querySelector<HTMLElement>('.react-flow__viewport')
 if(!viewport)throw new Error('El diagrama aún no terminó de renderizarse')
 const nodes=[...viewport.querySelectorAll<HTMLElement>('.react-flow__node')]
 if(!nodes.length)throw new Error('No hay cajas visibles para exportar')
 const transform=getComputedStyle(viewport).transform
 const m=transform==='none'?new DOMMatrix():new DOMMatrix(transform),z=m.a||1
 const bounds=nodes.map(node=>{
  const rect=node.getBoundingClientRect(),parent=root.getBoundingClientRect()
  return {x:(rect.left-parent.left-m.e)/z,y:(rect.top-parent.top-m.f)/z,w:rect.width/z,h:rect.height/z}
 })
 // Reservar espacio también para rutas que rodean cajas o pasan fuera de ellas.
 const edgeBounds=[...viewport.querySelectorAll<SVGGraphicsElement>('.react-flow__edge-path')].flatMap(path=>{
  try{const box=path.getBBox();return Number.isFinite(box.x)&&Number.isFinite(box.y)?[{x:box.x,y:box.y,w:box.width,h:box.height}]:[]}
  catch{return []}
 })
 const sceneBounds=[...bounds,...edgeBounds]
 const minX=Math.min(...sceneBounds.map(b=>b.x)),minY=Math.min(...sceneBounds.map(b=>b.y))
 const maxX=Math.max(...sceneBounds.map(b=>b.x+b.w)),maxY=Math.max(...sceneBounds.map(b=>b.y+b.h))
 const cards=nodes.map(node=>({
  node,name:(node.querySelector('.node-title')?.textContent||'Elemento').trim(),
  fields:embedded[node.dataset.id||'']||[]
 })).filter(card=>card.fields.length>0)
 const padding=100,mainWidth=maxX-minX+2*padding,cardWidth=320,cardGap=26
 const approxRowHeight=(field:ExportField)=>Math.max(37,Math.ceil(Math.min(310,(field.label+': '+field.value).length)/39)*17+13)
 const cardHeight=(card:typeof cards[number])=>48+card.fields.slice(0,24).reduce((total,f)=>total+approxRowHeight(f),0)
 const sidebarHeight=cards.reduce((total,card)=>total+cardHeight(card)+18,0)
 const rawWidth=mainWidth+(cards.length?cardWidth+cardGap+padding:0)
 const rawHeight=Math.max(maxY-minY+padding*2,sidebarHeight+padding*2)
 const scale=Math.min(1,4000/rawWidth,4000/rawHeight,Math.sqrt(22_000_000/(rawWidth*rawHeight)))
 const width=Math.max(1,Math.ceil(rawWidth*scale)),height=Math.max(1,Math.ceil(rawHeight*scale))
 const clone=viewport.cloneNode(true) as HTMLElement
 const source=[viewport,...viewport.querySelectorAll('*')],target=[clone,...clone.querySelectorAll('*')]
 source.forEach((original,i)=>{
  const copied=target[i] as HTMLElement|SVGElement|undefined
  if(!copied)return
  const style=getComputedStyle(original)
  copied.setAttribute('style',Array.from(style).map(name=>`${name}:${style.getPropertyValue(name)};`).join(''))
 })
 clone.style.transform=`translate(${(padding-minX)*scale}px,${(padding-minY)*scale}px) scale(${scale})`
 clone.style.transformOrigin='0 0';clone.style.position='absolute';clone.style.top='0';clone.style.left='0'
 clone.style.width=`${rawWidth}px`;clone.style.height=`${rawHeight}px`
 const wrapper=document.createElement('div')
 wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml')
 wrapper.style.cssText=`position:relative;overflow:hidden;width:${width}px;height:${height}px;background:#f7faff;font-family:Arial,sans-serif;`
 wrapper.appendChild(clone)
 if(cards.length){
  // The right-side panel does NOT exist inside the React Flow viewport.
  const aside=document.createElement('div')
  aside.setAttribute('aria-label','Fichas de elementos exportadas')
  aside.style.cssText=`position:absolute;left:${(mainWidth+cardGap)*scale}px;top:${padding*scale}px;width:${cardWidth}px;transform:scale(${scale});transform-origin:0 0;box-sizing:border-box;`
  const header=document.createElement('div')
  header.textContent='Fichas de elementos · ATLAS'
  header.style.cssText='font:bold 14px Arial;color:#26466e;padding:0 0 12px;margin:0 0 8px;border-bottom:2px solid #cdddf3;'
  aside.appendChild(header)
  cards.forEach((card,i)=>{
   const box=document.createElement('div')
   box.style.cssText='background:#fff;border:1px solid #cbdcf0;border-left:4px solid #5682c4;border-radius:9px;padding:12px 13px;margin-bottom:16px;box-sizing:border-box;color:#243a59;font:12px/1.4 Arial,sans-serif;break-inside:avoid;'
   const title=document.createElement('strong')
   title.textContent=`${i+1}. ${card.name}`
   title.style.cssText='display:block;color:#294d80;padding-bottom:10px;font-size:13px;'
   box.appendChild(title)
   for(const field of card.fields.slice(0,24)){
    const row=document.createElement('div');row.style.cssText='padding:7px 0;border-top:1px solid #edf1f8;white-space:normal;overflow-wrap:anywhere;'
    const key=document.createElement('strong');key.textContent=field.label+': ';row.appendChild(key)
    const value=document.createElement('span');value.textContent=field.value.length>310?field.value.slice(0,310)+'…':field.value
    row.appendChild(value);box.appendChild(row)
   }
   aside.appendChild(box)
  })
  wrapper.appendChild(aside)
 }
 const serialized=new XMLSerializer().serializeToString(wrapper)
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`
 const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
 const image=new Image()
 await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('No fue posible capturar el diagrama'));image.src=url})
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
 const context=canvas.getContext('2d');if(!context)throw new Error('Canvas no disponible')
 context.fillStyle='#f7faff';context.fillRect(0,0,width,height);context.drawImage(image,0,0)
 const data=canvas.toDataURL('image/png')
 if(!data.startsWith('data:image/png;base64,'))throw new Error('Formato de captura inválido')
 return data.slice('data:image/png;base64,'.length)
}
