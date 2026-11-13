import {useEffect,useRef,useState} from 'react'
import type {DiagramType,ElementType,Project,ProjectDocument,Workspace} from '@atlas/contracts'
import {ArrowRight,Award,BookOpen,CheckCircle2,ChevronDown,ChevronUp,Clock3,FolderPlus,GraduationCap,Layers,LockKeyhole,Plus,Sparkles,X} from 'lucide-react'
import {assessAcademy} from './progress'
import type {AcademyCheck,AcademyLabIdentity} from './progress'
import './academy.css'

type Props={
 lab:AcademyLabIdentity|null;workspaces:Workspace[];projects:Project[];catalogLoading:boolean;activeWorkspaceId:string;activeProjectId:string
 doc:ProjectDocument|null;saveStatus:'saved'|'pending'|'saving'|'error';mode:'functional'|'technical'|'mixed';diagramId:string
 busy:boolean;paused?:boolean;error:string;onClose:()=>void;onStartTour:()=>void
 onCreateWorkspace:(name:string)=>Promise<void>;onCreateProject:(name:string)=>Promise<void>
 onGoToLab:()=>void;onOpenDiagram:(type:DiagramType,name:string)=>void;onSelectDiagram:(type:DiagramType)=>void
 onOpenNode:(type:ElementType,name:string,diagramType:DiagramType)=>void;onReuse:(diagramType:DiagramType)=>void
 onFocusLinkSource?:(sourceType:DiagramType,elementType:ElementType)=>void
 onMixed:()=>void;onOpenFields:(kind:'functional'|'technical')=>void;onInspectElement:(kind:'functional'|'technical')=>void
}
const ideas:Partial<Record<DiagramType,{name:string;items:{type:ElementType;name:string}[]}>>={
 c1:{name:'01 · Contexto de solicitudes',items:[{type:'actor',name:'Persona solicitante'},{type:'system',name:'Plataforma de solicitudes'},{type:'process',name:'Gestionar solicitud'}]},
 process:{name:'02 · Flujo de solicitudes',items:[{type:'activity',name:'Registrar solicitud'},{type:'activity',name:'Revisar solicitud'}]},
 trace:{name:'03 · Requisitos y casos de uso',items:[{type:'requirement',name:'HU-01 · Como usuario quiero registrar solicitudes'},{type:'requirement',name:'RF-01 · Validar campos obligatorios'},{type:'usecase',name:'CU-01 · Registrar solicitud'}]},
 c2:{name:'04 · Contenedores de solicitudes',items:[{type:'container',name:'Aplicación web'},{type:'service',name:'API de solicitudes'},{type:'database',name:'Base de datos de solicitudes'}]},
 c3:{name:'05 · Componentes de la API',items:[{type:'component',name:'Gestor de solicitudes'},{type:'endpoint',name:'POST /solicitudes'}]},
 c4:{name:'06 · Código de solicitudes',items:[{type:'component',name:'SolicitudController'},{type:'component',name:'SolicitudService'}]}
}
/** Browser-only coaching preference; no API writes, telemetry, or extra permissions. */
export const ACADEMY_HINT_STORAGE_KEY='atlas.academy.idle-hint.minutes.v1'
export type HintMinutes=0|1|2|3
export function readHintMinutes():HintMinutes{
 try{const stored=window.localStorage.getItem(ACADEMY_HINT_STORAGE_KEY);const value=Number(stored);return stored!==null&&(value===0||value===1||value===2||value===3)?value:2}
 catch{return 2}
}
function storeHintMinutes(value:HintMinutes){try{window.localStorage.setItem(ACADEMY_HINT_STORAGE_KEY,String(value))}catch{/* Storage may be disabled. */}}
type GuidanceDirection='up'|'down'|'visible'
export function guidanceDirection(target:{top:number;bottom:number},viewport:{top:number;bottom:number},margin=8):GuidanceDirection{
 if(target.bottom<viewport.top+margin)return 'up'
 if(target.top>viewport.bottom-margin)return 'down'
 return 'visible'
}

