import {isDeepStrictEqual} from 'node:util'
import type {PoolClient} from 'pg'
import type {Diagram,ModelElement,ProjectDocument} from '@novzi/contracts'

type Snapshot={diagram:Diagram;elements:Record<string,ModelElement>}
/** Sólo captura las fichas usadas en una vista; nunca copia todo el proyecto. */
export function diagramSnapshot(document:ProjectDocument,id:string):Snapshot|null{
 const diagram=document.diagrams.find(item=>item.id===id)
 if(!diagram)return null
 const elements:Record<string,ModelElement>={}
 for(const node of diagram.nodes){const element=document.elements[node.elementId];if(element)elements[node.elementId]=element}
 return {diagram,elements}
}
export function affectedDiagramIds(before:ProjectDocument,after:ProjectDocument):string[]{
 const ids=new Set([...before.diagrams.map(d=>d.id),...after.diagrams.map(d=>d.id)])
 return [...ids].filter(id=>!isDeepStrictEqual(diagramSnapshot(before,id),diagramSnapshot(after,id)))
}
const AUTO_WINDOW_MS=10*60*1000
/**
 * Cursor (por cada cambio guardado) != checkpoint visible (agrupado).
 * Se invoca bajo el bloqueo FOR UPDATE del documento de proyecto.
 * Una edición en C2 no incrementa el cursor del proceso, ni viceversa.
 */
export async function recordDiagramChanges(client:Pick<PoolClient,'query'>,projectId:string,before:ProjectDocument,after:ProjectDocument,projectCursor:number,actorId:string,automatic=true){
 const changed=affectedDiagramIds(before,after)
 for(const diagramId of changed){
  const snapshot=diagramSnapshot(after,diagramId)
  if(!snapshot)continue // conservar historia del diagrama borrado
  const previous=diagramSnapshot(before,diagramId)
  if(!previous){
   await client.query('INSERT INTO project_diagram_states(project_id,diagram_id,state_revision) VALUES($1,$2,1) ON CONFLICT DO NOTHING',[projectId,diagramId])
   await client.query(`INSERT INTO project_diagram_checkpoints(project_id,diagram_id,version,snapshot,project_cursor,created_by,reason)
    VALUES($1,$2,1,$3::jsonb,$4,$5,'baseline') ON CONFLICT DO NOTHING`,[projectId,diagramId,JSON.stringify(snapshot),projectCursor,actorId])
   continue
  }
  await client.query(`INSERT INTO project_diagram_states(project_id,diagram_id,state_revision)
   VALUES($1,$2,1) ON CONFLICT(project_id,diagram_id) DO UPDATE
   SET state_revision=project_diagram_states.state_revision+1,changed_at=now()`,[projectId,diagramId])
  const latest=await client.query<{version:number;created_at:Date;snapshot:Snapshot}>(`
   SELECT version,created_at,snapshot FROM project_diagram_checkpoints
   WHERE project_id=$1 AND diagram_id=$2 ORDER BY version DESC LIMIT 1`,[projectId,diagramId])
  const item=latest.rows[0]
  // No crear miles de versiones por mover una caja, editar texto o arrastrar.
  // Al cabo de 10 minutos se crea un checkpoint; también existe uno manual.
  if(!automatic)continue
  if(item&&Date.now()-new Date(item.created_at).getTime()<AUTO_WINDOW_MS)continue
  if(item&&isDeepStrictEqual(item.snapshot,snapshot))continue
  await client.query(`INSERT INTO project_diagram_checkpoints(project_id,diagram_id,version,snapshot,project_cursor,created_by,reason)
   VALUES($1,$2,$3,$4::jsonb,$5,$6,'automatic')`,[projectId,diagramId,(item?.version??0)+1,JSON.stringify(snapshot),projectCursor,actorId])
 }
 return changed
}
