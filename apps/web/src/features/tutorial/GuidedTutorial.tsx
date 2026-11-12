import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react'
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronDown,X} from 'lucide-react'
import TutorialExercises from './TutorialExercises'
import {TUTORIAL_STEPS,TUTORIAL_STORAGE_KEY,TUTORIAL_PROGRESS_KEY} from './tutorial-content'

type Props={onClose:()=>void}
type Position={top:number;left:number;arrow:'top'|'bottom'|'none';focused:boolean}
const CARD_WIDTH=394
const MARGIN=12

function findAnchor(selector:string){
 const node=document.querySelector<HTMLElement>(`[data-tour="${selector}"]`)
 if(!node)return null
 const rect=node.getBoundingClientRect()
 // An element in a collapsed sidebar is not a visible anchor.
 if(rect.width<3||rect.height<3||rect.right<0||rect.left>window.innerWidth||rect.bottom<0||rect.top>window.innerHeight)return null
 return node
}
export function getPosition(anchor:HTMLElement|null,card?:HTMLElement|null):Position{
 const viewportWidth=Math.max(1,window.innerWidth)
 const viewportHeight=Math.max(1,window.innerHeight)
 const width=Math.min(card?.getBoundingClientRect().width||CARD_WIDTH,viewportWidth-2*MARGIN)
 const height=Math.min(card?.getBoundingClientRect().height||400,viewportHeight-2*MARGIN)
 const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
 const maxLeft=Math.max(MARGIN,viewportWidth-width-MARGIN)
 const maxTop=Math.max(MARGIN,viewportHeight-height-MARGIN)
 if(!anchor)return {top:clamp((viewportHeight-height)/2,MARGIN,maxTop),left:clamp((viewportWidth-width)/2,MARGIN,maxLeft),arrow:'none',focused:false}
 const r=anchor.getBoundingClientRect()
 const gap=16
 const alignTop=clamp(r.top-18,MARGIN,maxTop)
 // Place the coach beside the target when possible, without hiding it.
 if(r.right+gap+width+MARGIN<=viewportWidth)return {top:alignTop,left:clamp(r.right+gap,MARGIN,maxLeft),arrow:'none',focused:true}
 if(r.left-gap-width>=MARGIN)return {top:alignTop,left:clamp(r.left-gap-width,MARGIN,maxLeft),arrow:'none',focused:true}
 if(r.bottom+gap+height+MARGIN<=viewportHeight)return {top:clamp(r.bottom+gap,MARGIN,maxTop),left:clamp(r.left,MARGIN,maxLeft),arrow:'top',focused:true}
 if(r.top-gap-height>=MARGIN)return {top:clamp(r.top-gap-height,MARGIN,maxTop),left:clamp(r.left,MARGIN,maxLeft),arrow:'bottom',focused:true}
 // Huge anchors (the canvas) have no clear side: keep the tutorial fully in view.
 return {top:alignTop,left:clamp(r.left<viewportWidth/2?viewportWidth-width-MARGIN:MARGIN,MARGIN,maxLeft),arrow:'none',focused:true}
}
/**
 * Non-modal coaching: the highlighted controls stay usable; all exercises are local.
 * The tutorial never writes to the API, never imports documents, and never edits the model.
 */