const c4LinkSteps=[
 {source:'c1' as const,type:'system' as const,target:'c2' as const,sourceName:'Plataforma de solicitudes',targetName:'04 · Contenedores de solicitudes',purpose:'Del sistema completo a las aplicaciones y servicios que lo componen'},
 {source:'c2' as const,type:'service' as const,target:'c3' as const,sourceName:'API de solicitudes',targetName:'05 · Componentes de la API',purpose:'De la API a sus componentes y endpoints internos'},
 {source:'c3' as const,type:'component' as const,target:'c4' as const,sourceName:'Gestor de solicitudes',targetName:'06 · Código de solicitudes',purpose:'Del componente a los módulos que realizan la implementación'}
]
const sections=[
 {id:'functional' as const,label:'1 · Modelado funcional',subtitle:'Entiende necesidades, historias y procesos.',badge:'Analista funcional',icon:BookOpen},
 {id:'technical' as const,label:'2 · Modelado técnico',subtitle:'Implementa esas mismas necesidades en contenedores y componentes.',badge:'Arquitecto técnico',icon:Layers},
 {id:'integration' as const,label:'3 · Integración mixta',subtitle:'No es un nuevo diagrama: es una lectura unificada de lo que creaste.',badge:'Arquitectura conectada',icon:Sparkles}
]
export default function AcademyMissions(props:Props){
 const [spaceName,setSpaceName]=useState('ATLAS · Academia personal')
 const [projectName,setProjectName]=useState('Laboratorio · Solicitudes')
 const [expanded,setExpanded]=useState<'functional'|'technical'|'integration'>('functional')
 const [hintMinutes,setHintMinutes]=useState<HintMinutes>(readHintMinutes)
 const [idle,setIdle]=useState(false)
 const [direction,setDirection]=useState<GuidanceDirection>('visible')
 const guidingRef=useRef(false)
 const scrollRef=useRef<HTMLDivElement>(null)
 const targetRef=useRef<HTMLDivElement>(null)

 const workspace=props.lab&&props.workspaces.find(w=>w.id===props.lab!.workspaceId)
 const project=workspace&&props.lab?.projectId&&props.projects.find(p=>p.id===props.lab!.projectId&&p.workspace_id===workspace.id)
 const atLab=Boolean(project&&props.activeProjectId===project.id&&props.activeWorkspaceId===workspace?.id)
 const assessment=assessAcademy(atLab?props.doc:null,atLab&&props.saveStatus==='saved',props.mode,props.diagramId)
 const badgeFlags={functional:assessment.functionalBadge,technical:assessment.technicalBadge,integration:assessment.integrationBadge}
 const existingTypes=new Set((atLab?props.doc?.diagrams:[])?.map(d=>d.type)||[])
 const blocked=!atLab||props.busy||props.saveStatus==='saving'||props.saveStatus==='pending'||props.saveStatus==='error'
 const currentChecks=assessment[expanded]
 const sectionLocked=expanded==='technical'&&!assessment.functionalBadge||expanded==='integration'&&!assessment.technicalBadge
 const target=atLab&&!sectionLocked?currentChecks.find(check=>!check.done):undefined
 const targetId=target?.id
 // A real inactivity timer for the entire ATLAS tab. Before the reminder,
 // any activity delays it. Once active, passive scrolling keeps the guide
 // visible so directional hints reappear when the target leaves the viewport.
 useEffect(()=>{
  if(!targetId||hintMinutes===0||props.busy||props.paused||props.saveStatus!=='saved'){guidingRef.current=false;setIdle(false);return}
  let timer:ReturnType<typeof setTimeout>
  let lastPointerMove=0
  const reset=()=>{guidingRef.current=false;setIdle(false);clearTimeout(timer);timer=setTimeout(()=>{guidingRef.current=true;setIdle(true)},hintMinutes*60_000)}
  const passiveActivity=()=>{if(!guidingRef.current)reset()}
  const onPointerMove=()=>{const now=Date.now();if(now-lastPointerMove>=600){lastPointerMove=now;passiveActivity()}}
  const activeEvents=['pointerdown','keydown','input'] as const
  const passiveEvents=['wheel','touchstart','scroll'] as const
  activeEvents.forEach(event=>window.addEventListener(event,reset,{passive:true,capture:true}))
  passiveEvents.forEach(event=>window.addEventListener(event,passiveActivity,{passive:true,capture:true}))
  window.addEventListener('pointermove',onPointerMove,{passive:true})
  reset()
  return()=>{clearTimeout(timer);activeEvents.forEach(event=>window.removeEventListener(event,reset,true));passiveEvents.forEach(event=>window.removeEventListener(event,passiveActivity,true));window.removeEventListener('pointermove',onPointerMove)}
 },[targetId,hintMinutes,props.busy,props.paused,props.saveStatus])
 // Directional prompt only appears while the highlighted action is outside
 // the Academy's actual scroll viewport; it vanishes as soon as it is visible.
 useEffect(()=>{
  if(!idle||!targetId){setDirection('visible');return}
  const content=scrollRef.current
  const update=()=>{
   const row=targetRef.current
   if(!row||!content){setDirection('visible');return}
   const el=row.querySelector('.academy-task-actions button:not(:disabled)')||row
   const b=el.getBoundingClientRect(),v=content.getBoundingClientRect()
   setDirection(guidanceDirection(b,v))
  }
  update()
  content?.addEventListener('scroll',update,{passive:true})
  window.addEventListener('resize',update)
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null
  if(content&&observer)observer.observe(content)
  if(targetRef.current&&observer)observer.observe(targetRef.current)
  return()=>{content?.removeEventListener('scroll',update);window.removeEventListener('resize',update);observer?.disconnect()}
 },[idle,targetId,expanded])
 const jumpToTarget=()=>{const row=targetRef.current;const focus=row?.querySelector('.academy-task-actions button:not(:disabled)')||row;focus?.scrollIntoView({behavior:'smooth',block:'center'})}
 const changeHintMinutes=(minutes:HintMinutes)=>{storeHintMinutes(minutes);setHintMinutes(minutes);guidingRef.current=false;setIdle(false)}

 const buttonFor=(check:AcademyCheck)=>{
  const type=check.diagramType
  if(!type)return null
  const idea=ideas[type]
  return <div className="academy-task-actions">
   {check.id==='functional-inspector'||check.id==='functional-field'||check.id==='technical-inspector'||check.id==='technical-field'?<>
    {check.id.endsWith('-field')&&<button type="button" className="academy-task-btn" disabled={blocked} onClick={()=>props.onOpenFields(check.id==='functional-field'?'functional':'technical')}><Plus size={13}/> Muéstrame dónde</button>}
    <button type="button" className="academy-task-btn" disabled={blocked||!existingTypes.has(type)} onClick={()=>props.onInspectElement(check.id.startsWith('functional')?'functional':'technical')}><ArrowRight size={13}/> Seleccionar la caja</button>
   </>:null}

   {!['functional-inspector','functional-field','technical-inspector','technical-field'].includes(check.id)&&(idea&&!existingTypes.has(type)?<button type="button" className="academy-task-btn" disabled={blocked} onClick={()=>props.onOpenDiagram(type,idea.name)}><Plus size={13}/> Crear {type.toUpperCase()}</button>:<button type="button" className="academy-task-btn" disabled={blocked||!existingTypes.has(type)} onClick={()=>props.onSelectDiagram(type)}><ArrowRight size={13}/> Ir al diagrama</button>)}
   {(check.id==='functional-reuse'||check.id==='technical-trace')&&<button type="button" className="academy-task-btn" disabled={blocked||!existingTypes.has(type)} onClick={()=>props.onReuse(type)}>Reutilizar caja</button>}
  </div>
 }
 return <section className="academy-missions" role="dialog" aria-modal="false" aria-label="Misiones prácticas de ATLAS" data-testid="atlas-academy-missions">
  <header className="academy-missions-header"><span><GraduationCap size={18}/> ATLAS Academy <small>Laboratorio práctico</small></span><button type="button" onClick={props.onClose} aria-label="Cerrar misiones"><X size={18}/></button></header>
  <div className="academy-missions-content" ref={scrollRef}>
   <div className="academy-intro"><h2>Aprende construyendo</h2><p>Tres insignias, un solo modelo. Cada insignia se valida con diagramas y conexiones <strong>guardados de verdad</strong>, no solo con clics.</p><button className="academy-text-link" onClick={props.onStartTour}><BookOpen size={14}/> Primero ver el recorrido explicativo</button></div>
   {props.catalogLoading?<div className="academy-onboarding" role="status"><h3>Recuperando tu laboratorio…</h3><p>Comprobamos los espacios y proyectos de tu cuenta antes de permitir nuevas creaciones.</p></div>:!workspace?<div className="academy-onboarding"><span className="academy-stage">PASO OBLIGATORIO 1 DE 2</span><h3><FolderPlus size={16}/> Crea tu espacio de formación</h3><p>Será una organización independiente para practicar, con sus propios permisos y proyectos. No cambia tus espacios de trabajo.</p><label>Nombre del espacio<input aria-label="Nombre del espacio de formación" value={spaceName} maxLength={80} onChange={event=>setSpaceName(event.target.value)}/></label><button type="button" className="academy-main-action" disabled={props.busy||spaceName.trim().length<2||props.saveStatus!=='saved'} onClick={()=>void props.onCreateWorkspace(spaceName.trim())}>{props.busy?'Creando...':'Crear mi organización de práctica'} <ArrowRight size={15}/></button></div>:
   !project?<div className="academy-onboarding"><span className="academy-stage">PASO OBLIGATORIO 2 DE 2</span><h3><FolderPlus size={16}/> Crea un proyecto de aprendizaje</h3><p><strong>{workspace.name}</strong> será su organización. Los ejercicios se guardarán en PostgreSQL, dentro de este proyecto separado.</p><label>Nombre del proyecto<input aria-label="Nombre del proyecto de formación" value={projectName} maxLength={80} onChange={event=>setProjectName(event.target.value)}/></label>{props.activeWorkspaceId!==workspace.id?<button className="academy-main-action" onClick={props.onGoToLab} disabled={props.busy||props.saveStatus!=='saved'}>Ir a la organización de práctica <ArrowRight size={15}/></button>:<button type="button" className="academy-main-action" disabled={props.busy||projectName.trim().length<2||props.saveStatus!=='saved'} onClick={()=>void props.onCreateProject(projectName.trim())}>{props.busy?'Creando...':'Crear mi proyecto de práctica'} <ArrowRight size={15}/></button>}</div>:
   !atLab?<div className="academy-onboarding"><h3>Vuelve a tu laboratorio</h3><p>El proyecto de prácticas es <strong>{project.name}</strong>, dentro de <strong>{workspace.name}</strong>. No evaluaremos otros proyectos.</p><button className="academy-main-action" onClick={props.onGoToLab} disabled={props.busy||props.saveStatus!=='saved'}>Abrir laboratorio <ArrowRight size={15}/></button></div>:
   <>
    <div className="academy-context"><CheckCircle2 size={16}/><span><strong>{workspace.name}</strong><small>{project.name}</small></span><span className={'academy-save '+(props.saveStatus==='saved'?'is-ok':'')}>{props.saveStatus==='saved'?'Guardado':props.saveStatus==='error'?'Error de guardado':'Pendiente de guardado'}</span></div>
    <div className="academy-badges" aria-label="Insignias de aprendizaje">
     {sections.map(s=><button key={s.id} type="button" className={'academy-badge '+(badgeFlags[s.id]?'unlocked':'')} onClick={()=>setExpanded(s.id)} aria-label={`${s.badge}: ${badgeFlags[s.id]?'conseguida':'pendiente'}`}><Award size={20}/><span>{s.badge}</span><small>{badgeFlags[s.id]?'Obtenida':'Por desbloquear'}</small></button>)}
    </div>
    {sections.map(s=>{const checks=assessment[s.id],passed=checks.filter(x=>x.done).length,locked=s.id==='technical'&&!assessment.functionalBadge||s.id==='integration'&&!assessment.technicalBadge
     return <section key={s.id} className="academy-course"><button type="button" className="academy-course-title" onClick={()=>setExpanded(old=>old===s.id?'functional':s.id)} aria-expanded={expanded===s.id}><span className={'academy-course-icon '+(badgeFlags[s.id]?'complete':'')}>{locked?<LockKeyhole size={17}/>:<s.icon size={17}/>}</span><span className="academy-course-copy"><strong>{s.label}</strong><small>{s.subtitle}</small></span><span className="academy-course-count">{passed}/{checks.length}</span>{expanded===s.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>
     {expanded===s.id&&<div className="academy-course-body">{locked?<p className="academy-lock-notice">{s.id==='technical'?'Termina los ejercicios funcionales y espera a que ATLAS confirme el guardado.':'La insignia mixta se desbloquea después de completar la arquitectura técnica vinculada.'}</p>:<>
       {checks.map((check,i)=><div key={check.id} ref={check.id===targetId?targetRef:undefined} data-academy-check={check.id} className={'academy-check '+(check.done?'done':'')+(idle&&targetId===check.id?' academy-attention':'')}><span className="academy-check-mark">{check.done?<CheckCircle2 size={16}/>:i+1}</span><div><strong>{check.title}</strong><p>{check.description}</p>{!check.done&&check.id==='technical-link'&&<div className="academy-c4-wizard" role="group" aria-label="Guía para enlazar los niveles C1 a C4">
 <p className="academy-c4-explanation"><strong>¿Qué significan C1, C2, C3 y C4?</strong> C1 es el mapa general del sistema; C2 muestra sus aplicaciones; C3 descompone una aplicación en componentes y C4 profundiza en la implementación. Cada caja puede abrir otra vista con doble clic.</p>
 <p className="academy-c4-explanation"><strong>Cómo se vinculan:</strong> no arrastres una línea entre diagramas. En la caja indicada abre el <strong>Inspector → Vista vinculada (doble clic)</strong>, selecciona la vista de destino y espera «Guardado». Después haz doble clic en la caja para comprobar la navegación.</p>
 {c4LinkSteps.map((step,index)=>{
  const from=props.doc?.diagrams.find(d=>d.type===step.source)
  const to=props.doc?.diagrams.find(d=>d.type===step.target)
  const sourceNode=from?.nodes.find(n=>props.doc?.elements[n.elementId]?.type===step.type)
  const source=sourceNode&&props.doc?.elements[sourceNode.elementId]
  const done=Boolean(source?.childDiagramId&&source.childDiagramId===to?.id&&props.saveStatus==='saved')
  return <div key={step.source} className={'academy-c4-link-step '+(done?'is-linked':'')}>
   <span className="academy-c4-step-count">{done?<CheckCircle2 size={15}/>:index+1}</span>
   <div className="academy-c4-step-detail"><strong>{step.source.toUpperCase()} → {step.target.toUpperCase()}</strong>
    <small>{step.sourceName} → {step.targetName}</small><p>{step.purpose}</p>
    {!done&&<button type="button" className="academy-task-btn" disabled={blocked||!from||!sourceNode} onClick={()=>props.onFocusLinkSource?props.onFocusLinkSource(step.source,step.type):props.onSelectDiagram(step.source)}><ArrowRight size={13}/> Seleccionar caja de {step.source.toUpperCase()}</button>}
    {done&&<span className="academy-c4-link-done">Vista vinculada correctamente</span>}
    {!sourceNode&&<small>Primero crea la caja indicada en el nivel {step.source.toUpperCase()}.</small>}
   </div>
  </div>
 })}
 </div>}{!check.done&&check.id==='c2'&&<p className="academy-relationship-tip" role="note">Para validar C2: conecta «Aplicación web» con «API de solicitudes» y «API de solicitudes» con «Base de datos de solicitudes». El sentido de las flechas no impide completar la práctica. Las conexiones solo cuentan cuando quedan guardadas.</p>}{!check.done&&check.id.endsWith('-field')&&<p className="academy-relationship-tip">Pulsa «Muéstrame dónde»: ATLAS seleccionará la caja y resaltará «Campos personalizados → Configurar» en el Inspector. Debes crear el campo tú mismo y asignarle un valor.</p>}{idle&&!check.done&&targetId===check.id&&<span className="academy-next-hint"><Sparkles size={12}/> Tu siguiente acción está aquí</span>}{!check.done&&buttonFor(check)}</div></div>)}
       {s.id!=='integration'&&<div className="academy-recipes"><strong>Guía para construir las cajas</strong><p>Elige un diagrama y añade estos elementos con los nombres sugeridos. Después conecta los puertos desde el lienzo.</p>{Object.entries(ideas).filter(([key])=>s.id==='functional'?['c1','process','trace'].includes(key):['c2','c3','c4'].includes(key)).map(([key,idea])=><div className="academy-recipe" key={key}><strong>{idea.name}</strong><div>{idea.items.map(item=><button key={item.name} disabled={blocked||!existingTypes.has(key as DiagramType)} type="button" onClick={()=>props.onOpenNode(item.type,item.name,key as DiagramType)} title={`Abrir formulario para crear ${item.type}`}>+ {item.name}</button>)}</div></div>)}</div>}
       {s.id==='integration'&&<button type="button" className="academy-main-action" disabled={blocked||!existingTypes.has('trace')} onClick={props.onMixed}>Abrir trazabilidad en modo mixto <ArrowRight size={15}/></button>}
       {badgeFlags[s.id]&&<p className="academy-earned" role="status"><Award size={15}/> ¡Insignia «{s.badge}» conseguida!</p>}
      </>}</div>}
    </section>})}
    <p className="academy-footnote">La Academia no genera componentes automáticamente ni acredita vistas vacías. Tus datos se guardan únicamente en la organización de formación que creaste. No es una base de datos físicamente independiente.</p>
   </>}
   {props.error&&<p className="academy-error" role="alert">{props.error}</p>}
  </div>
  <footer className="academy-coach-footer">
   {idle&&target&&direction!=='visible'&&<button type="button" className="academy-direction" onClick={jumpToTarget} aria-label={`${direction==='up'?'Sube':'Baja'} para encontrar tu siguiente acción`}>
    {direction==='up'?<ChevronUp size={17}/>:<ChevronDown size={17}/>}<span><strong>{direction==='up'?'Sube para continuar':'Baja para continuar'}</strong><small>{target.title}</small></span>{direction==='up'?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
   </button>}
   <label className="academy-idle-setting"><Clock3 size={13}/><span>Recordarme el paso tras</span><select aria-label="Tiempo de inactividad para recibir ayuda" value={hintMinutes} onChange={event=>changeHintMinutes(Number(event.target.value) as HintMinutes)}><option value={1}>1 minuto</option><option value={2}>2 minutos</option><option value={3}>3 minutos</option><option value={0}>Desactivado</option></select></label>
  </footer>
 </section>
}
