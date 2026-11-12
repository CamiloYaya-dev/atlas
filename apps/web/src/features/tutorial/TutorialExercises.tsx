import {useEffect,useState} from 'react'
import type {ExerciseKind} from './tutorial-content'

type Props={kind:ExerciseKind;onComplete:()=>void}
/** Exercises simulate actions only; they never call APIs or modify a ProjectDocument. */
export default function TutorialExercises({kind,onComplete}:Props){
 const [level,setLevel]=useState(0)
 const [perspective,setPerspective]=useState('functional')
 const [source,setSource]=useState(false)
 const [complete,setComplete]=useState(false)
 useEffect(()=>{setLevel(0);setPerspective('functional');setSource(false);setComplete(false)},[kind])
 const finish=()=>{if(!complete){setComplete(true);onComplete()}}
 const sequence=kind==='hierarchy'?['Organización','Proyecto','Diagrama']:['C1 · Contexto','C2 · Contenedores','C3 · Componentes','C4 · Código']
 if(kind==='hierarchy'||kind==='drill')return <div className="tour-exercise" aria-label="Ejercicio de navegación">
  <strong>Mini práctica · Sigue la jerarquía</strong>
  <p>Selecciona los niveles en orden. Esto es una simulación; no crea nada.</p>
  <div className="tour-exercise-tiles">{sequence.map((name,index)=><button type="button" key={name} className={index<level?'is-done':''} disabled={index!==level} onClick={()=>{setLevel(index+1);if(index+1===sequence.length)finish()}}>{index<level?'✓ ':''}{name}</button>)}</div>
  {complete&&<p role="status" className="tour-exercise-success">Recorrido completo. Los niveles están conectados.</p>}
 </div>
 if(kind==='perspective')return <div className="tour-exercise" aria-label="Ejercicio de perspectivas">
  <strong>Mini práctica · Tres lecturas, un modelo</strong>
  <div className="tour-exercise-tiles">{[['functional','Funcional'],['mixed','Mixta'],['technical','Técnica']].map(([value,label])=><button type="button" className={perspective===value?'is-active':''} key={value} onClick={()=>{setPerspective(value);if(value==='technical')finish()}}>{label}</button>)}</div>
  <p className="tour-exercise-preview">{perspective==='functional'?'Funcional: una persona crea un diagrama y recibe confirmación de guardado.':perspective==='technical'?'Técnica: una petición a la API verifica la versión y persiste el documento.':'Mixta: el guardado del diagrama se conecta con el servicio de proyectos.'}</p>
  {complete&&<p className="tour-exercise-success" role="status">Ahora viste las tres perspectivas.</p>}
 </div>
 if(kind==='relation')return <div className="tour-exercise" aria-label="Ejercicio de relaciones">
  <strong>Mini práctica · Relaciona dos cajas</strong><p>Pulsa primero la caja origen y después el destino.</p>
  <div className="tour-exercise-flow"><button type="button" className={source?'is-active':''} onClick={()=>{setSource(true);setComplete(false)}}>Editor web</button><span aria-hidden="true">{source?'→':'···'}</span><button type="button" disabled={!source} className={complete?'is-done':''} onClick={finish}>API de proyectos</button></div>
  {complete&&<p className="tour-exercise-success" role="status">Relación creada en la simulación: «Editor web guarda cambios en API de proyectos».</p>}
 </div>
 if(kind==='link')return <div className="tour-exercise" aria-label="Ejercicio de navegación entre diagramas">
  <strong>Mini práctica · Vincula una vista hija</strong><p>Elige la caja origen y asígnale el diagrama que mostrará al profundizar.</p>
  <div className="tour-exercise-flow"><button type="button" onClick={()=>setSource(true)} className={source?'is-active':''}>API de proyectos</button><span aria-hidden="true">{source?'→':'···'}</span><button type="button" disabled={!source} className={complete?'is-done':''} onClick={finish}>C3 · Proyectos</button></div>
  {complete&&<p className="tour-exercise-success" role="status">Al hacer doble clic, esta caja abriría el diagrama C3.</p>}
 </div>
 return <div className="tour-exercise" aria-label="Ejercicio de reutilización">
  <strong>Mini práctica · Una ficha, dos vistas</strong><p>Reutiliza un servicio existente en otro diagrama.</p>
  <div className="tour-exercise-flow"><span className="tour-demo-tile">C3 · Servicio de proyectos</span><span aria-hidden="true">→</span><button className={complete?'is-done':''} type="button" onClick={finish}>Añadir a trazabilidad</button></div>
  {complete&&<p className="tour-exercise-success" role="status">Mismo elemento y ficha, en dos diagramas. Sin duplicación.</p>}
 </div>
}