export default function GuidedTutorial({onClose}:Props){
 const [index,setIndex]=useState(()=>{try{const n=Number(window.localStorage.getItem(TUTORIAL_PROGRESS_KEY));return Number.isInteger(n)&&n>=0&&n<TUTORIAL_STEPS.length?n:0}catch{return 0}})
 const [completedExercises,setCompletedExercises]=useState<string[]>([])
 const [position,setPosition]=useState<Position>({top:70,left:20,arrow:'none',focused:false})
 const [showIndex,setShowIndex]=useState(false)
 const panelRef=useRef<HTMLElement>(null)
 const priorFocus=useRef<HTMLElement|null>(null)
 const headingId=useId()
 const step=TUTORIAL_STEPS[index]
 const isFinal=index===TUTORIAL_STEPS.length-1
 useEffect(()=>{
  priorFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null
  return()=>{priorFocus.current?.focus()}
 },[])
 useEffect(()=>{panelRef.current?.focus();try{window.localStorage.setItem(TUTORIAL_PROGRESS_KEY,String(index))}catch{/* storage denied */}},[index])
 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose()}
   if(event.key==='ArrowRight'&&event.altKey){event.preventDefault();setIndex(i=>Math.min(TUTORIAL_STEPS.length-1,i+1))}
   if(event.key==='ArrowLeft'&&event.altKey){event.preventDefault();setIndex(i=>Math.max(0,i-1))}
  }
  document.addEventListener('keydown',keydown)
  return()=>document.removeEventListener('keydown',keydown)
 },[onClose])
 useLayoutEffect(()=>{
  let focus:HTMLElement|null=null
  let frame=0
  const refresh=()=>{
   const next=findAnchor(step.target)
   if(focus!==next){focus?.classList.remove('atlas-tour-highlight');focus=next;focus?.classList.add('atlas-tour-highlight')}
   const computed=getPosition(next,panelRef.current)
   setPosition(previous=>previous.top===computed.top&&previous.left===computed.left&&previous.focused===computed.focused&&previous.arrow===computed.arrow?previous:computed)
  }
  // Measure real card height: the previous fixed estimate clipped long lessons.
  frame=typeof window.requestAnimationFrame==='function'?window.requestAnimationFrame(refresh):window.setTimeout(refresh,0)
  const observer=typeof ResizeObserver!=='undefined'&&panelRef.current?new ResizeObserver(refresh):null
  if(observer&&panelRef.current)observer.observe(panelRef.current)
  window.addEventListener('scroll',refresh,true)
  window.addEventListener('resize',refresh)
  return()=>{
   if(typeof window.cancelAnimationFrame==='function')window.cancelAnimationFrame(frame);else window.clearTimeout(frame)
   window.removeEventListener('scroll',refresh,true)
   window.removeEventListener('resize',refresh)
   observer?.disconnect()
   focus?.classList.remove('atlas-tour-highlight')
  }
 },[step.target,index,showIndex])
 const finish=()=>{try{window.localStorage.setItem(TUTORIAL_STORAGE_KEY,new Date().toISOString());window.localStorage.removeItem(TUTORIAL_PROGRESS_KEY)}catch{/* blocked storage must not prevent learning */}onClose()}
 return <div className="atlas-tour-root" data-testid="atlas-guided-tutorial">
  <div className="atlas-tour-live-region" aria-live="polite" aria-atomic="true">Paso {index+1} de {TUTORIAL_STEPS.length}: {step.title}</div>
  <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby={headingId} className={'atlas-tour-card '+(position.focused?'is-anchored ':'')+(position.arrow!=='none'?`arrow-${position.arrow}`:'')} style={{top:position.top,left:position.left}}>
   <div className="atlas-tour-header"><div className="atlas-tour-brand"><BookOpen size={17}/><span>ACADEMIA ATLAS</span></div><button type="button" className="atlas-tour-close" aria-label="Cerrar tutorial" title="Cerrar tutorial" onClick={onClose}><X size={17}/></button></div>
   <div className="atlas-tour-body">
    <div className="atlas-tour-step-info"><span>{step.category}</span><span>{index+1} / {TUTORIAL_STEPS.length}</span></div>
    <div className="atlas-tour-progress" role="progressbar" aria-label="Progreso del tutorial" aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={TUTORIAL_STEPS.length}><span style={{width:`${((index+1)/TUTORIAL_STEPS.length)*100}%`}}/></div>
    <h2 id={headingId}>{step.title}</h2>
    <p className="atlas-tour-instruction">{step.instruction}</p>
    <div className="atlas-tour-why"><strong>¿Para qué sirve?</strong><p>{step.why}</p></div>
    {step.example&&<p className="atlas-tour-example"><strong>Ejemplo ATLAS:</strong> {step.example}</p>}
    {step.exercise&&<TutorialExercises key={step.id} kind={step.exercise} onComplete={()=>setCompletedExercises(previous=>previous.includes(step.id)?previous:[...previous,step.id])}/>}
    {!position.focused&&<p className="atlas-tour-unavailable">Este control no está visible ahora (por el tamaño de pantalla, el estado del proyecto o tus permisos). Puedes continuar; no necesitas editar nada.</p>}
    {step.exercise&&completedExercises.includes(step.id)&&<div className="atlas-tour-lesson-done"><CheckCircle2 size={14}/> Práctica completada</div>}
   </div>
   {showIndex&&<div className="atlas-tour-index" id="atlas-tour-contents" role="navigation" aria-label="Temario del tutorial">{TUTORIAL_STEPS.map((item,i)=><button type="button" className={i===index?'is-current':''} key={item.id} onClick={()=>{setIndex(i);setShowIndex(false)}}>{i+1}. {item.title}</button>)}</div>}
   <div className="atlas-tour-bottom">
    <button type="button" className="atlas-tour-index-toggle" onClick={()=>setShowIndex(v=>!v)} aria-expanded={showIndex} aria-controls="atlas-tour-contents">Temario <ChevronDown size={13}/></button>
    <div className="atlas-tour-actions"><button type="button" className="ghost" onClick={()=>setIndex(i=>Math.max(0,i-1))} disabled={index===0}><ArrowLeft size={14}/> Anterior</button><button type="button" className="primary" onClick={isFinal?finish:()=>setIndex(i=>Math.min(i+1,TUTORIAL_STEPS.length-1))}>{isFinal?'Finalizar':'Siguiente'}{!isFinal&&<ArrowRight size={14}/>}</button></div>
   </div>
  </section>
 </div>
}
