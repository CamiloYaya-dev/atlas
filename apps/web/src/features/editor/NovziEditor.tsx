import {adaptDeploymentDocument,newDeploymentIssues,removeDeploymentRecord,deploymentNestingRequired,createNestedDeployment} from '@novzi/contracts'
import {DeploymentDetails,DeploymentRelationDialog,DeploymentCatalog} from './uml/DeploymentEditors'
import {newComponentIssues,componentClassifier,componentRole,componentRelationKinds,removeComponentSemanticRelation} from '@novzi/contracts'
import {ComponentDetails,ComponentRelationDialog,ComponentCatalogRelations} from './uml/ComponentEditors'
import {adjustSequenceExecution} from '@novzi/contracts'
import {adaptSequenceDocument,initializeSequenceNode,newSequenceIssues,sequenceDefaults,sequenceEndpointTypeValid,SEQUENCE_RELATIONS} from '@novzi/contracts'
import SequenceRelationDialog from './uml/SequenceRelationDialog'
import SequenceDetailsEditor,{SequenceRootEditor} from './uml/SequenceDetailsEditor'
import {activityDefaults,activityRelationKinds,newActivityIssues,activityDocumentIssues,activityParameterRoles,activityCatalogReferenced} from '@novzi/contracts'
import ActivityDetailsEditor,{ActivityRootEditor} from './uml/ActivityDetailsEditor'
import ActivityRelationDialog from './uml/ActivityRelationDialog'
import {useCaseRegistry,removeUseCaseSemanticRelation,canonicalSubjectId,diagramCreationEnabled,newUseCaseIssues,replaceUseCaseRelation,useCaseRelationKinds,isUseCaseCatalogType,useCaseElementIsReferenced} from '@novzi/contracts'
import UseCaseDetailsEditor from './uml/UseCaseDetailsEditor'
import UseCaseRelationDialog from './uml/UseCaseRelationDialog'
import ClassRelationDialog from './uml/ClassRelationDialog'
import {newClassIssues,umlRelationNameLocked,replaceClassRelationAcrossViews} from '@novzi/contracts'
import {createDiagram as commandCreateDiagram,editDiagram as commandEditDiagram,deleteDiagram as commandDeleteDiagram,addElementNode as commandAddElementNode,reuseElementNode as commandReuseElementNode,removeElementNode as commandRemoveElementNode,deleteDetachedUseCaseElement as commandDeleteDetachedUseCaseElement,deleteDetachedActivityElement as commandDeleteDetachedActivityElement,convertLegacyActivitySignal as commandConvertLegacyActivitySignal,connectNodes as commandConnectNodes,editRelation as commandEditRelation,removeRelation as commandRemoveRelation,reconnectRelation as commandReconnectRelation,moveNode as commandMoveNode,moveDiagramSelection as commandMoveDiagramSelection,removeDiagramSelection as commandRemoveDiagramSelection,resizeNode as commandResizeNode,setNodePackage as commandSetNodePackage,editElement as commandEditElement,addFieldDefinition as commandAddFieldDefinition,removeFieldDefinition as commandRemoveFieldDefinition} from './domain/document-commands'
import {useGraphView} from './hooks/useGraphView'
import {preserveReactFlowMeasurements} from './domain/preserve-reactflow-measurements'
import {beautifyDiagram,rebaseManualRoutes} from './domain/diagram-beautify'
import type {BeautifyMode} from './domain/diagram-beautify'
import type {ManualRoute} from './domain/manual-edge-routing'
import FunctionalModule from '../functional/FunctionalModule'
import GuidedTutorial from '../tutorial/GuidedTutorial'
import AcademyMissions from '../academy/AcademyMissions'
import LicensePanel from '../licensing/LicensePanel'
import {captureDiagramPng} from './capture-diagram'
import {createStandaloneDiagramDocument} from './standalone-diagram-export'
import AdvancedExportFields,{defaultExportChoices,normalizeChoices} from './AdvancedExportFields'
import {exportFieldsFor,UML_DIAGRAM_GROUPS,UML_RELATIONS_BY_DIAGRAM,umlElementReusable,umlElementCreatable,umlRelationLabel,umlRelationEndpointValid,umlContainerAllows,umlAbsolutePosition,umlNodeDepth,novziNodeSize,validNodeDimension,sequenceIsAttachment,sequenceActivationPorts,sequenceActivationSide,sequenceNearestPort,canonicalUmlEdge,isUmlDiagram,umlRelationNotation} from '@novzi/contracts'
import type {AdvancedExportMode,ExportFieldChoices,ExportField} from '@novzi/contracts'
import {readAcademyLab,storeAcademyLab} from '../academy/progress'
import type {AcademyLabIdentity} from '../academy/progress'
import {TUTORIAL_STORAGE_KEY} from '../tutorial/tutorial-content'
import '../tutorial/tutorial.css'
import {diagramFilters,nodeFilterIds} from './domain/graph-selection'
import {IconFor,nodeTypes} from '../../components/organisms/NovziNode'
import {edgeTypes} from '../../components/organisms/NovziParallelEdge'
import {umlEdgeTypes} from '../../components/organisms/NovziUmlEdge'
import UmlDetailsEditor from './uml/UmlDetailsEditor'
import {DiagramTypeBadge} from '../../components/atoms/DiagramTypeBadge'
import {Overlay,Field} from '../../components/molecules/Overlay'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {ChangeEvent,FormEvent,ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {ReactFlow,Background,Controls,MiniMap,ReactFlowProvider,useNodesState,useEdgesState,useReactFlow,ConnectionMode} from '@xyflow/react'
import type {Connection,Node,Edge} from '@xyflow/react'
import {ArrowRight,Award,BookOpen,ClipboardList,CheckCircle2,ChevronDown,ChevronRight,Download,ExternalLink,Folder,FolderPlus,Grip,Home,LogIn,LogOut,Maximize2,Minimize2,MousePointer2,Map,PanelLeftClose,PanelLeftOpen,Menu,Network,PanelRightClose,Plus,RefreshCcw,Save,Users,Sparkles,Settings2,ShieldCheck,Trash2,Upload,UserRound,Workflow,X} from 'lucide-react'
import {login as apiLogin,logout as apiLogout,session as apiSession,workspaceAccess} from '../security/api'
import OrganizationPanel from '../organizations/OrganizationPanel'
import {listOrganizations,createOrganization,createOrganizationWorkspace} from '../organizations/api'
import type {Organization} from '../organizations/api'
import VersionHistory from '../projects/VersionHistory'
import DiagramVersionHistory from '../projects/DiagramVersionHistory'
import WorkspaceSettings from '../workspaces/WorkspaceSettings'
import ProjectSettings from '../projects/ProjectSettings'
import AuditPanel from '../audit/AuditPanel'
import type {WorkspaceAccess} from '../security/types'
import {relationScope,mergeProjectDocuments,MergeConflict} from '@novzi/contracts'
import {createWorkspace as apiCreateWorkspace,listWorkspaces} from '../workspaces/api'
import {listProjects,createProject as apiCreateProject,projectAccess as apiProjectAccess,loadDocument,loadProjectVersion,loadDiagramState,saveDocument,exportProject,importProject,sendPresence,workspaceLicense,exportDiagramImage} from '../projects/api'
import type {LiveParticipant,LicenseEntitlements} from '../projects/api'
import {projectEventsUrl} from '../../shared/api/http'
import {createElement,diagramLabels,elementLabels,fieldLabels,emptyDoc,isProjectDocument,today,uid} from '../../types'
import type {Diagram,DiagramEdge,DiagramType,ElementType,FieldDefinition,FieldKind,ModelElement,Perspective,Project,ProjectDocument,Workspace,EdgeDirection,EdgeLineStyle,EdgePathStyle} from '../../types'

type Account={id:string,email:string;name:string;platformAdmin:boolean}
type Dialog='organize'|'project-history'|'new-organization'|'organization-settings'|'class-relation'|'new-diagram'|'new-node'|'fields'|'new-workspace'|'new-project'|'history'|'audit'|'workspace-settings'|'project-settings'|'diagram-filters'|'edit-relation'|'add-link'|'export-diagram'|'license'|null
const diagramDescriptions:Record<DiagramType,string>={
 c1:'Contexto: actores, sistemas externos, responsabilidades y límites del sistema. Puedes superponer contextos técnico, funcional y externo con filtros.',
 c2:'Contenedores: aplicaciones, servicios y almacenamiento que conforman el sistema.',
 c3:'Componentes: organización interna de un contenedor y sus dependencias.',
 c4:'Código: clases, módulos y estructuras internas de implementación.',
 process:'Flujo de procesos: actividades y decisiones del negocio conectadas de principio a fin.',
 sequence:'Flujo de secuencia: orden temporal propio de NOVZI para narrar pasos sin confundirse con UML · Secuencia.',
 data:'Flujo de datos: orígenes, transformaciones, almacenamientos y destinos.',
 trace:'Trazabilidad: vínculos entre objetivos, requerimientos, procesos y soluciones.',
 custom:'Libre: utiliza elementos y relaciones para diseñar cualquier tipo de vista.',
 'uml-class':'Clases, interfaces, atributos, operaciones y herencia.',
 'uml-object':'Instancias de objetos y sus vínculos.',
 'uml-component':'Componentes con interfaces requeridas o proporcionadas.',
 'uml-composite':'Clasificador estructurado con partes internas, roles, puertos y conectores de ensamblaje/delegación.',
 'uml-deployment':'Nodos, dispositivos, entornos de ejecución y artefactos; dependencias, despliegue y manifestación conservan semántica diferenciada.',
 'uml-package':'Paquetes, subpaquetes, modelos y perfiles anidables; visibilidad de elementos.',
 'uml-profile':'Perfiles que contienen estereotipos, referencias a metaclases y aplicaciones a paquetes/modelos.',
 'uml-usecase':'Actores, casos de uso y sujeto que los encapsula; requisitos y HU se vinculan desde otras vistas.',
 'uml-activity':'Nodos UML reales: inicio, final de actividad, final de flujo, acciones, decisiones, barras, objetos y particiones. Control y objeto son flujos distintos según UML 2.5.1.',
 'uml-state':'Estados, regiones y transiciones; usa pseudostados y barras conforme a la guía UML de NOVZI.',
 'uml-sequence':'Participantes con línea de vida, fragmentos combinados (alt, opt, loop, par), referencias, activaciones ancladas y destrucción al final de la ejecución.',
 'uml-communication':'Participantes enlazados estructuralmente; los mensajes se expresan sobre enlaces con numeración jerárquica.',
 'uml-interaction-overview':'Actividades y referencias a interacciones.',
 'uml-timing':'Líneas de tiempo y cambios de estado.'
}
const DIAGRAM_TYPES=(Object.keys(diagramLabels) as DiagramType[]).filter(diagramCreationEnabled)
const ELEMENT_TYPES=Object.keys(elementLabels) as ElementType[]
const FIELD_TYPES=Object.keys(fieldLabels) as FieldKind[]
const roleLabel:Record<string,string>={owner:'Propietario',admin:'Administrador',functional:'Analista funcional',technical:'Arquitecto técnico',editor:'Editor',viewer:'Lector'}
const diagramFolderLabel=(type:DiagramType)=>type==='custom'?'Libres':diagramLabels[type]
const diagramFolderOrder=(type:DiagramType)=>{
 if(type==='custom')return 0
 if(['c1','c2','c3','c4'].includes(type))return 1
 if(['process','sequence','data','trace'].includes(type))return 2
 if(type.startsWith('uml-'))return 3
 return 4
}
const downloadJSONFile=(name:string,payload:unknown)=>{
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url
 a.download=name
 a.click()
 URL.revokeObjectURL(url)
}
const dateOf=()=>new Date().toISOString().slice(0,10)
const editorEdgeTypes={...edgeTypes,...umlEdgeTypes}
const safeLink=(url:string)=>{try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?parsed.href:null}catch{return null}}
function emptyName(name:string){return name.trim().length>=2}
function diagramElementLabel(diagramType:DiagramType|undefined,type:ElementType){
 if(diagramType==='uml-composite'&&type==='uml-class')return 'Clasificador estructurado'
 if(diagramType==='uml-activity'&&type==='uml-end')return 'Final de actividad'
 if(diagramType==='uml-state'&&type==='uml-decision')return 'Elección / unión'
 if(diagramType==='uml-state'&&type==='uml-fork')return 'Bifurcación / unión'
 if(diagramType==='uml-state'&&type==='uml-region')return 'Estado compuesto / región'
 if(diagramType==='uml-state'&&type==='uml-history-shallow')return 'Historial superficial'
 if(diagramType==='uml-state'&&type==='uml-history-deep')return 'Historial profundo'
 if(diagramType==='uml-state'&&type==='uml-entry-point')return 'Entrada'
 if(diagramType==='uml-state'&&type==='uml-exit-point')return 'Salida'
 if(diagramType==='uml-state'&&type==='uml-terminate')return 'Terminación'
 if(diagramType==='uml-sequence'&&type==='uml-frame')return 'Fragmento combinado'
 if(diagramType==='uml-communication'&&type==='uml-frame')return 'Marco de interacción'
 if(diagramType==='uml-sequence'&&type==='uml-interaction')return 'Referencia de interacción'
 if(diagramType==='uml-sequence'&&type==='uml-lifeline')return 'Participante'
 if(diagramType==='uml-sequence'&&type==='uml-activation')return 'Ejecución / activación'
 if(diagramType==='uml-sequence'&&type==='uml-destruction')return 'Destrucción'
 if(diagramType==='uml-sequence'&&type==='actor')return 'Participante'
 if(diagramType==='uml-communication'&&['actor','uml-object','uml-lifeline'].includes(type))return 'Participante'
 return elementLabels[type]
}
function AppInner(){
 const flow=useReactFlow()
 const [account,setAccount]=useState<Account|null>(null)
 const [authReady,setAuthReady]=useState(false)
 const [authError,setAuthError]=useState('')
 const [authEmail,setAuthEmail]=useState('');const [authPass,setAuthPass]=useState('');const [authBusy,setAuthBusy]=useState(false)
 const [accessPolicy,setAccessPolicy]=useState<WorkspaceAccess|null>(null);const [workspacesLoaded,setWorkspacesLoaded]=useState(false);const [projectsLoaded,setProjectsLoaded]=useState(false);const [projectPolicy,setProjectPolicy]=useState<WorkspaceAccess|null>(null);const [workspaces,setWorkspaces]=useState<Workspace[]>([]);const [wsId,setWsId]=useState('');const [projects,setProjects]=useState<Project[]>([]);const [projectId,setProjectId]=useState('')
 const [organizations,setOrganizations]=useState<Organization[]>([]);const [orgId,setOrgId]=useState('')
 const [doc,setDoc]=useState<ProjectDocument|null>(null);const activityDocRef=useRef<ProjectDocument|null>(null);activityDocRef.current=doc;const [diagramId,setDiagramId]=useState('');const [selectedId,setSelectedId]=useState<string|null>(null)
 const [navigationTrail,setNavigationTrail]=useState<{diagramId:string;elementId:string|null}[]>([])
 const [focusRequest,setFocusRequest]=useState<{diagramId:string;nodeId:string}|null>(null)
 const [academyFieldPulse,setAcademyFieldPulse]=useState<'functional'|'technical'|null>(null)
 const [academyLinkPulse,setAcademyLinkPulse]=useState(false)
 const [mode,setMode]=useState<Perspective>('mixed');const [selectedFilters,setSelectedFilters]=useState<Record<string,string[]>>({});const [dependencies,setDependencies]=useState(false);const [includeUntagged,setIncludeUntagged]=useState(true)
 const [functionalDirty,setFunctionalDirty]=useState(false);const [activeModule,setActiveModule]=useState<'diagrams'|'functional'>('diagrams');const [sidebarOpen,setSidebarOpen]=useState(false);const [inspectorOpen,setInspectorOpen]=useState(true);const [expanded,setExpanded]=useState(false);const [diagramFoldersOpen,setDiagramFoldersOpen]=useState<Record<string,boolean>>({})
 const [navigationCollapsed,setNavigationCollapsed]=useState(()=>{try{return localStorage.getItem('novzi.navigation.collapsed')==='1'}catch{return false}})
 const [minimapVisible,setMinimapVisible]=useState(()=>{try{return localStorage.getItem('novzi.minimap.visible')!=='0'}catch{return true}})
 const [canvasFullscreen,setCanvasFullscreen]=useState(false)
 const [fullscreenFallback,setFullscreenFallback]=useState(false)
 const canvasFrameRef=useRef<HTMLElement|null>(null)
 useEffect(()=>{try{localStorage.setItem('novzi.navigation.collapsed',navigationCollapsed?'1':'0')}catch{/* storage denied */}},[navigationCollapsed])
 useEffect(()=>{try{localStorage.setItem('novzi.minimap.visible',minimapVisible?'1':'0')}catch{/* storage denied */}},[minimapVisible])
 useEffect(()=>{
  const update=()=>{if(document.fullscreenElement!==canvasFrameRef.current){setCanvasFullscreen(false);setFullscreenFallback(false)}}
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&fullscreenFallback){setFullscreenFallback(false);setCanvasFullscreen(false)}}
  document.addEventListener('fullscreenchange',update);document.addEventListener('keydown',escape)
  return()=>{document.removeEventListener('fullscreenchange',update);document.removeEventListener('keydown',escape)}
 },[fullscreenFallback])
 const toggleFullscreen=async()=>{
  const frame=canvasFrameRef.current;if(!frame)return
  if(canvasFullscreen){if(document.fullscreenElement===frame&&document.exitFullscreen)await document.exitFullscreen();setFullscreenFallback(false);setCanvasFullscreen(false);return}
  try{if(!frame.requestFullscreen)throw new Error('Fullscreen API no disponible');await frame.requestFullscreen();setCanvasFullscreen(true);setFullscreenFallback(false)}
  catch{setFullscreenFallback(true);setCanvasFullscreen(true)}
 }
 const [tutorialOpen,setTutorialOpen]=useState(false)
 const [academyOpen,setAcademyOpen]=useState(false)
 const [academyLab,setAcademyLab]=useState<AcademyLabIdentity|null>(null)
 const [academyBusy,setAcademyBusy]=useState(false)
 const [academyError,setAcademyError]=useState('')
 useEffect(()=>{setAcademyLab(account?.id?readAcademyLab(account.id):null);setAcademyOpen(false);setAcademyError('')},[account?.id])
 const [tutorialCompleted,setTutorialCompleted]=useState(()=>{try{return !!window.localStorage.getItem(TUTORIAL_STORAGE_KEY)}catch{return false}})
 const [dialog,setDialog]=useState<Dialog>(null);const [query,setQuery]=useState('');const [toast,setToast]=useState('');const [descriptionOpen,setDescriptionOpen]=useState(false)
 const [editSerial,setEditSerial]=useState(0);const [saveStatus,setSaveStatus]=useState<'saved'|'pending'|'saving'|'error'>('saved')
 const savedClassBaseline=useRef<{projectId:string;document:ProjectDocument}|null>(null)
 const [saveError,setSaveError]=useState('');const [currentVersion,setCurrentVersion]=useState(1);const versionMap=useRef<Record<string,number>>({});const editSerialRef=useRef(0);const ackSerialRef=useRef(0);const saveBusyRef=useRef(false);const [saveTick,setSaveTick]=useState(0);const conflictLockedProject=useRef<string|null>(null)
 const [confirmation,setConfirmation]=useState<{title:string;description:string;button:string;danger?:boolean;onAccept:()=>void}|null>(null)
 const [filterLabel,setFilterLabel]=useState('');const [filterRename,setFilterRename]=useState<Record<string,string>>({})
 const [classRelation,setClassRelation]=useState<DiagramEdge|null>(null)
 const [routeEditorEdgeId,setRouteEditorEdgeId]=useState<string|null>(null)
 const [focusRelations,setFocusRelations]=useState(true)
 const [hoveredElementId,setHoveredElementId]=useState<string|null>(null)
 const [beautifyMode,setBeautifyMode]=useState<BeautifyMode>('presentation')
 const [edgeEdit,setEdgeEdit]=useState<{diagramId:string;edgeId:string;source:string;target:string;sourceHandle?:string;targetHandle?:string;portsLocked?:boolean;label:string;direction:EdgeDirection;lineStyle:EdgeLineStyle;pathStyle:EdgePathStyle;relationKind?:string;sourceMultiplicity:string;targetMultiplicity:string;sourceRole:string;targetRole:string}|null>(null)
 const [linkLabel,setLinkLabel]=useState('');const [linkUrl,setLinkUrl]=useState('');const [linkElementId,setLinkElementId]=useState('')
 const [pendingImport,setPendingImport]=useState<{document:ProjectDocument;projectId:string;version:number;mode:'project'|'diagram';targetDiagramId?:string;sourceDiagramId?:string}|null>(null)
 const importChoice=useRef<{mode:'project'|'diagram';projectId:string;targetDiagramId?:string;version:number}|null>(null)
 const [importBusy,setImportBusy]=useState(false);const importBusyRef=useRef(false)
 const [exportFormat,setExportFormat]=useState<'project-json'|'diagram-json'|'png'|'jpg'>('png')
 const [exportLicense,setExportLicense]=useState<LicenseEntitlements|null>(null)
 const [advancedExportMode,setAdvancedExportMode]=useState<AdvancedExportMode>('simple')
 const [exportDocumentFormat,setExportDocumentFormat]=useState<'html'|'pdf'|'docx'>('pdf')
 const [advancedExportFields,setAdvancedExportFields]=useState<ExportFieldChoices>({})
 const [exportBusy,setExportBusy]=useState(false)
 const firstDirtyAtRef=useRef(0)
 const [activeDiagramVersion,setActiveDiagramVersion]=useState<number|null>(null)
 const [liveStatus,setLiveStatus]=useState<'connecting'|'online'|'offline'>('offline');const [participants,setParticipants]=useState<LiveParticipant[]>([])
 const liveClientRef=useRef<string|null>(null);const activeProjectRef=useRef('');activeProjectRef.current=projectId

 const fileInput=useRef<HTMLInputElement>(null);const [newName,setNewName]=useState('');const [newType,setNewType]=useState<DiagramType>('custom');const [newElementType,setNewElementType]=useState<ElementType>('component');const [fieldLabel,setFieldLabel]=useState('');const [fieldType,setFieldType]=useState<ElementType|'all'>('all');const [fieldKind,setFieldKind]=useState<FieldKind>('text');const [fieldOptions,setFieldOptions]=useState('');const [nodeTab,setNodeTab]=useState<'new'|'existing'>('new')
 const org=organizations.find(o=>o.id===orgId);
  const ws=workspaces.find(x=>x.id===wsId);const project=projects.find(x=>x.id===projectId);const canWorkspace=(key:string)=>!!accessPolicy&&(accessPolicy.roleKey==='owner'||accessPolicy.permissions.includes(key));const canProject=(key:string)=>!!projectPolicy&&(projectPolicy.roleKey==='owner'||projectPolicy.permissions.includes(key));const can=(key:string)=>key.startsWith('workspace.')||key==='project.create'?canWorkspace(key):canProject(key);const canEdit=!!projectPolicy&&(projectPolicy.roleKey==='owner'||projectPolicy.permissions.some(x=>x.includes('.edit.')||x.includes('.layout.')||x.includes('.create.')||x.includes('.delete.')||x==='field.configure'))
 const diagram=doc?.diagrams.find(d=>d.id===diagramId)||null;const selected=selectedId?doc?.elements[selectedId]:undefined
 const groupedDiagrams=useMemo(()=>{
  const items=(doc?.diagrams||[]).reduce((acc,d)=>{const key=d.type;(acc[key]||=[]).push(d);return acc},{} as Partial<Record<DiagramType,Diagram[]>>)
  return (Object.entries(items) as [DiagramType,Diagram[]][]).sort((a,b)=>diagramFolderOrder(a[0])-diagramFolderOrder(b[0])||diagramFolderLabel(a[0]).localeCompare(diagramFolderLabel(b[0]))).map(([type,diagrams])=>({type,label:diagramFolderLabel(type),diagrams:[...diagrams].sort((a,b)=>a.name.localeCompare(b.name)||a.createdAt.localeCompare(b.createdAt))}))
 },[doc?.diagrams])
 const filters=useMemo(()=>diagram&&doc?diagramFilters(diagram,doc):[],[diagram,doc])
 const groups=useMemo(()=>selectedFilters[diagramId]??filters.map(f=>f.id),[selectedFilters,diagramId,filters])
 const ask=(title:string,description:string,onAccept:()=>void,danger=false,button='Confirmar')=>setConfirmation({title,description,onAccept,danger,button})
 const freezeFilters=(d:Diagram,source:ProjectDocument):Diagram=>({...d,filters:diagramFilters(d,source),nodes:d.nodes.map(n=>({...n,filterIds:nodeFilterIds(n,d,source)}))})
 const modifyFilters=(action:(d:Diagram)=>Diagram)=>{
  if(!diagram||!can(`diagram.edit.${diagram.type}`)||!can(`diagram.layout.${diagram.type}`))return
  patch(previous=>commandEditDiagram(previous,diagram.id,action(freezeFilters(previous.diagrams.find(d=>d.id===diagram.id)!,previous))))
 }
 const announce=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),4000)}

 useEffect(()=>{let active=true;apiSession().then(user=>{if(active)setAccount(user)}).catch(()=>{if(active)setAccount(null)}).finally(()=>{if(active)setAuthReady(true)});return()=>{active=false}},[])
 useEffect(()=>{if(!wsId){setAccessPolicy(null);return}let mounted=true;setAccessPolicy(null);workspaceAccess(wsId).then(p=>{if(mounted)setAccessPolicy(p)}).catch(e=>{if(mounted)announce('No se pudieron cargar permisos: '+e.message)});return()=>{mounted=false}},[wsId])
 useEffect(()=>{if(!projectId){setProjectPolicy(null);return}let active=true;setProjectPolicy(null);apiProjectAccess(projectId).then(p=>{if(active)setProjectPolicy(p)}).catch(e=>{if(active)announce('Acceso al proyecto: '+e.message)});return()=>{active=false}},[projectId])
 useEffect(()=>{if(!account){setOrganizations([]);setOrgId('');return}let cancelled=false;listOrganizations().then(items=>{if(!cancelled){setOrganizations(items);setOrgId(prev=>items.some(o=>o.id===prev)?prev:items[0]?.id||'')}}).catch(e=>announce('Error al cargar organizaciones: '+e.message));return()=>{cancelled=true}},[account?.id])
 useEffect(()=>{setWorkspacesLoaded(false);if(!account){setWorkspaces([]);setWsId('');setProjects([]);setProjectId('');setDoc(null);setWorkspacesLoaded(true);return}let cancelled=false;listWorkspaces(account.id).then(items=>{if(!cancelled){setWorkspaces(items);setWsId(prev=>items.some(w=>w.id===prev)?prev:items[0]?.id||'')}}).catch(e=>announce('Error al cargar espacios: '+e.message)).finally(()=>{if(!cancelled)setWorkspacesLoaded(true)});return()=>{cancelled=true}},[account?.id])
 useEffect(()=>{if(!orgId||!workspacesLoaded)return;const current=workspaces.find(w=>w.id===wsId);if(current?.organization_id&&current.organization_id!==orgId){const candidate=workspaces.find(w=>w.organization_id===orgId);setWsId(candidate?.id||'');setProjectId('');setDoc(null)}},[orgId,wsId,workspaces,workspacesLoaded])
 useEffect(()=>{setProjectsLoaded(false);if(!wsId){setProjects([]);setProjectId('');setProjectsLoaded(true);return}let cancelled=false;setDoc(null);listProjects(wsId).then(items=>{if(!cancelled){setProjects(items);setProjectId(prev=>items.some(p=>p.id===prev)?prev:items[0]?.id||'')}}).catch(e=>announce('Error al cargar proyectos: '+e.message)).finally(()=>{if(!cancelled)setProjectsLoaded(true)});return()=>{cancelled=true}},[wsId])
 useEffect(()=>{if(!projectId){setDoc(null);setDiagramId('');return}let cancelled=false;setDoc(null);loadDocument(projectId).then(saved=>{if(cancelled)return;const data=saved?.document||emptyDoc();versionMap.current[projectId]=saved?.version||1;setCurrentVersion(saved?.version||1);conflictLockedProject.current=null;savedClassBaseline.current={projectId,document:data};setDoc(data);setDiagramId(data.diagrams[0]?.id||'');setSelectedId(null);setEditSerial(0);editSerialRef.current=0;ackSerialRef.current=0;firstDirtyAtRef.current=0;setSaveStatus('saved');setSaveError('')}).catch(e=>announce('Error al cargar diagrama: '+e.message));return()=>{cancelled=true}},[projectId])
 const patch=useCallback((fn:(original:ProjectDocument)=>ProjectDocument)=>{if(!canEdit||importBusyRef.current)return;setDoc(prev=>prev?fn(prev):prev);if(editSerialRef.current<=ackSerialRef.current)firstDirtyAtRef.current=Date.now();editSerialRef.current+=1;setEditSerial(editSerialRef.current);setSaveStatus(conflictLockedProject.current===projectId?'error':'pending')},[canEdit,projectId])
 // La etiqueta de historial muestra el CHECKPOINT del diagrama, nunca el cursor global.
 useEffect(()=>{
  if(!projectId||!diagramId||!doc?.diagrams.some(d=>d.id===diagramId)){setActiveDiagramVersion(null);return}
  let cancelled=false
  setActiveDiagramVersion(null)
  void loadDiagramState(projectId,diagramId).then(state=>{if(!cancelled)setActiveDiagramVersion(state.version)}).catch(()=>{if(!cancelled)setActiveDiagramVersion(null)})
  return()=>{cancelled=true}
 },[projectId,diagramId,currentVersion,Boolean(doc)])
 // Collaborative autosave: merge independent changes on the server; never overwrite a conflicting property.
 useEffect(()=>{
  if(!projectId||!doc||!canEdit||editSerial<=ackSerialRef.current||conflictLockedProject.current===projectId)return
  const pid=projectId,rev=editSerial,snapshot=doc
  const tid=window.setTimeout(async()=>{
   if(saveBusyRef.current)return // the active save schedules a fresh pass once it completes
   if(activeProjectRef.current!==pid||rev<=ackSerialRef.current||conflictLockedProject.current===pid)return
   const baseline=savedClassBaseline.current
   if(baseline?.projectId===pid&&(snapshot.diagrams.some(d=>['uml-class','uml-usecase','uml-activity','uml-sequence'].includes(d.type))||baseline.document.diagrams.some(d=>['uml-class','uml-usecase','uml-activity','uml-sequence'].includes(d.type)))){const issues=[...newClassIssues(baseline.document,snapshot),...newUseCaseIssues(baseline.document,snapshot),...newActivityIssues(baseline.document,snapshot),...newSequenceIssues(baseline.document,snapshot)];if(issues.length){setSaveError(issues[0].message);setSaveStatus('error');return}}
   saveBusyRef.current=true;setSaveStatus('saving')
   let committedSave=false
   try{
    let committedBaseline=snapshot
    const nextVersion=await saveDocument(pid,snapshot,versionMap.current[pid]||1,(committed,version)=>{
     // Do not erase edits typed while the request was in flight.
     if(activeProjectRef.current!==pid)return
     committedBaseline=committed
     setDoc(current=>{
      if(!current)return current
      if(editSerialRef.current===rev)return committed
      try{return mergeProjectDocuments(snapshot,current,committed)}
      catch(error){
       conflictLockedProject.current=pid
       setSaveError(error instanceof Error?error.message:'Colisión de cambios locales')
       setSaveStatus('error')
       return current
      }
     })
     versionMap.current[pid]=version
    })
    if(activeProjectRef.current!==pid)return
    savedClassBaseline.current={projectId:pid,document:committedBaseline}
    versionMap.current[pid]=nextVersion;setCurrentVersion(nextVersion)
    ackSerialRef.current=Math.max(ackSerialRef.current,rev)
    firstDirtyAtRef.current=editSerialRef.current===rev?0:Date.now()
    committedSave=true
    if(conflictLockedProject.current!==pid){setSaveError('');setSaveStatus(editSerialRef.current===rev?'saved':'pending')}
   }catch(error){
    if(activeProjectRef.current!==pid)return
    const message=error instanceof Error?error.message:String(error)
    if(/conflicto|versión base|colaboración/i.test(message)||error instanceof MergeConflict)conflictLockedProject.current=pid
    setSaveStatus('error');setSaveError(message)
   }finally{
    saveBusyRef.current=false
    if(committedSave&&activeProjectRef.current===pid&&editSerialRef.current>ackSerialRef.current&&conflictLockedProject.current!==pid)setSaveTick(x=>x+1)
   }
  },Math.max(50,Math.min(3500,(firstDirtyAtRef.current||Date.now())+20000-Date.now())))
  return()=>window.clearTimeout(tid)
 },[projectId,doc,editSerial,canEdit,saveTick])
 // Nunca cerrar la pestaña con un borrador aún no confirmado por PostgreSQL.
 useEffect(()=>{if(!projectId||saveStatus==='saved')return
  const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
  window.addEventListener('beforeunload',guard)
  return()=>window.removeEventListener('beforeunload',guard)
 },[projectId,saveStatus])
 // Both SSE and the periodic version probe use this ACL-filtered reload path.
 // Never overwrite a local draft, a pending save, or a conflict-resolution session.
 const remoteReloadRef=useRef<string|null>(null)
 const refreshRemoteVersion=useCallback(async(pid:string,announcedVersion:number)=>{
  if(!Number.isSafeInteger(announcedVersion)||announcedVersion<=versionMap.current[pid]||activeProjectRef.current!==pid)return
  if(editSerialRef.current>ackSerialRef.current||saveBusyRef.current||importBusyRef.current||conflictLockedProject.current===pid||remoteReloadRef.current===pid)return
  const initialSerial=editSerialRef.current
  remoteReloadRef.current=pid
  try{
   const saved=await loadDocument(pid)
   if(!saved||activeProjectRef.current!==pid||saveBusyRef.current||importBusyRef.current||editSerialRef.current!==initialSerial||conflictLockedProject.current===pid)return
   if(saved.version<=versionMap.current[pid])return
   versionMap.current[pid]=saved.version;setCurrentVersion(saved.version)
   savedClassBaseline.current={projectId:pid,document:saved.document};setDoc(saved.document)
   setDiagramId(prev=>saved.document.diagrams.some(d=>d.id===prev)?prev:saved.document.diagrams[0]?.id||'')
   setSelectedId(prev=>prev&&saved.document.elements[prev]?prev:null)
  }catch{
   // A transient REST failure should not misrepresent SSE status.
   // The next version probe/stream event will retry without discarding local edits.
  }finally{if(remoteReloadRef.current===pid)remoteReloadRef.current=null}
 },[])
 // Live event stream: pushes versions/presence; the document is re-read with ACL filtering.
 useEffect(()=>{
  setParticipants([]);setLiveStatus('offline');liveClientRef.current=null
  if(!projectId||!account||!doc||typeof EventSource==='undefined')return
  const pid=projectId,clientId=crypto.randomUUID()
  liveClientRef.current=clientId
  const stream=new EventSource(projectEventsUrl(pid,clientId),{withCredentials:true})
  setLiveStatus('connecting')
  stream.onopen=()=>{if(activeProjectRef.current===pid)setLiveStatus('online')}
  stream.onerror=()=>{if(activeProjectRef.current===pid){setLiveStatus('offline');setParticipants([])}}
  const onPresence=(evt:Event)=>{
   try{const payload=JSON.parse((evt as MessageEvent).data) as {participants:LiveParticipant[]};if(activeProjectRef.current===pid&&Array.isArray(payload.participants))setParticipants(payload.participants)}catch{/* malformed event ignored */}
  }
  const onVersion=(evt:Event)=>{
   try{const version=Number((JSON.parse((evt as MessageEvent).data) as {version:number}).version);void refreshRemoteVersion(pid,version)}catch{/* malformed event ignored */}
  }
  stream.addEventListener('presence',onPresence)
  stream.addEventListener('version',onVersion)
  return()=>{stream.removeEventListener('presence',onPresence);stream.removeEventListener('version',onVersion);stream.close();if(liveClientRef.current===clientId)liveClientRef.current=null}
 },[projectId,account?.id,Boolean(doc),refreshRemoteVersion])
 // Fail-safe for interrupted SSE and multi-replica API deployments: check a tiny
 // authenticated version cursor, fetching the document only when the version advanced.
 useEffect(()=>{
  if(!projectId||!account||!doc)return
  const pid=projectId
  let stopped=false,checking=false
  const check=async()=>{
   if(stopped||checking||document.visibilityState==='hidden'||activeProjectRef.current!==pid)return
   if(editSerialRef.current>ackSerialRef.current||saveBusyRef.current||importBusyRef.current||conflictLockedProject.current===pid)return
   checking=true
   try{const {version}=await loadProjectVersion(pid);if(!stopped)await refreshRemoteVersion(pid,version)}catch{/* next interval retries without touching the draft */}
   finally{checking=false}
  }
  const timer=window.setInterval(()=>{void check()},12000)
  return()=>{stopped=true;window.clearInterval(timer)}
 },[projectId,account?.id,Boolean(doc),refreshRemoteVersion])
 // Diagram/element awareness is ephemeral; selections are never stored in PostgreSQL.
 useEffect(()=>{
  if(!projectId||!doc||!liveClientRef.current||liveStatus!=='online')return
  const pid=projectId,clientId=liveClientRef.current,focusDiagram=diagramId||null
  const focusElement=selectedId&&doc.diagrams.find(d=>d.id===diagramId)?.nodes.some(n=>n.elementId===selectedId)?selectedId:null
  const ping=()=>void sendPresence(pid,clientId,focusDiagram,focusElement).catch(()=>{})
  const tid=window.setTimeout(ping,150)
  const interval=window.setInterval(ping,20000)
  return()=>{window.clearTimeout(tid);window.clearInterval(interval)}
 },[projectId,diagramId,selectedId,liveStatus])

 const [activeOccurrence,setActiveOccurrence]=useState<string|null>(null)
 const selectedNode=selected&&diagram?.nodes.find(n=>n.elementId===selected.id&&n.id===activeOccurrence)||selected&&diagram?.nodes.find(n=>n.elementId===selected.id)
 const selectedLinkDiagramId=selectedNode?.childDiagramId===undefined?selected?.childDiagramId:selectedNode.childDiagramId||undefined
 const selectedLinkNodeId=selectedNode?.childNodeId===undefined?selected?.childNodeId:selectedNode.childNodeId||undefined
 const updateOccurrenceLink=(updates:{childDiagramId?:string|null;childNodeId?:string|null})=>{
  if(!diagram||!selectedNode||!selected||!can(`element.edit.${selected.type}`)||!can(`diagram.layout.${diagram.type}`))return
  const owner=diagram.id,nodeId=selectedNode.id
  // Si el usuario edita sólo la caja de destino, copiar el diagrama heredado
  // a la ocurrencia. Un childNodeId sin childDiagramId sería inválido al guardar.
  const scopedUpdates=updates.childNodeId!==undefined&&updates.childDiagramId===undefined
   ?{...updates,childDiagramId:selectedLinkDiagramId??null}:updates
  patch(old=>({...old,diagrams:old.diagrams.map(d=>d.id!==owner?d:{...d,nodes:d.nodes.map(n=>n.id===nodeId?{...n,...scopedUpdates}:n)})}))
 }
 const selectedSize=selectedNode&&diagram&&selected?novziNodeSize(diagram.type,selected,selectedNode,umlNodeDepth(diagram,selectedNode),diagram.nodes.some(n=>n.parentNodeId===selectedNode.id)):null
 const [sizeWidthDraft,setSizeWidthDraft]=useState('')
 const [sizeHeightDraft,setSizeHeightDraft]=useState('')
 useEffect(()=>{setSizeWidthDraft(selectedSize?String(selectedSize.width):'');setSizeHeightDraft(selectedSize?String(selectedSize.height):'')},[diagramId,selectedId,selectedNode?.width,selectedNode?.height])
 const resizeSelected=(nodeId:string,width:number,height:number,x?:number,y?:number)=>{
  if(!diagram||!doc||!can(`diagram.layout.${diagram.type}`))return
  if(diagram.type==='uml-sequence'&&diagram.interaction){const n=diagram.nodes.find(n=>n.id===nodeId),parent=diagram.nodes.find(p=>p.id===n?.parentNodeId);if(parent){const pos=umlAbsolutePosition(diagram,parent);if(x!==undefined)x-=pos.x;if(y!==undefined)y-=pos.y}}
  try{commandResizeNode(doc,diagram.id,nodeId,width,height,x,y)}
  catch(error){announce(error instanceof Error?error.message:String(error));return}
  patch(old=>commandResizeNode(old,diagram.id,nodeId,width,height,x,y))
 }
 const onResizeView=useCallback((nodeId:string,width:number,height:number,x?:number,y?:number)=>resizeSelected(nodeId,width,height,x,y),[diagram,doc,projectPolicy,patch])
 const onAdjustExecution=useCallback((nodeId:string,start:number,finish:number,expected:{start:number;finish:number})=>{
  if(!diagram||!doc||!can('diagram.layout.uml-sequence')||!can('diagram.edit.uml-sequence')||!can('element.technical.edit'))return;
  const target=diagram.nodes.find(n=>n.id===nodeId);if(!target||!can(`element.edit.${doc.elements[target.elementId].type}`))return;
  const id=diagram.id;try{adjustSequenceExecution(doc,id,nodeId,start,finish,expected)}catch(error){announce((error as Error).message);return}
  ask('Ajustar activación','Se cambiarán únicamente las ocurrencias de inicio y fin (incluidos los extremos de mensajes que las referencian). Se conservan sus IDs y se valida la trayectoria completa.',()=>applyActivityCommand(old=>adjustSequenceExecution(old,id,nodeId,start,finish,expected)),false,'Aplicar ajuste temporal')
 },[diagram,doc,projectPolicy,patch])
 const updateManualRoute=useCallback((edgeId:string,route:ManualRoute|undefined)=>{
  if(!diagram||!doc||isUmlDiagram(diagram.type))return
  const edge=diagram.edges.find(item=>item.id===edgeId)
  const source=diagram.nodes.find(n=>n.id===edge?.source),target=diagram.nodes.find(n=>n.id===edge?.target)
  const a=source&&doc.elements[source.elementId],b=target&&doc.elements[target.elementId]
  if(!edge||!a||!b||!can(`relation.edit.${relationScope(a.type,b.type)}`))return
  const currentId=diagram.id
  patch(old=>({...old,diagrams:old.diagrams.map(d=>d.id!==currentId?d:{...d,edges:d.edges.map(e=>e.id!==edgeId?e:(route?{...e,manualRoute:route}:(()=>{const {manualRoute:_unused,...rest}=e;return rest})()))})}))
 },[diagram,doc,patch,projectPolicy])
 const filtered=useGraphView({diagram,doc,groups,dependencies,includeUntagged,mode:diagram&&isUmlDiagram(diagram.type)?'mixed':mode,selectedId,routeEditorEdgeId,focusRelations:focusRelations&&!!diagram&&diagram.edges.length>=10,focusedElementId:focusRelations&&!!diagram&&diagram.edges.length>=10?hoveredElementId||selectedId:null,onManualRouteCommit:updateManualRoute,selectedNodeId:diagram?.type==='uml-usecase'?selectedNode?.id:undefined,canEdit,onResize:onResizeView,onAdjustExecution:can('diagram.edit.uml-sequence')&&can('element.technical.edit')&&can('element.edit.uml-activation')?onAdjustExecution:undefined})
 const [displayNodes,setDisplayNodes,onDisplayNodesChange]=useNodesState<Node>([])
 const [displayEdges,setDisplayEdges,onDisplayEdgesChange]=useEdgesState<Edge>([])
 const [areaSelectionMode,setAreaSelectionMode]=useState(false)
 const [batchSelection,setBatchSelection]=useState<{nodeIds:string[];edgeIds:string[]}>({nodeIds:[],edgeIds:[]})
 const onAreaSelectionChange=useCallback(({nodes,edges}:{nodes:Node[];edges:Edge[]})=>{
  const nodeIds=nodes.map(n=>n.id),edgeIds=edges.map(e=>e.id)
  setBatchSelection(prev=>prev.nodeIds.join('|')===nodeIds.join('|')&&prev.edgeIds.join('|')===edgeIds.join('|')?prev:{nodeIds,edgeIds})
 },[])
 const measuredDiagramId=useRef<string|null>(null)
 useEffect(()=>{
  const sameDiagram=!!diagram&&measuredDiagramId.current===diagram.id
  measuredDiagramId.current=diagram?.id??null
  setDisplayNodes(previous=>preserveReactFlowMeasurements(filtered.nodes,previous,sameDiagram))
  setDisplayEdges(filtered.edges)
 },[diagram?.id,filtered.nodes,filtered.edges,setDisplayNodes,setDisplayEdges])
 useEffect(()=>{setBatchSelection({nodeIds:[],edgeIds:[]});setAreaSelectionMode(false);setRouteEditorEdgeId(null);setHoveredElementId(null)},[diagramId,projectId])

 const visitDiagram=(id:string)=>{if(!doc?.diagrams.some(d=>d.id===id))return;setNavigationTrail([]);setFocusRequest(null);setDiagramId(id);setSelectedId(null);setSidebarOpen(false)}
 const navigateToNode=(target:Diagram,nodeId:string|null,rememberOrigin=false,originElementId?:string)=>{
  if(!doc)return
  if(rememberOrigin)setNavigationTrail(old=>[...old,{diagramId,elementId:originElementId??selectedId}].slice(-20))
  setSelectedFilters(old=>{const next={...old};delete next[target.id];return next})
  setIncludeUntagged(true)
  setDiagramId(target.id);setSidebarOpen(false)
  const node=target.nodes.find(n=>n.id===nodeId)
  setSelectedId(node?.elementId||null);if(node){setInspectorOpen(true);setFocusRequest({diagramId:target.id,nodeId:node.id})}
  else setFocusRequest(null)
 }
 const navigateElement=(id:string)=>{if(!doc)return;const found=doc.diagrams.find(d=>d.id===diagramId&&d.nodes.some(n=>n.elementId===id))||doc.diagrams.find(d=>d.nodes.some(n=>n.elementId===id));if(found){const node=found.nodes.find(n=>n.elementId===id);navigateToNode(found,node?.id||null,found.id!==diagramId)}}
 const navigateChildOf=(element:ModelElement)=>{const target=doc?.diagrams.find(d=>d.id===element.childDiagramId);if(target)navigateToNode(target,element.childNodeId||null,true,element.id)}
 const navigateChild=()=>{if(selected)navigateChildOf({...selected,childDiagramId:selectedLinkDiagramId,childNodeId:selectedLinkNodeId})}
 const navigateBack=()=>{const previous=navigationTrail[navigationTrail.length-1];const target=doc?.diagrams.find(d=>d.id===previous?.diagramId);if(!target)return;setNavigationTrail(old=>old.slice(0,-1));navigateToNode(target,target.nodes.find(n=>n.elementId===previous.elementId)?.id||null)}
 useEffect(()=>{setNavigationTrail([]);setFocusRequest(null)},[projectId])
 useEffect(()=>{
  if(!focusRequest||focusRequest.diagramId!==diagramId)return
  let cancelled=false,tries=0,timer=0
  const focus=async()=>{
   if(cancelled)return
   const node=flow.getNode(focusRequest.nodeId)
   if(node){
    const completed=await flow.fitView({nodes:[{id:focusRequest.nodeId}],padding:1.0,maxZoom:1.4,duration:450})
    if(completed){if(!cancelled)setFocusRequest(null);return}
   }
   if(tries++<22)timer=window.setTimeout(()=>void focus(),100)
   else if(!cancelled)setFocusRequest(null)
  }
  timer=window.setTimeout(()=>void focus(),80)
  return()=>{cancelled=true;window.clearTimeout(timer)}
 },[diagramId,focusRequest,flow])
 useEffect(()=>{if(!academyFieldPulse||dialog)return;const timer=window.setTimeout(()=>document.querySelector('[data-academy-field-settings]')?.scrollIntoView({block:'center',behavior:'smooth'}),120);const reset=window.setTimeout(()=>setAcademyFieldPulse(null),10000);return()=>{window.clearTimeout(timer);window.clearTimeout(reset)}},[academyFieldPulse,selectedId,dialog])
 useEffect(()=>{if(!academyLinkPulse||dialog)return;const scroll=window.setTimeout(()=>document.querySelector('[data-academy-view-link]')?.scrollIntoView({block:'center',behavior:'smooth'}),180);const reset=window.setTimeout(()=>setAcademyLinkPulse(false),13000);return()=>{window.clearTimeout(scroll);window.clearTimeout(reset)}},[academyLinkPulse,diagramId,selectedId,dialog])
 const applyActivityCommand=(command:(old:ProjectDocument)=>ProjectDocument)=>{const current=activityDocRef.current;if(!current)return false;try{const next=command(current),issues=[...newActivityIssues(current,next),...newSequenceIssues(current,next),...newComponentIssues(current,next),...newDeploymentIssues(current,next)];if(issues.length)throw Error(issues[0].message);patch(old=>old===current?next:old);return true}catch(error){announce((error as Error).message);return false}}
 const updateElement=(id:string,partial:Partial<ModelElement>)=>{if(!selected||!can(`element.edit.${selected.type}`))return;if(('technical' in partial||'uml' in partial)&&!can('element.technical.edit'))return;if(diagram?.type==='uml-component'||diagram?.type==='uml-deployment')applyActivityCommand(old=>commandEditElement(old,id,partial,dateOf()));else patch(old=>commandEditElement(old,id,partial,dateOf()))}
 const updateDiagram=(partial:Partial<Diagram>)=>{if(diagram&&((('name' in partial||'description' in partial||'type' in partial||'activity' in partial||'interaction' in partial)?can(`diagram.edit.${diagram.type}`):can(`diagram.layout.${diagram.type}`))))patch(old=>commandEditDiagram(old,diagram.id,partial))}
 const addNode=(elementId:string)=>{
  const element=doc?.elements[elementId]
  if(!diagram||!can(`diagram.layout.${diagram.type}`)||!element||!umlElementReusable(diagram.type,element.type)||!can(`element.view.${element.type}`))return
  const parent=diagram.type==='uml-class'?undefined:diagram.type==='uml-activity'&&element.type==='uml-activity-pin'?diagram.nodes.find(n=>n.elementId===element.activityDetail?.ownerActionId):([selectedNode,...diagram.nodes].filter(Boolean) as typeof diagram.nodes).find(n=>doc?.elements[n.elementId]&&umlContainerAllows(diagram.type,doc.elements[n.elementId].type,element.type)&&(diagram.type!=='uml-component'||!element.semanticOwnerId||element.semanticOwnerId===n.elementId||element.type==='uml-port'&&doc.elements[n.elementId].uml?.component?.kind==='role'&&(doc.elements[n.elementId].uml?.component as {typeId?:string}).typeId===element.semanticOwnerId))
  if(diagram.type==='uml-package'&&element.type==='uml-subpackage'&&!parent){announce('Selecciona un paquete o modelo que contenga el subpaquete.');return}
  if(diagram.type==='uml-sequence'&&sequenceIsAttachment(element.type)&&!parent){announce('Primero crea o selecciona un Participante (línea de vida).');return}
  if(diagram.type==='uml-usecase'&&parent&&element.type==='usecase'&&!element.useCaseDetail?.subjectIds?.some(id=>canonicalSubjectId(doc!,id)===canonicalSubjectId(doc!,parent.elementId))&&!can('element.edit.usecase')){announce('No tienes permiso para cambiar los sujetos aplicables');return}
  if(diagram.interaction&&doc?.diagrams.some(d=>d.nodes.some(n=>n.elementId===elementId))){announce('La secuencia necesita una identidad local nueva');return}
  if(diagram.type==='uml-activity'&&doc?.diagrams.some(d=>d.type==='uml-activity'&&d.nodes.some(n=>n.elementId===elementId))){announce('Crea una acción o llamada con identidad local');return}
  const nid=uid(),absolute=parent?umlAbsolutePosition(diagram,parent):null
  const reuse=(old:ProjectDocument)=>{
   const added=commandReuseElementNode(old,diagram.id,elementId,{id:nid,x:absolute?absolute.x+38:180+diagram.nodes.length*42,y:absolute?absolute.y+80:160+diagram.nodes.length*27})
   return parent?commandSetNodePackage(added,diagram.id,nid,parent.id):added
  };if(diagram.type==='uml-activity'||diagram.type==='uml-component'){if(!applyActivityCommand(reuse))return}else patch(reuse);setDialog(null);setSelectedId(elementId);setActiveOccurrence(nid);setInspectorOpen(true);announce('Caja agregada al diagrama')
 }
 const addNewNode=()=>{
  if(!emptyName(newName)||!can(`element.create.${newElementType}`)||!diagram||!can(`diagram.layout.${diagram.type}`)||!umlElementCreatable(diagram.type,newElementType))return
  const requiredParent=diagram.type==='uml-component'&&(newElementType==='uml-port'||componentRole(newElementType))||diagram.type==='uml-activity'&&newElementType==='uml-activity-pin'||newElementType==='uml-subpackage'&&diagram.type==='uml-package'||diagram.type==='uml-sequence'&&sequenceIsAttachment(newElementType)
  const preferred=selectedNode||undefined
  const parent=diagram.type==='uml-class'?undefined:([preferred,...diagram.nodes].filter(Boolean) as typeof diagram.nodes).find(n=>{
   const parentElement=doc?.elements[n.elementId];return !!parentElement&&umlContainerAllows(diagram.type,parentElement.type,newElementType)&&(diagram.type!=='uml-component'||!(newElementType==='uml-port'||componentRole(newElementType))||componentClassifier(parentElement.type))
  })
  if(requiredParent&&!parent){announce(diagram.type==='uml-component'?'Selecciona un componente o clase propietaria.':diagram.type==='uml-sequence'?'Primero crea o selecciona un Participante para acoplar el elemento.':'Primero crea o selecciona un Paquete o Model para contener el subpaquete.');return}
  const element=createElement(newName.trim(),newElementType,account?.email||'Usuario'),id=element.id,nodeId=uid(),target=diagram.id
  if(diagram.type==='uml-component'){if(newElementType==='component')element.uml={component:{kind:'component',isIndirectlyInstantiated:true}};else if(newElementType==='uml-port')element.uml={component:{kind:'port',isService:true}};else if(componentRole(newElementType))element.uml={component:{kind:'role',multiplicity:'1'}};else if(newElementType==='uml-artifact')element.uml={component:{kind:'artifact'}};if(parent&&(newElementType==='uml-port'||componentRole(newElementType)||doc?.elements[parent.elementId]?.type==='uml-package'||newElementType==='uml-artifact'))element.semanticOwnerId=parent.elementId}
  if(diagram.type==='uml-activity'){element.activityDetail=activityDefaults(newElementType);if(newElementType==='uml-activity-pin'&&parent)element.activityDetail.ownerActionId=parent.elementId;if(newElementType==='uml-activity-parameter'){const available=(diagram.activity?.parameters||[]).flatMap(p=>activityParameterRoles(p).map(role=>({p,role}))).find(({p,role})=>!diagram.nodes.some(n=>{const a=doc?.elements[n.elementId]?.activityDetail;return a?.parameterId===p.id&&a.role===role}));if(!available){announce('Configura primero un parámetro o una dirección disponible en la ficha de la actividad');return}element.activityDetail.parameterId=available.p.id;element.activityDetail.role=available.role}}
  if(['uml-class','uml-usecase'].includes(diagram.type)&&newElementType==='uml-constraint')element.uml={expression:newName.trim()}
  if(diagram.interaction){element.sequenceDetail=sequenceDefaults(newElementType,id)}
  if(diagram.type==='uml-sequence'&&!diagram.interaction&&newElementType==='uml-frame'){element.uml={classifier:'alt'};element.summary='[condición]\n[else]'}
  const absolute=parent?umlAbsolutePosition(diagram,parent):null
  const create=(old:ProjectDocument)=>{
   const created=commandAddElementNode(old,target,element,{id:nodeId,x:absolute?absolute.x+38:230+diagram.nodes.length*34,y:absolute?absolute.y+78:160+diagram.nodes.length*22})
   const placed=parent?commandSetNodePackage(created,target,nodeId,parent.id):created;return diagram.interaction?initializeSequenceNode(placed,target,nodeId):placed
  };if(diagram.interaction||diagram.type==='uml-component'){if(!applyActivityCommand(create))return}else patch(create)
  setSelectedId(id);setActiveOccurrence(nodeId);setInspectorOpen(true);setDialog(null);setNewName('')
 }
 const addSubpackage=()=>{
  if(!diagram||!selected||diagram.type!=='uml-package'||!['uml-package','uml-subpackage','uml-model'].includes(selected.type)||!can('element.create.uml-subpackage')||!can('diagram.layout.uml-package'))return
  const parent=diagram.nodes.find(n=>n.elementId===selected.id)
  if(!parent)return
  const element=createElement('Nuevo subpaquete','uml-subpackage',account?.email||'Usuario')
  const newNodeId=uid()
  const pos=umlAbsolutePosition(diagram,parent)
  patch(old=>{const next=commandAddElementNode(old,diagram.id,element,{id:newNodeId,x:pos.x+40,y:pos.y+90});return commandSetNodePackage(next,diagram.id,newNodeId,parent.id)})
  setSelectedId(element.id);setInspectorOpen(true)
 }
 const addDiagram=()=>{if(!emptyName(newName)||!diagramCreationEnabled(newType)||!can(`diagram.create.${newType}`))return;const id=uid();const created:Diagram={id,name:newName.trim(),type:newType,description:'',createdAt:dateOf(),nodes:[],edges:[]};patch(old=>commandCreateDiagram(old,{id,name:newName.trim(),type:newType,date:created.createdAt}));setDiagramId(id);setSelectedId(null);setDialog(null);setNewName('');announce('Diagrama creado')}
 const deleteNode=()=>{if(!diagram||!can(`diagram.layout.${diagram.type}`)||!selectedId)return
  const targetDiagram=diagram.id,targetElement=selectedId
  ask('Quitar caja de la vista','La caja desaparecerá de este diagrama, pero el elemento seguirá disponible en el catálogo.',()=>{const remove=(old:ProjectDocument)=>commandRemoveElementNode(old,targetDiagram,targetElement,diagram.type==='uml-usecase'?selectedNode?.id:undefined);if(diagram.type==='uml-activity'||diagram.interaction){if(!applyActivityCommand(remove))return}else patch(remove);setSelectedId(null)},true,'Quitar caja')
 }
 const organizeCanvas=()=>{
  if(!diagram||!can(`diagram.layout.${diagram.type}`))return
  setDialog('organize')
 }
 const acceptOrganize=()=>{
  if(!diagram||!can(`diagram.layout.${diagram.type}`))return
  if(!applyActivityCommand(old=>beautifyDiagram(old,diagram.id,beautifyMode)))return
  setDialog(null);setRouteEditorEdgeId(null)
  announce('Organización aplicada. Los recorridos manuales existentes se conservan.')
  window.setTimeout(()=>void flow.fitView({padding:.3,duration:450}),180)
 }
 const onReconnectRelation=(visual:Edge,connection:Connection)=>{
  if(!diagram||!doc||!connection.source||!connection.target)return
  const current=diagram.edges.find(e=>e.id===visual.id)
  if(!current)return
  const beforeA=doc.elements[diagram.nodes.find(n=>n.id===current.source)?.elementId||''],beforeB=doc.elements[diagram.nodes.find(n=>n.id===current.target)?.elementId||'']
  const afterA=doc.elements[diagram.nodes.find(n=>n.id===connection.source)?.elementId||''],afterB=doc.elements[diagram.nodes.find(n=>n.id===connection.target)?.elementId||'']
  if(!beforeA||!beforeB||!afterA||!afterB||!can(`relation.edit.${relationScope(beforeA.type,beforeB.type)}`)||!can(`relation.edit.${relationScope(afterA.type,afterB.type)}`)){
   announce('No tienes permiso para reconectar estos extremos');return
  }
  const replacement={source:connection.source,target:connection.target,sourceHandle:connection.sourceHandle||undefined,targetHandle:connection.targetHandle||undefined}
  if(diagram.type==='uml-sequence'&&diagram.interaction){
   setClassRelation({...current,...replacement});setDialog('class-relation')
   announce('Confirma los tiempos y las ocurrencias en el editor de secuencia')
   return
  }
  if(!applyActivityCommand(old=>commandReconnectRelation(old,diagram.id,current.id,replacement)))return
  announce('Extremo reconectado. Identidad y propiedades conservadas')
 }
 const onConnect=(edge:Connection)=>{
  if(!diagram||!edge.source||!edge.target||edge.source===edge.target&&!diagram.interaction&&!['uml-class','uml-activity','uml-deployment'].includes(diagram.type))return
  const s=diagram.nodes.find(n=>n.id===edge.source),t=diagram.nodes.find(n=>n.id===edge.target)
  if(!s||!t||!doc)return
  const a=doc.elements[s.elementId],b=doc.elements[t.elementId]
  if(!a||!b||!can(`relation.create.${relationScope(a.type,b.type)}`)){
   announce('No tienes permiso para crear esta relación');return
  }
  if(diagram.type==='uml-usecase'&&!useCaseRelationKinds(doc,a,b).length){announce('Estos elementos no tienen una relación UML válida. Revisa los sujetos y los extremos.');return}
  if(diagram.type==='uml-activity'&&!activityRelationKinds(a,b,diagram).length){announce('Estos tipos de elementos no tienen una relación UML válida; extremos de actividad incompatibles.');return}
  if(diagram.interaction&&!SEQUENCE_RELATIONS.some(k=>sequenceEndpointTypeValid(k,a.type,b.type))){announce('Estos tipos de elementos no tienen una relación UML válida');return}
  if(diagram.type==='uml-deployment'&&!UML_RELATIONS_BY_DIAGRAM[diagram.type]?.some(k=>umlRelationEndpointValid(diagram.type,k,a.type,b.type))){announce('Extremos incompatibles');return}
  if(diagram.type==='uml-component'&&!componentRelationKinds(doc,diagram,{source:s.id,target:t.id}).length){announce('Extremos incompatibles');return}
  if(diagram.interaction||['uml-class','uml-usecase','uml-activity','uml-component','uml-deployment'].includes(diagram.type)){setClassRelation({id:uid(),source:edge.source,target:edge.target,sourceHandle:edge.sourceHandle||'right',targetHandle:edge.targetHandle||'left'});setDialog('class-relation');return}
  const umlKind=UML_RELATIONS_BY_DIAGRAM[diagram.type]?.find(kind=>umlRelationEndpointValid(diagram.type,kind,a.type,b.type))
  if(UML_RELATIONS_BY_DIAGRAM[diagram.type]&&!umlKind){announce('Estos tipos de elementos no tienen una relación UML válida; revisa los extremos.');return}
  const sourceHandle=edge.sourceHandle||'right'
  let targetHandle=edge.targetHandle||'left'
  if(diagram.type==='uml-sequence'){
   const lateral=(type:ElementType,handle:string)=>type!=='uml-activation'||['left','right'].includes(handle)||/^seq-(?:left|right)-[1-9]\d{0,2}$/.test(handle)
   if(!lateral(a.type,sourceHandle)||!lateral(b.type,targetHandle)){
    announce('Las ejecuciones UML se conectan únicamente por sus lados, no por arriba o abajo.');return
   }
   if(a.type==='uml-activation'&&b.type==='uml-activation'){
    const sourceSize=novziNodeSize(diagram.type,a,s)
    const targetSize=novziNodeSize(diagram.type,b,t)
    const sourcePct=sequenceActivationPorts(sourceSize.height).find(p=>p.id===sourceHandle)?.topPercent??50
    const messageY=umlAbsolutePosition(diagram,s).y+sourceSize.height*sourcePct/100
    const targetLocalY=messageY-umlAbsolutePosition(diagram,t).y
    targetHandle=sequenceNearestPort(targetSize.height,sequenceActivationSide(targetHandle,'target'),targetLocalY).id
   }
  }
  const fresh:DiagramEdge=canonicalUmlEdge(diagram.type,{
   id:uid(),source:edge.source,target:edge.target,sourceHandle,targetHandle,label:'',direction:'forward',
   ...(umlKind?{relationKind:umlKind}:{}),
   ...(umlKind&&['include','extend','dependency','realization'].includes(umlKind)?{lineStyle:'dashed' as const}:{})
  })
  patch(old=>commandConnectNodes(old,diagram.id,fresh))
 }
 const onNodeDragStop=(_:unknown,node:Node,draggedNodes:Node[])=>{
  if(!diagram||!doc||!can(`diagram.layout.${diagram.type}`))return
  if(diagram.type==='uml-sequence'&&diagram.interaction){
   try{const moves=areaSelectionMode&&draggedNodes?.length>1?draggedNodes:[node],next=commandMoveDiagramSelection(doc,diagram.id,moves.map(n=>({id:n.id,x:n.position.x,y:n.position.y}))),root=next.diagrams.find(d=>d.id===diagram.id)!.interaction!,previous=new globalThis.Map(diagram.interaction.occurrences.map(o=>[o.id,o.time])),changed=new Set(root.occurrences.filter(o=>previous.get(o.id)!==o.time).map(o=>o.id));if(changed.size){if(!can('diagram.edit.uml-sequence'))throw Error('No tienes permiso para modificar el tiempo de la interacción');for(const e of diagram.edges){const x=e.sequenceEdge;if(!x||![x.sendId,x.receiveId,x.beforeId,x.afterId].some(id=>id&&changed.has(id)))continue;const a=doc.elements[diagram.nodes.find(n=>n.id===e.source)?.elementId||''],b=doc.elements[diagram.nodes.find(n=>n.id===e.target)?.elementId||''];if(!a||!b||!can(`relation.edit.${relationScope(a.type,b.type)}`))throw Error('No tienes permiso para desplazar una relación de secuencia')}}patch(()=>next)}catch(error){announce((error as Error).message)}return
  }
  if(diagram.type==='uml-component'){const moves=areaSelectionMode&&draggedNodes?.length>1?draggedNodes:[node];applyActivityCommand(old=>commandMoveDiagramSelection(old,diagram.id,moves.map(n=>({id:n.id,x:n.position.x,y:n.position.y}))));return}
  if(areaSelectionMode&&draggedNodes?.length>1){
   try{patch(old=>{const moved=commandMoveDiagramSelection(old,diagram.id,draggedNodes.map(n=>({id:n.id,x:n.position.x,y:n.position.y})));return isUmlDiagram(diagram.type)?moved:rebaseManualRoutes(old,moved,diagram.id)})}
   catch(error){announce((error as Error).message)}
   return
  }
  const original=diagram.nodes.find(n=>n.id===node.id)
  const element=doc.elements[original?.elementId||'']
  if(!original||!element)return
  const absolute=node.parentId?umlAbsolutePosition(diagram,{...original,x:node.position.x,y:node.position.y}):node.position
  const cx=absolute.x+(element.type==='uml-port'?70:diagram.type==='uml-sequence'&&sequenceIsAttachment(element.type)?24:120),cy=absolute.y+40
  const candidates=diagram.nodes.filter(n=>n.id!==node.id).filter(n=>{
   const parent=doc.elements[n.elementId]
   if(!parent||!umlContainerAllows(diagram.type,parent.type,element.type))return false
   const pos=umlAbsolutePosition(diagram,n),size=novziNodeSize(diagram.type,parent,n,umlNodeDepth(diagram,n),diagram.nodes.some(c=>c.parentNodeId===n.id))
   const margin=element.type==='uml-port'?90:diagram.type==='uml-sequence'?35:0
   return cx>=pos.x-margin&&cx<=pos.x+size.width+margin&&cy>=pos.y-margin&&cy<=pos.y+size.height+margin
  }).sort((a,b)=>umlNodeDepth(diagram,b)-umlNodeDepth(diagram,a))
  if(diagram.type==='uml-usecase'&&element.type==='usecase'){
   const target=candidates[0],subject=target?canonicalSubjectId(doc,target.elementId):undefined
   if(subject&&!element.useCaseDetail?.subjectIds?.some(id=>canonicalSubjectId(doc,id)===subject)&&!can('element.edit.usecase')){announce('No tienes permiso para cambiar los sujetos aplicables');return}
   try{let moved=commandMoveNode(doc,diagram.id,node.id,node.position.x,node.position.y);if(target?.id!==original.parentNodeId)moved=commandSetNodePackage(moved,diagram.id,node.id,target?.id);const issues=newUseCaseIssues(doc,moved);if(issues.length){announce(issues[0].message);return}patch(()=>moved)}catch(error){announce((error as Error).message)}return
  }
  const target=!node.parentId?candidates[0]:undefined
  if(diagram.type==='uml-deployment'&&target&&deploymentNestingRequired(doc,diagram,node.id,target.id)){ask('Crear asignación de despliegue','El artefacto se desplegará en el destino seleccionado. Cancelar conserva la ubicación anterior.',()=>applyActivityCommand(old=>commandSetNodePackage(createNestedDeployment(commandMoveNode(old,diagram.id,node.id,node.position.x,node.position.y),diagram.id,node.id,target.id),diagram.id,node.id,target.id)),false,'Crear despliegue');return}
  try{patch(old=>{
   const raw=commandMoveNode(old,diagram.id,node.id,node.position.x,node.position.y)
   const moved=isUmlDiagram(diagram.type)?raw:rebaseManualRoutes(old,raw,diagram.id)
   return target?commandSetNodePackage(moved,diagram.id,node.id,target.id):node.parentId&&(diagram.type==='uml-composite'&&element.type==='uml-port'||diagram.type==='uml-sequence'&&sequenceIsAttachment(element.type))?commandSetNodePackage(moved,diagram.id,node.id,node.parentId):moved
  })}catch(error){announce((error as Error).message)}
 }
 const removeAreaSelection=()=>{
  if(!diagram||!doc||!can(`diagram.layout.${diagram.type}`))return
  const {nodeIds,edgeIds}=batchSelection
  if(!nodeIds.length&&!edgeIds.length)return
  const candidates=diagram.edges.filter(e=>edgeIds.includes(e.id))
  const missingPermission=candidates.some(edge=>{
   const source=diagram.nodes.find(n=>n.id===edge.source),target=diagram.nodes.find(n=>n.id===edge.target)
   const a=doc.elements[source?.elementId||''],b=doc.elements[target?.elementId||'']
   return !a||!b||!can(`relation.delete.${relationScope(a.type,b.type)}`)
  })
  if(missingPermission){announce('No tienes permiso para eliminar alguna relación seleccionada');return}
  ask('Eliminar selección del diagrama',`Quitar ${nodeIds.length} elementos y ${edgeIds.length} relaciones seleccionadas. Las fichas compartidas se conservarán.`,()=>{
   const remove=(old:ProjectDocument)=>commandRemoveDiagramSelection(old,diagram.id,nodeIds,edgeIds);if(diagram.type==='uml-activity'||diagram.interaction){if(!applyActivityCommand(remove))return}else patch(remove)
   setBatchSelection({nodeIds:[],edgeIds:[]});setSelectedId(null)
  },true,'Eliminar selección')
 }
 useEffect(()=>{
  if(!areaSelectionMode)return
  const onDeleteKey=(event:KeyboardEvent)=>{
   if(!['Delete','Backspace'].includes(event.key)||event.repeat||!batchSelection.nodeIds.length&&!batchSelection.edgeIds.length)return
   const active=document.activeElement
   if(active instanceof HTMLElement&&(active.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(active.tagName)))return
   event.preventDefault();removeAreaSelection()
  }
  document.addEventListener('keydown',onDeleteKey)
  return()=>document.removeEventListener('keydown',onDeleteKey)
 },[areaSelectionMode,batchSelection,diagram,doc,projectPolicy])
 const setPackageForSelected=(parentId:string)=>{if(!diagram||!selected||!can(`diagram.layout.${diagram.type}`))return;const node=selectedNode;if(!node)return;if(diagram.type==='uml-deployment'&&doc&&parentId&&deploymentNestingRequired(doc,diagram,node.id,parentId)){ask('Crear asignación de despliegue','Confirma el artefacto y su nueva ubicación.',()=>applyActivityCommand(old=>commandSetNodePackage(createNestedDeployment(old,diagram.id,node.id,parentId),diagram.id,node.id,parentId)),false,'Crear despliegue');return}if(diagram.type==='uml-component'||diagram.type==='uml-deployment')applyActivityCommand(old=>commandSetNodePackage(old,diagram.id,node.id,parentId||undefined));else patch(old=>commandSetNodePackage(old,diagram.id,node.id,parentId||undefined))}
 const deleteDiagram=()=>{if(!diagram||!can(`diagram.delete.${diagram.type}`))return
  const target=diagram.id,next=doc?.diagrams.find(d=>d.id!==target)?.id||''
  ask('Eliminar diagrama',`Se eliminará «${diagram.name}» y sus relaciones de esta vista. Los elementos compartidos permanecerán en el catálogo.`,()=>{const remove=(old:ProjectDocument)=>commandDeleteDiagram(old,target);if(diagram.type==='uml-activity'||diagram.interaction){if(!applyActivityCommand(remove))return}else patch(remove);setDiagramId(next);setSelectedId(null)},true,'Eliminar diagrama')
 }
 const recordAcademyLab=(next:AcademyLabIdentity)=>{if(!account)return;storeAcademyLab(account.id,next);setAcademyLab(next)}
 const createAcademyWorkspace=async(name:string)=>{
  if(!account||academyBusy||saveStatus!=='saved')return
  setAcademyBusy(true);setAcademyError('')
  try{const id=await apiCreateWorkspace(name);recordAcademyLab({workspaceId:id});const fresh=await listWorkspaces(account.id);setWorkspaces(fresh);setWsId(id);setProjectId('');setDoc(null);announce('Organización de formación creada')}
  catch(error){setAcademyError(error instanceof Error?error.message:String(error))}
  finally{setAcademyBusy(false)}
 }
 const createAcademyProject=async(name:string)=>{
  if(!account||!academyLab?.workspaceId||wsId!==academyLab.workspaceId||academyBusy||saveStatus!=='saved'||!can('project.create'))return
  setAcademyBusy(true);setAcademyError('')
  try{const created=await apiCreateProject(academyLab.workspaceId,name,emptyDoc());recordAcademyLab({...academyLab,projectId:created.id});setProjects(items=>[...items,created]);setProjectId(created.id);announce('Laboratorio creado: comienza a modelar')}
  catch(error){setAcademyError(error instanceof Error?error.message:String(error))}
  finally{setAcademyBusy(false)}
 }
 const returnToAcademy=()=>{
  if(!academyLab||saveStatus!=='saved'){announce('Guarda tus cambios antes de cambiar de proyecto.');return}
  if(wsId!==academyLab.workspaceId){setWsId(academyLab.workspaceId);setProjectId(academyLab.projectId||'');setDoc(null)}
  else if(academyLab.projectId)setProjectId(academyLab.projectId)
 }
 const academyCreateDiagram=(type:DiagramType,name:string)=>{
  if(!academyLab?.projectId||projectId!==academyLab.projectId||saveStatus!=='saved'||!can(`diagram.create.${type}`))return
  setNewType(type);setNewName(name);setDialog('new-diagram')
 }
 const academyFocusLinkSource=(sourceType:DiagramType,elementType:ElementType)=>{
  if(!doc)return
  const target=doc.diagrams.find(d=>d.type===sourceType)
  if(!target){announce(`Primero crea el diagrama ${diagramLabels[sourceType]}.`);return}
  const source=target.nodes.find(n=>doc.elements[n.elementId]?.type===elementType)
  if(!source){navigateToNode(target,null);announce(`Agrega una caja ${diagramElementLabel(diagram?.type,elementType)} en ${diagramLabels[sourceType]}.`);return}
  navigateToNode(target,source.id)
  setInspectorOpen(true)
  setAcademyLinkPulse(true)
  announce('Selecciona la vista destino en «Vista vinculada (doble clic)»; después guarda y prueba el doble clic.')
 }
 const academySelectDiagram=(type:DiagramType)=>{
  const target=doc?.diagrams.find(d=>d.type===type);if(target)visitDiagram(target.id)
 }
 const academyAddNode=(type:ElementType,name:string,diagramType:DiagramType)=>{
  const target=doc?.diagrams.find(d=>d.type===diagramType)
  if(!target||!can(`diagram.layout.${diagramType}`)||!can(`element.create.${type}`)||saveStatus!=='saved')return
  visitDiagram(target.id);setNewElementType(type);setNewName(name);setNodeTab('new');setDialog('new-node')
 }
 const academyReuse=(type:DiagramType)=>{
  const target=doc?.diagrams.find(d=>d.type===type)
  if(!target||!can(`diagram.layout.${type}`)||saveStatus!=='saved')return
  visitDiagram(target.id);setNodeTab('existing');setQuery('');setDialog('new-node')
 }
 const academyOpenFields=(kind:'functional'|'technical')=>{
  if(!academyLab?.projectId||projectId!==academyLab.projectId||!can('field.configure')||saveStatus!=='saved')return
  const target=doc?.diagrams.find(d=>d.type===(kind==='functional'?'trace':'c3'))
  const found=target?.nodes.some(n=>{const e=doc?.elements[n.elementId];return kind==='functional'?e?.type==='requirement'&&/^HU[-\s]/i.test(e.name):e?.type==='endpoint'&&/POST/i.test(e.name)})
  if(!found){announce('Primero crea la caja indicada por la misión.');return}
  academyInspect(kind)
  setAcademyFieldPulse(kind)
  announce('Busca «Campos personalizados → Configurar» en el Inspector; el botón está resaltado')
 }
 const academyInspect=(kind:'functional'|'technical')=>{
  if(!academyLab?.projectId||projectId!==academyLab.projectId||saveStatus!=='saved')return
  const diagramType=kind==='functional'?'trace':'c3'
  const target=doc?.diagrams.find(d=>d.type===diagramType)
  const node=target?.nodes.find(n=>{
   const element=doc?.elements[n.elementId]
   return kind==='functional'?element?.type==='requirement'&&/^HU[-\s]/i.test(element.name):element?.type==='endpoint'&&/POST/i.test(element.name)
  })
  if(!target||!node){announce('Primero crea la caja de práctica correspondiente.');return}
  visitDiagram(target.id);setSelectedId(node.elementId);setInspectorOpen(true);setDialog(null)
 }
 const academyMixed=()=>{
  const target=doc?.diagrams.find(d=>d.type==='trace');if(target){visitDiagram(target.id);setMode('mixed')}
 }
 const createOrganizationNow=async()=>{if(!emptyName(newName))return;try{const result=await createOrganization(newName.trim());const items=await listOrganizations();setOrganizations(items);setOrgId(result.id);setWsId('');setProjectId('');setDoc(null);setNewName('');setDialog(null);announce('Organización creada: ahora crea un espacio de trabajo')}catch(e){announce('Error: '+(e as Error).message)}}
 const createWs=async()=>{if(!emptyName(newName)||!orgId)return;try{const id=await createOrganizationWorkspace(orgId,newName.trim());const fresh=await listWorkspaces(account?.id||'');setWorkspaces(fresh);setWsId(id);setNewName('');setDialog(null);announce('Espacio creado')}catch(e){announce('Error: '+(e as Error).message)}}
 const createPrj=async()=>{if(!wsId||!emptyName(newName))return;try{const pr=await apiCreateProject(wsId,newName.trim(),emptyDoc());setProjects(prev=>[...prev,pr]);setProjectId(pr.id);setNewName('');setDialog(null);announce('Proyecto creado')}catch(e){announce('Error: '+(e as Error).message)}}
 const handleVersionRestored=async(nextVersion:number)=>{
  if(editSerialRef.current>ackSerialRef.current||saveBusyRef.current)throw new Error('Hay cambios locales pendientes. No se puede recargar el proyecto.')
  const saved=await loadDocument(projectId)
  if(!saved||saved.version!==nextVersion)throw new Error('Se restauró la versión, pero ya se detectó otra actualización. Recarga el proyecto.')
  versionMap.current[projectId]=saved.version;setCurrentVersion(saved.version);savedClassBaseline.current={projectId,document:saved.document};setDoc(saved.document)
  setDiagramId(old=>saved.document.diagrams.some(d=>d.id===old)?old:saved.document.diagrams[0]?.id||'')
  setSelectedId(null);conflictLockedProject.current=null;setSaveStatus('saved');setSaveError('')
  announce(`Versión ${nextVersion} restaurada correctamente`)
 }
 const sendAuth=async(e:FormEvent)=>{e.preventDefault();setAuthBusy(true);setAuthError('');try{const user=await apiLogin(authEmail,authPass);setAccount(user);setAuthPass('');setWorkspaces([]);setWsId('')}catch(e){setAuthError(e instanceof Error?e.message:String(e))}finally{setAuthBusy(false)}}
 const signOut=async()=>{try{await apiLogout()}finally{setTutorialOpen(false);setAcademyOpen(false);setAccount(null);setAccessPolicy(null);setDoc(null);setWorkspaces([]);setWsId('');setProjectId('')}}
 const addField=()=>{if(!emptyName(fieldLabel)||!can('field.configure'))return;const f:FieldDefinition={id:uid(),label:fieldLabel.trim(),forType:fieldType,kind:fieldKind,...(fieldKind==='select'?{options:fieldOptions.split(',').map(t=>t.trim()).filter(Boolean)}:{})};patch(old=>commandAddFieldDefinition(old,f));setFieldLabel('');setFieldOptions('')}
 const downloadLocalBackup=()=>{if(!doc||!projectId||!can('artifact.export'))return;downloadJSONFile(`NOVZI_copia_local_${projectId}.json`,{format:'NOVZI-LOCAL-UNSAVED',expectedVersion:versionMap.current[projectId]||1,document:doc})}
 const exportProjectJSON=async()=>{if(!projectId||!can('artifact.export'))return;try{const exported=await exportProject(projectId);downloadJSONFile(`NOVZI_${(project?.name||'proyecto').replace(/[^a-zA-Z0-9_-]+/g,'_')}.json`,exported)}catch(e){announce('Exportación: '+(e as Error).message)}}
 const exportDiagramJSON=()=>{
  if(!doc||!diagram||!projectId||!can('artifact.export'))return
  const payload={format:'NOVZI-DIAGRAM-JSON',workspaceId:wsId||null,projectId,projectName:project?.name||'',diagramId:diagram.id,diagramName:diagram.name,diagramType:diagram.type,version:versionMap.current[projectId]||currentVersion,exportedAt:new Date().toISOString(),document:createStandaloneDiagramDocument(doc,diagram.id)}
  downloadJSONFile(`NOVZI_${diagram.name.replace(/[^a-zA-Z0-9_-]+/g,'_')}.diagram.json`,payload)
 }
 const openExport=async()=>{
  setExportFormat(diagram?'png':'project-json');setAdvancedExportMode('simple');setAdvancedExportFields(doc&&diagram?defaultExportChoices(doc,diagram):{});setExportLicense(null);setDialog('export-diagram')
  if(wsId){try{setExportLicense(await workspaceLicense(wsId))}catch(e){announce('Estado de licencia: '+(e as Error).message)}}
 }
 const exportSelected=async()=>{
  if(!projectId||!can('artifact.export'))return
  if(exportFormat==='project-json'){await exportProjectJSON();setDialog(null);return}
  if(exportFormat==='diagram-json'){exportDiagramJSON();setDialog(null);return}
  if(!diagram){announce('Selecciona un diagrama');return}
  if(saveStatus!=='saved'){announce('Espera a que los cambios estén guardados antes de exportar');return}
  setExportBusy(true)
  try{
   const canvas=canvasFrameRef.current?.querySelector<HTMLElement>('.react-flow')
   if(!canvas)throw new Error('Lienzo no disponible para capturar')
   const advanced=advancedExportMode!=='simple'?{mode:advancedExportMode,fields:normalizeChoices(advancedExportFields,advancedExportMode),documentFormat:exportDocumentFormat}:undefined
   if(advanced&&!exportLicense?.features['diagram.export.advanced'])throw new Error('La exportación avanzada requiere licencia activa')
   const embedding:Record<string,ExportField[]>={}
   if(advanced&&doc&&['embedded','both'].includes(advanced.mode)){
    for(const node of diagram.nodes){const element=doc.elements[node.elementId];if(element){
     const rows=exportFieldsFor(doc,diagram,element,node.id,advanced,'embed');if(rows.length)embedding[node.id]=rows
    }}
   }
   const snapshot=await captureDiagramPng(canvas,embedding)
   const {blob}=await exportDiagramImage(projectId,diagram.id,exportFormat,versionMap.current[projectId]||currentVersion,snapshot,advanced)
   const url=URL.createObjectURL(blob),link=document.createElement('a')
   link.href=url;link.download=`NOVZI_${diagram.name.replace(/[^a-zA-Z0-9_-]+/g,'_')}${advanced&&['dictionary','both'].includes(advanced.mode)?'_Fichas.zip':'.'+exportFormat}`
   document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),2500)
   setDialog(null);announce('Imagen exportada y firmada correctamente')
  }catch(e){announce('Exportación: '+(e as Error).message)}finally{setExportBusy(false)}
 }
 const startImport=(mode:'project'|'diagram')=>{
  if(!projectId||!can('artifact.import')||importBusyRef.current||saveStatus!=='saved')return
  if(mode==='project'&&projectPolicy?.roleKey!=='owner'||mode==='diagram'&&(!diagram||!can(`diagram.edit.${diagram.type}`)||!can(`diagram.layout.${diagram.type}`)))return
  importChoice.current={mode,projectId,version:versionMap.current[projectId]||1,targetDiagramId:mode==='diagram'?diagram?.id:undefined};fileInput.current?.click()
 }
 const importJSON=async(e:ChangeEvent<HTMLInputElement>)=>{
  const input=e.target,file=input.files?.[0],choice=importChoice.current||{mode:'project' as const,projectId,version:versionMap.current[projectId]||1};importChoice.current=null;if(!file)return
  try{if(!can('artifact.import')||saveStatus!=='saved'||importBusyRef.current)throw Error('Importación no permitida o guardado pendiente')
   if(file.size>4*1024*1024)throw Error('Archivo demasiado grande (máximo 4 MB)')
   const parsed=JSON.parse(await file.text());const candidate=parsed?.document||parsed
   if(!isProjectDocument(candidate))throw Error('Formato JSON no compatible')
   if(choice.projectId!==activeProjectRef.current||choice.version!==versionMap.current[choice.projectId]||editSerialRef.current>ackSerialRef.current)throw Error('La revisión cambió. Selecciona nuevamente el archivo.')
   if(choice.mode==='project'&&projectPolicy?.roleKey!=='owner')throw Error('Solo el propietario puede reemplazar el proyecto completo')
   if(choice.mode==='diagram'){
    const dest=doc?.diagrams.find(d=>d.id===choice.targetDiagramId);if(!dest)throw Error('Diagrama destino no disponible')
    const options=candidate.diagrams.filter(d=>d.type===dest.type);if(!options.length)throw Error(`Tipo incompatible: el archivo no contiene un diagrama ${diagramLabels[dest.type]}`)
    setPendingImport({...choice,document:candidate,sourceDiagramId:options.length===1?options[0].id:undefined})
   }else setPendingImport({...choice,document:candidate})
  }catch(error){announce((error as Error).message)}finally{input.value=''}
 }
 const commitImport=async()=>{
  const pending=pendingImport
  if(!pending||!projectId||!can('artifact.import')||importBusyRef.current)return
  if(pending.projectId!==projectId||pending.version!==(versionMap.current[projectId]||1)||saveStatus!=='saved'||editSerialRef.current>ackSerialRef.current||saveBusyRef.current){announce('La revisión cambió. Cancela y vuelve a seleccionar el archivo.');return}
  if(pending.mode==='project'&&projectPolicy?.roleKey!=='owner')return
  if(pending.mode==='diagram'&&(!pending.sourceDiagramId||!pending.targetDiagramId||diagram?.id!==pending.targetDiagramId||!can(`diagram.edit.${diagram.type}`)||!can(`diagram.layout.${diagram.type}`))){announce('Selecciona el diagrama de destino y origen antes de importar');return}
  importBusyRef.current=true;setImportBusy(true);setSaveStatus('saving')
  let committed=false
  try{const pid=projectId,scope=pending.mode==='diagram'?{mode:'diagram' as const,targetDiagramId:pending.targetDiagramId!,sourceDiagramId:pending.sourceDiagramId!}:{mode:'project' as const}
   const version=await importProject(pid,pending.document,pending.version,scope);committed=true
   if(activeProjectRef.current!==pid)return
   versionMap.current[pid]=version;setCurrentVersion(version)
   const refreshed=await loadDocument(pid);if(activeProjectRef.current!==pid)return
   if(refreshed){versionMap.current[pid]=refreshed.version;setCurrentVersion(refreshed.version)}
   savedClassBaseline.current=refreshed?{projectId:pid,document:refreshed.document}:null;setDoc(refreshed?.document||null)
   setDiagramId(pending.mode==='diagram'&&refreshed?.document.diagrams.some(d=>d.id===pending.targetDiagramId)?pending.targetDiagramId!:refreshed?.document.diagrams[0]?.id||'');setSelectedId(null);setEditSerial(0);editSerialRef.current=0;ackSerialRef.current=0
   conflictLockedProject.current=null;setSaveError('');setSaveStatus('saved');setPendingImport(null);announce('Importación validada y guardada')
  }catch(error){if(activeProjectRef.current===pending.projectId){if(committed){conflictLockedProject.current=pending.projectId;setSaveError('Importación guardada; recarga para obtener la nueva revisión.');setSaveStatus('error');setPendingImport(null)}else setSaveStatus('saved');announce((error as Error).message)}}finally{importBusyRef.current=false;setImportBusy(false)}
 }
 const getEdgeScope=(target:typeof edgeEdit)=>{
  if(!target||!doc)return null
  const d=doc.diagrams.find(item=>item.id===target.diagramId),e=d?.edges.find(item=>item.id===target.edgeId)
  const from=d?.nodes.find(n=>n.id===e?.source),to=d?.nodes.find(n=>n.id===e?.target)
  const a=from&&doc.elements[from.elementId],b=to&&doc.elements[to.elementId]
  return a&&b?relationScope(a.type,b.type):null
 }
 const edgeScope=getEdgeScope(edgeEdit)
 const saveEdgeLabel=()=>{
  if(!edgeEdit||!edgeScope||!can(`relation.edit.${edgeScope}`))return
  const {diagramId:target,edgeId,source,target:destination,sourceHandle,targetHandle,portsLocked,label,direction,lineStyle,pathStyle,relationKind,sourceMultiplicity,targetMultiplicity,sourceRole,targetRole}=edgeEdit
  const oldEdge=diagram?.edges.find(e=>e.id===edgeId)
  if(!oldEdge)return
  const origin=doc?.elements[diagram?.nodes.find(n=>n.id===source)?.elementId||''],dest=doc?.elements[diagram?.nodes.find(n=>n.id===destination)?.elementId||'']
  if(!origin||!dest||!can(`relation.edit.${relationScope(origin.type,dest.type)}`)){announce('No tienes permiso sobre los nuevos extremos');return}
  const done=applyActivityCommand(old=>{
   let next=old
   if(source!==oldEdge.source||destination!==oldEdge.target)next=commandReconnectRelation(next,target,edgeId,{source,target:destination,sourceHandle,targetHandle})
   const normalized=canonicalUmlEdge(diagram?.type||'custom',{id:edgeId,source,target:destination,sourceHandle,targetHandle,label,direction,lineStyle,pathStyle,sourceMultiplicity,targetMultiplicity,sourceRole,targetRole,...(relationKind?{relationKind}:{})})
   const {id:_id,source:_source,target:_target,...changes}=normalized
   const changed=commandEditRelation(next,target,edgeId,changes)
   if(isUmlDiagram(diagram?.type||'custom'))return changed
   return {...changed,diagrams:changed.diagrams.map(d=>d.id!==target?d:{...d,edges:d.edges.map(e=>e.id===edgeId?{...e,portsLocked:!!portsLocked}:e)})}
  })
  if(done){setEdgeEdit(null);setDialog(null)}
 }
 const deleteSelectedRelation=()=>{
  if(!edgeEdit||!edgeScope||!can(`relation.delete.${edgeScope}`))return
  const {diagramId:target,edgeId,label}=edgeEdit
  setDialog(null);setEdgeEdit(null)
  ask('Eliminar relación',`Se eliminará únicamente la relación «${label.trim()||'Sin nombre'}». Las cajas y las demás vistas permanecerán intactas.`,()=>{
   patch(old=>commandRemoveRelation(old,target,edgeId));announce('Relación eliminada')
  },true,'Eliminar relación')
 }
 const saveExternalLink=()=>{
  if(!linkElementId||!linkLabel.trim()||!safeLink(linkUrl)){announce('Ingresa un nombre y una URL http o https válida');return}
  const target=linkElementId,label=linkLabel.trim(),url=linkUrl
  patch(old=>{const previous=old.elements[target];return previous?commandEditElement(old,target,{links:[...previous.links,{id:uid(),label,url}]},dateOf()):old})
  setDialog(null)
 }
 const createFilter=()=>{
  if(!diagram||!filterLabel.trim())return
  if(filters.some(f=>f.label.toLocaleLowerCase()===filterLabel.trim().toLocaleLowerCase())){announce('Ya existe un filtro con ese nombre');return}
  const id=uid(),name=filterLabel.trim(),target=diagram.id
  modifyFilters(d=>({...d,filters:[...(d.filters||[]),{id,label:name}]}))
  setSelectedFilters(prev=>({...prev,[target]:[...(prev[target]??filters.map(f=>f.id)),id]}));setFilterLabel('')
 }
 const renameFilter=(id:string)=>{
  const name=(filterRename[id]||'').trim()
  if(!name){announce('El nombre del filtro no puede quedar vacío');return}
  if(filters.some(f=>f.id!==id&&f.label.toLocaleLowerCase()===name.toLocaleLowerCase())){announce('Ya existe otro filtro con ese nombre');return}
  modifyFilters(d=>({...d,filters:(d.filters||[]).map(f=>f.id===id?{...f,label:name}:f)}))
 }
 const removeFilter=(id:string)=>{
  const name=filters.find(f=>f.id===id)?.label||'Filtro'
  ask('Eliminar filtro',`Se quitará la categoría «${name}» de este diagrama. Las cajas no se eliminarán.`,()=>{
   modifyFilters(d=>({...d,filters:(d.filters||[]).filter(f=>f.id!==id),nodes:d.nodes.map(n=>({...n,filterIds:(n.filterIds||[]).filter(value=>value!==id)}))}))
   setSelectedFilters(old=>({...old,[diagramId]:(old[diagramId]??filters.map(f=>f.id)).filter(value=>value!==id)}))
  },true,'Quitar filtro')
 }
 const toggleElementFilter=(id:string,active:boolean)=>{
  if(!diagram||!selected||!can(`diagram.layout.${diagram.type}`))return
  const target=selected.id
  modifyFilters(d=>({...d,nodes:d.nodes.map(n=>n.elementId===target?{...n,filterIds:active?[...new Set([...(n.filterIds||[]),id])]:(n.filterIds||[]).filter(x=>x!==id)}:n)}))
 }

 const related=useMemo(()=>{if(!doc||!selectedId)return [];const ids=new Set<string>();for(const d of doc.diagrams){const sourceNodes=new Set(d.nodes.filter(n=>n.elementId===selectedId).map(n=>n.id));for(const edge of d.edges){if(sourceNodes.has(edge.source)){const match=d.nodes.find(n=>n.id===edge.target);if(match)ids.add(match.elementId)}if(sourceNodes.has(edge.target)){const match=d.nodes.find(n=>n.id===edge.source);if(match)ids.add(match.elementId)}}}return [...ids].map(id=>doc.elements[id]).filter(Boolean).slice(0,12)},[doc,selectedId])
 const fieldDefs=doc?.fieldDefinitions.filter(f=>f.forType==='all'||f.forType===selected?.type)||[]
 const others=participants.filter(p=>p.userId?p.userId!==account?.id:p.clientId!==liveClientRef.current)
 const editingHere=others.filter(p=>p.diagramId===diagramId)
 const focusingElement=editingHere.filter(p=>selectedId&&p.elementId===selectedId)
 const canAddBox=!!diagram&&can(`diagram.layout.${diagram.type}`)&&ELEMENT_TYPES.some(t=>can(`element.create.${t}`)&&(!diagram||umlElementCreatable(diagram.type,t)))
 const showNewNodeDialog=()=>{
  setNewName('')
  setNewElementType(ELEMENT_TYPES.find(t=>can(`element.create.${t}`)&&(!diagram||umlElementCreatable(diagram.type,t)))||'component')
  setNodeTab('new')
  setQuery('')
  setDialog('new-node')
 }
 // A modal outside the native fullscreen element is not visible in the browser top layer.
 // Portal only the canvas modal into the fullscreen frame, preserving its React state.
 const inFullscreenCanvas=(content:ReactNode):ReactNode=>canvasFullscreen&&canvasFrameRef.current
  ?createPortal(content,canvasFrameRef.current)
  :content
 const sidebarHidden=expanded||navigationCollapsed
 if(!authReady)return <div className="splash"><span className="brand-icon large">⌘</span><h1>NOVZI</h1><p>Abriendo tu espacio de trabajo...</p></div>
 if(!account)return <div className="auth-shell"><div className="auth-left"><div className="auth-brand"><span className="brand-icon">⌘</span><b>NOVZI</b></div><span className="eyebrow light">ARQUITECTURA · PROCESOS · TRAZABILIDAD</span><h1>Donde lo funcional y lo técnico se conectan.</h1><p>Un único modelo para procesos, requerimientos, arquitectura y equipos. Acceso exclusivo para cuentas autorizadas.</p><div className="auth-graphic"><div><Network size={24}/> Arquitectura navegable</div><div><Workflow size={24}/> Procesos relacionados</div><div><ShieldCheck size={24}/> Permisos configurables</div></div></div><div className="auth-right"><form className="auth-card" onSubmit={sendAuth}><span className="eyebrow">NOVZI / ACCESO PRIVADO</span><h2>Iniciar sesión</h2><p>Ingresa con la cuenta creada por el administrador.</p><Field label="Correo electrónico"><input type="email" autoComplete="username" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="correo@empresa.com"/></Field><Field label="Contraseña"><input type="password" autoComplete="current-password" required value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Tu contraseña"/></Field>{authError&&<div className="sec-error" role="alert">{authError}</div>}<button className="primary full" type="submit" disabled={authBusy}><LogIn size={16}/>{authBusy?'Validando...':'Entrar a NOVZI'}</button><p className="sec-help">Acceso cerrado. No existe registro público. Si necesitas una cuenta, contacta al administrador.</p></form></div></div>
 return <div translate="no" className={'layout '+(sidebarHidden?'expanded ':'')+(expanded?'workspace-expanded':'')}>
   {sidebarOpen&&<div className="mobile-scrim" onClick={()=>setSidebarOpen(false)}/>}
   <aside className={'sidebar '+(sidebarOpen?'open':'')}>
     <div className="brand-area"><span className="brand-icon">⌘</span><div><strong>NOVZI</strong><small>Arquitectura conectada</small></div><button className="sidebar-close" onClick={()=>setSidebarOpen(false)}><X size={17}/></button></div>
     <div className="workspace-switch" aria-label="Organización actual"><select aria-label="Organización" value={orgId} onChange={e=>{if(functionalDirty||saveStatus!=='saved'){announce('Guarda los cambios antes de cambiar de organización');return}const next=e.target.value;setOrgId(next);const first=workspaces.find(w=>w.organization_id===next);setWsId(first?.id||'');setProjectId('');setDoc(null)}}><option value="">Seleccionar organización</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="button" title="Nueva organización" aria-label="Nueva organización" onClick={()=>{setNewName('');setDialog('new-organization')}}><Plus size={15}/></button><button type="button" title="Usuarios y accesos de la organización" aria-label="Usuarios y accesos de la organización" onClick={()=>setDialog('organization-settings')}><Users size={15}/></button></div>
     <div className="workspace-box"><span className="ws-symbol">{ws?.name?.charAt(0)||'A'}</span><div><strong>{ws?.name||'Selecciona un espacio'}</strong><small>{ws?(accessPolicy?.roleName||roleLabel[ws.role||'viewer']||'Miembro'):'Sin espacio'}</small></div></div>
     <div className="workspace-switch" data-tour="workspace-switch"><select aria-label="Espacio de trabajo" value={wsId} onChange={e=>{if(functionalDirty){announce('Guarda los cambios funcionales antes de cambiar de espacio');return}if(saveStatus!=='saved'){announce('Primero espera a que se guarden los cambios.');return}setWsId(e.target.value);setProjectId('');setDoc(null)}}><option value="">Seleccionar espacio</option>{workspaces.filter(w=>!orgId||!w.organization_id||w.organization_id===orgId).map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select>{ws&&['workspace.rename','workspace.delete'].some(canWorkspace)&&<button title="Administrar espacio" onClick={()=>setDialog('workspace-settings')}><Settings2 size={15}/></button>}{account&&orgId&&<button title="Nuevo espacio" onClick={()=>{setNewName('');setDialog('new-workspace')}}><Plus size={15}/></button>}</div>
     <div className="novzi-module-switch" role="group" aria-label="Módulos de NOVZI"><button type="button" className={activeModule==='diagrams'?'on':''} aria-pressed={activeModule==='diagrams'} onClick={()=>{if(functionalDirty){announce('Guarda o descarta los cambios de Gestión funcional antes de salir');return}setActiveModule('diagrams');setSidebarOpen(false)}}><Workflow size={16}/> Diagramas</button><button type="button" className={activeModule==='functional'?'on':''} aria-pressed={activeModule==='functional'} disabled={!projectId||!can('functional.read')} onClick={()=>{if(saveStatus!=='saved'){announce('Guarda primero los cambios pendientes del diagrama');return}setActiveModule('functional');setSidebarOpen(false)}}><ClipboardList size={16}/> Gestión funcional</button></div>
     <div className="side-label">PROYECTOS</div>
     <div className="project-nav" data-tour="project-nav">{projects.map(p=><button key={p.id} className={'project-item '+(p.id===projectId?'on':'')} onClick={()=>{if(functionalDirty){announce('Guarda los cambios funcionales antes de cambiar de proyecto');return}if(saveStatus!=='saved'){announce('Primero espera a que se guarden los cambios.');return}setProjectId(p.id);setSidebarOpen(false)}}><Folder size={15}/><span>{p.name}</span>{p.id===projectId&&<ChevronRight size={13}/>}</button>)}{can('project.create')&&<button className="project-add" onClick={()=>{setNewName('');setDialog('new-project')}}><Plus size={14}/> Nuevo proyecto</button>}</div>
     {project&&['project.rename','project.delete'].some(canProject)&&<button className="project-add" onClick={()=>setDialog('project-settings')}><Settings2 size={14}/> Administrar proyecto</button>}
     {activeModule==='diagrams'&&<div className="side-label">DIAGRAMAS</div>}
     {activeModule==='diagrams'&&<div className="diagram-nav" data-tour="diagram-nav">{groupedDiagrams.map(group=>{const open=diagramFoldersOpen[group.type]??(diagram?.type===group.type);return <div key={group.type} className="diagram-folder"><button type="button" className="diagram-folder-toggle" aria-label={`${open?'Contraer':'Expandir'} carpeta ${group.label}`} aria-expanded={open} onClick={()=>setDiagramFoldersOpen(old=>({...old,[group.type]:!(old[group.type]??(diagram?.type===group.type))}))}><Folder size={14}/><span>{group.label}</span><small>{group.diagrams.length}</small>{open?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>{open&&group.diagrams.map(d=><button key={d.id} className={'diagram-item '+(d.id===diagramId?'on':'')} onClick={()=>visitDiagram(d.id)}><DiagramTypeBadge type={d.type}/><span>{d.name}</span></button>)}</div>})}{doc&&DIAGRAM_TYPES.some(t=>can(`diagram.create.${t}`))&&<button className="project-add" onClick={()=>{setNewName('');setNewType(DIAGRAM_TYPES.find(t=>can(`diagram.create.${t}`))||'custom');setDialog('new-diagram')}}><Plus size={14}/> Crear diagrama</button>}</div>}
     <div className="side-bottom"><button type="button" className="sidebar-tutorial" data-tour="tutorial-launcher" aria-label="Abrir tutorial desde el menú lateral" onClick={()=>{setSidebarOpen(false);setTutorialOpen(true)}}><BookOpen size={16}/> Aprender NOVZI {!tutorialCompleted&&<span>Nuevo</span>}</button><button type="button" className="sidebar-tutorial" aria-label="Abrir misiones prácticas de NOVZI" onClick={()=>{setSidebarOpen(false);setTutorialOpen(false);setAcademyOpen(true)}}><Award size={16}/> Misiones e insignias</button><div className="demo-label"><span className="live-dot cloud"/>API · PostgreSQL · Acceso cerrado</div><button className="profile-pill" onClick={signOut}><span className="avatar"><UserRound size={15}/></span><span className="email">{account.email}</span><LogOut size={15}/></button></div>
   </aside>
   <main className="main">
     <header className="topbar"><div className="top-left">{navigationTrail.length>0&&<button type="button" className="ghost novzi-back-link" onClick={navigateBack} title="Volver al diagrama anterior"><ArrowRight size={14}/> Volver</button>}<button className="icon-btn nav-collapse-toggle" title={sidebarHidden?'Mostrar menú lateral':'Ocultar menú lateral'} aria-label={sidebarHidden?'Mostrar menú lateral':'Ocultar menú lateral'} aria-expanded={!sidebarHidden} onClick={()=>{setNavigationCollapsed(sidebarHidden?false:true);setExpanded(false)}}>{sidebarHidden?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button className="icon-btn mobile-menu" onClick={()=>setSidebarOpen(true)}><Menu size={19}/></button><span className="bread"><Home size={14}/> <ChevronRight size={12}/> {ws?.name||'NOVZI'} <ChevronRight size={12}/> <strong>{project?.name||'Proyecto'}</strong></span></div><div className="top-right">{projectId&&accessPolicy&&<button className="ghost" data-tour="history" onClick={()=>setDialog('history')}>{diagram?`Historial · v${activeDiagramVersion??'…'}`:'Historial técnico'}</button>}{wsId&&<button className="ghost" title="Ver licencia y suscripción de la organización" onClick={()=>setDialog('license')}><ShieldCheck size={15}/> Licencia</button>}{wsId&&can('workspace.audit.view')&&<button className="ghost" onClick={()=>setDialog('audit')}>Actividad</button>}{projectId&&<span className={'collab-status '+(liveStatus==='online'?'connected':'disconnected')} role='status' title={others.map(p=>`${p.name}: ${p.diagramId?'en un diagrama':'en el proyecto'}`).join(' · ')||'Sin colaboradores en este proyecto'}><span className='collab-dot'/> {liveStatus==='online'?`${participants.length} persona${participants.length===1?'':'s'} en línea`:liveStatus==='connecting'?'Conectando...':'Sin conexión en vivo · respaldo cada 12 s'}</span>}<span className={'save-chip '+saveStatus}>{saveStatus==='saved'?<CheckCircle2 size={13}/>:saveStatus==='saving'?<Save size={13}/>:saveStatus==='error'?<X size={13}/>:<RefreshCcw size={13}/>} {saveStatus==='saved'?'Guardado':saveStatus==='saving'?'Guardando...':saveStatus==='pending'?'Cambios pendientes':'Sin guardar'}</span><span className="role-pill"><ShieldCheck size={14}/>{projectPolicy?.roleName||accessPolicy?.roleName||(ws?roleLabel[ws.role||'viewer']:'Sin espacio')||'Sin rol'}</span>{can('field.configure')&&<button className="icon-btn" title="Configuración de campos" onClick={()=>setDialog('fields')}><Settings2 size={17}/></button>}</div></header>
     {editingHere.length>0&&<div className='collab-presence' role='status'><span className='collab-dot'/> {editingHere.map(p=>p.name).join(', ')} {editingHere.length===1?'está':'están'} viendo este diagrama{focusingElement.length>0&&selected?` · ${focusingElement.map(p=>p.name).join(', ')} en la caja ${selected.name}`:''}</div>}
     {activeModule==='functional'&&project&&doc?<FunctionalModule key={projectId} projectId={projectId} projectName={project.name} doc={doc} userId={account.id} can={can} onDirtyChange={setFunctionalDirty} onCreateDiagram={(name)=>{setActiveModule('diagrams');setNewName(name.startsWith('AS-IS')?name:'AS-IS · '+name);setNewType('process');setDialog('new-diagram')}} onDiagram={(id,nodeId)=>{const target=doc.diagrams.find(d=>d.id===id);if(!target||!can(`diagram.view.${target.type}`)){announce('No tienes acceso al diagrama solicitado');return}setActiveModule('diagrams');if(nodeId)navigateToNode(target,nodeId,false);else visitDiagram(id)}}/>:!project||!doc?<section className="blank-state"><div className="blank-image"><FolderPlus size={40}/></div><span className="eyebrow">NOVZI / PRIMEROS PASOS</span><h1>{!org?'Crea tu primera organización':!ws?'Crea tu primer espacio':'Crea tu primer proyecto'}</h1><p>{!org?'Una organización agrupa sus espacios y miembros. Ejemplo: Zercano.':!ws?'Crea espacios por área, como Dirección de Tecnología o Dirección de Producto.':'Dentro del proyecto podrás crear diagramas, componentes, procesos y requerimientos vinculados.'}</p><button className="primary" disabled={!(!ws?!!account:can('project.create'))} onClick={()=>{setNewName('');setDialog(!org?'new-organization':ws?'new-project':'new-workspace')}}><Plus size={17}/>{!org?'Crear organización':ws?'Crear proyecto':'Crear espacio'}</button></section>:
     <>
       <section className="page-intro"><div className="heading"><span className="eyebrow">NOVZI / {diagram?diagramLabels[diagram.type].toUpperCase():'EXPLORADOR'}</span><h1>{diagram?.name||'Elige un diagrama'}</h1><p className="novzi-intro-description" title={diagram?.description||undefined}>{diagram?.description||'Crea un diagrama y comienza a vincular la arquitectura con los procesos.'}</p>{diagram?.description&&diagram.description.length>160&&<button type="button" className="intro-more" onClick={()=>setDescriptionOpen(true)}>Leer descripción completa</button>}</div><div className="page-actions">{can('artifact.export')&&<button className="ghost" onClick={()=>void openExport()}><Download size={15}/> Exportar</button>}{can('artifact.import')&&diagram&&can(`diagram.edit.${diagram.type}`)&&can(`diagram.layout.${diagram.type}`)&&<button className="ghost" disabled={saveStatus!=='saved'||importBusy} onClick={()=>startImport('diagram')}><Upload size={15}/> Importar diagrama</button>}{can('artifact.import')&&projectPolicy?.roleKey==='owner'&&<button className="ghost" data-tour="import-action" disabled={saveStatus!=='saved'||importBusy} onClick={()=>startImport('project')}><Upload size={15}/> Importar proyecto</button>}<input type="file" ref={fileInput} accept=".json,application/json" hidden onChange={importJSON}/>{!diagram&&DIAGRAM_TYPES.some(t=>can(`diagram.create.${t}`))&&<button className="primary" onClick={()=>{setNewName('');setNewType(DIAGRAM_TYPES.find(t=>can(`diagram.create.${t}`))||'custom');setDialog('new-diagram')}}><Plus size={16}/> Crear diagrama</button>}</div></section>
       <div className="filters-bar" data-tour="filters">{(!diagram||!isUmlDiagram(diagram.type))&&<div className="segmented" data-tour="perspective"><button className={mode==='functional'?'active':''} onClick={()=>setMode('functional')}>Funcional</button><button className={mode==='mixed'?'active':''} onClick={()=>setMode('mixed')}>Mixta</button><button className={mode==='technical'?'active':''} onClick={()=>setMode('technical')}>Técnica</button></div>}{diagram&&<div className="process-chips" aria-label="Filtros de este diagrama">
       {filters.length?filters.map(f=><label key={f.id} className="process-chip"><input type="checkbox" checked={groups.includes(f.id)} onChange={e=>setSelectedFilters(old=>({...old,[diagram.id]:e.target.checked?[...groups,f.id]:groups.filter(x=>x!==f.id)}))}/><span className="p-dot"/>{f.label}</label>):<span className="filter-hint">Sin filtros configurados</span>}
       {filters.length>0&&<><label className="process-chip"><input type="checkbox" checked={includeUntagged} onChange={e=>setIncludeUntagged(e.target.checked)}/>Sin categoría</label><label className="process-chip"><input type="checkbox" checked={dependencies} onChange={e=>setDependencies(e.target.checked)}/>Dependencias</label></>}
       {can(`diagram.edit.${diagram.type}`)&&can(`diagram.layout.${diagram.type}`)&&<button type="button" className="ghost filter-manage-btn" onClick={()=>{setFilterLabel('');setFilterRename(Object.fromEntries(filters.map(f=>[f.id,f.label])));setDialog('diagram-filters')}}><Settings2 size={13}/> Filtros</button>}
       </div>}<span className="toolbar-fill"/>{!expanded&&<button className="icon-btn" title="Ampliar área de trabajo" aria-label="Ampliar área de trabajo" aria-pressed={false} onClick={()=>setExpanded(true)}><Maximize2 size={16}/></button>}<button type="button" className="icon-btn" title={minimapVisible?'Ocultar minimapa':'Mostrar minimapa'} aria-label={minimapVisible?'Ocultar minimapa':'Mostrar minimapa'} onClick={()=>setMinimapVisible(v=>!v)}><Map size={16}/></button><button type="button" className="icon-btn" title="Pantalla completa del diagrama" aria-label="Pantalla completa del diagrama" onClick={()=>void toggleFullscreen()}><Maximize2 size={16}/></button><button className="icon-btn" title="Mostrar / ocultar inspector" onClick={()=>setInspectorOpen(!inspectorOpen)}><PanelRightClose size={16}/></button></div>
       <div className="workspace-view"><section data-tour="canvas" className={'canvas-frame '+(fullscreenFallback?'novzi-fullscreen-fallback':'')} ref={canvasFrameRef}>
        <div className="canvas-actions" role="toolbar" aria-label="Acciones del diagrama">
         {navigationTrail.length>0&&<button type="button" className="ghost novzi-back-link novzi-canvas-back" onClick={navigateBack} title="Volver al diagrama anterior"><ArrowRight size={14}/> Volver</button>}
         {expanded&&<button type="button" className="icon-btn" title="Restaurar distribución" aria-label="Restaurar distribución" aria-pressed={true} onClick={()=>setExpanded(false)}><Minimize2 size={16}/></button>}
         {canAddBox&&<button type="button" className="primary canvas-add-node" data-tour="add-box" onClick={showNewNodeDialog}><Plus size={16}/> Agregar caja</button>}
         {diagram&&!isUmlDiagram(diagram.type)&&<button type="button" className={'ghost'+(focusRelations?' active':'')} aria-pressed={focusRelations} aria-label="Enfocar relaciones del elemento seleccionado" title="Resalta las relaciones del elemento seleccionado y atenúa las demás" onClick={()=>setFocusRelations(value=>!value)}><Network size={15}/> Enfocar relaciones</button>}
         {routeEditorEdgeId&&<button type="button" className="ghost" aria-label="Terminar edición de recorrido" onClick={()=>setRouteEditorEdgeId(null)}><CheckCircle2 size={15}/> Finalizar línea</button>}
         {diagram&&can(`diagram.layout.${diagram.type}`)&&<button type="button" className="ghost novzi-beautify" title="Alinear cajas y reducir solapamientos" aria-label="Organizar diagrama" onClick={organizeCanvas}><Sparkles size={15}/> Organizar</button>}
         {diagram&&can(`diagram.layout.${diagram.type}`)&&<button type="button" className={`ghost novzi-select-area${areaSelectionMode?' active':''}`} aria-label="Seleccionar área del diagrama" aria-pressed={areaSelectionMode} title="Seleccionar un área para mover o eliminar múltiples elementos" onClick={()=>{setAreaSelectionMode(v=>!v);setBatchSelection({nodeIds:[],edgeIds:[]});setSelectedId(null)}}><MousePointer2 size={15}/> Seleccionar área</button>}
         {areaSelectionMode&&(batchSelection.nodeIds.length+batchSelection.edgeIds.length)>0&&<button type="button" className="danger outlined novzi-remove-selection" aria-label="Eliminar selección del diagrama" onClick={removeAreaSelection}><Trash2 size={15}/> Eliminar ({batchSelection.nodeIds.length+batchSelection.edgeIds.length})</button>}
         <button type="button" className="icon-btn" title={canvasFullscreen?'Salir de pantalla completa':'Pantalla completa del diagrama'} aria-label={canvasFullscreen?'Salir de pantalla completa':'Pantalla completa del diagrama'} onClick={()=>void toggleFullscreen()}>{canvasFullscreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>
        </div><div className="canvas-label"><div><strong>{diagram?diagramLabels[diagram.type]:'Lienzo'}</strong><small>{filtered.nodes.filter(n=>n.type!=='activity-frame').length} elementos · {filtered.edges.length} relaciones</small></div><span className="diagram-badge">{diagram&&can(`diagram.layout.${diagram.type}`)?'Edición estructural':'Lectura'}</span></div>{diagram?<ReactFlow key={diagram.id} nodes={displayNodes} onNodesChange={onDisplayNodesChange} edges={displayEdges} onEdgesChange={onDisplayEdgesChange} onSelectionChange={onAreaSelectionChange} selectionOnDrag={areaSelectionMode} panOnDrag={areaSelectionMode?[1,2]:true} multiSelectionKeyCode="Shift" nodeTypes={nodeTypes} edgeTypes={editorEdgeTypes} nodesDraggable={!!diagram&&can(`diagram.layout.${diagram.type}`)} nodesConnectable={!!diagram&&['functional','technical','mixed'].some(scope=>can(`relation.create.${scope}`))} elementsSelectable connectionMode={ConnectionMode.Loose} fitView fitViewOptions={{padding:.25,minZoom:.4,maxZoom:1.1}} minZoom={.15} maxZoom={2} snapToGrid snapGrid={[15,15]} onConnect={onConnect} onReconnect={onReconnectRelation} edgesReconnectable={!!diagram&&can(`diagram.layout.${diagram.type}`)} reconnectRadius={6} onNodeDragStop={onNodeDragStop} onNodeMouseEnter={(_,node)=>setHoveredElementId(String(node.data.elementId))} onNodeMouseLeave={()=>setHoveredElementId(null)} onNodeClick={(_,node)=>{if(areaSelectionMode)return;setSelectedId(String(node.data.elementId));setActiveOccurrence(node.id);setInspectorOpen(true)}} onNodeDoubleClick={(_,node)=>{const e=doc.elements[String(node.data.elementId)];if(e?.activityDetail?.kind==='callBehavior'&&e.activityDetail.callDiagramId&&doc.diagrams.some(d=>d.id===e.activityDetail?.callDiagramId&&can(`diagram.view.${d.type}`)))navigateChildOf({...e,childDiagramId:e.activityDetail.callDiagramId,childNodeId:undefined});else if(diagram.interaction&&(e?.sequenceDetail?.interactionId||e?.sequenceDetail?.decompositionId))navigateChildOf({...e,childDiagramId:e.sequenceDetail.interactionId||e.sequenceDetail.decompositionId,childNodeId:undefined});else if(e){const occurrence=diagram.nodes.find(n=>n.id===node.id);const linked={...e,childDiagramId:occurrence?.childDiagramId===undefined?e.childDiagramId:occurrence.childDiagramId||undefined,childNodeId:occurrence?.childNodeId===undefined?e.childNodeId:occurrence.childNodeId||undefined};if(linked.childDiagramId)navigateChildOf(linked)}}} onPaneClick={()=>setSelectedId(null)} onEdgeDoubleClick={(_,edge)=>{if(!diagram||isUmlDiagram(diagram.type)||!doc)return;const item=diagram.edges.find(e=>e.id===edge.id),a=item&&doc.elements[diagram.nodes.find(n=>n.id===item.source)?.elementId||''],b=item&&doc.elements[diagram.nodes.find(n=>n.id===item.target)?.elementId||''];if(item&&a&&b&&can(`relation.edit.${relationScope(a.type,b.type)}`)){setDialog(null);setRouteEditorEdgeId(item.id)}}} onEdgeClick={(_,edge)=>{if(!diagram)return;if(routeEditorEdgeId===edge.id)return;const e=diagram.edges.find(x=>x.id===edge.id),source=diagram.nodes.find(n=>n.id===e?.source),target=diagram.nodes.find(n=>n.id===e?.target);if(!source||!target)return;const a=doc.elements[source.elementId],b=doc.elements[target.elementId];if(!a||!b)return;const scope=relationScope(a.type,b.type);if(!can(`relation.edit.${scope}`)&&!can(`relation.delete.${scope}`))return;if((diagram.interaction||['uml-class','uml-usecase','uml-activity','uml-component','uml-deployment'].includes(diagram.type))&&e){setClassRelation(e);setDialog('class-relation');return}setEdgeEdit({diagramId:diagram.id,edgeId:edge.id,source:e!.source,target:e!.target,sourceHandle:e!.sourceHandle,targetHandle:e!.targetHandle,portsLocked:e!.portsLocked,label:e?.label||'',direction:isUmlDiagram(diagram.type)?umlRelationNotation(e?.relationKind||UML_RELATIONS_BY_DIAGRAM[diagram.type]?.[0]||'association').direction:e?.direction||'forward',lineStyle:isUmlDiagram(diagram.type)?umlRelationNotation(e?.relationKind||UML_RELATIONS_BY_DIAGRAM[diagram.type]?.[0]||'association').stroke:e?.lineStyle||'solid',relationKind:e?.relationKind,sourceMultiplicity:e?.sourceMultiplicity||'',targetMultiplicity:e?.targetMultiplicity||'',sourceRole:e?.sourceRole||'',targetRole:e?.targetRole||'',pathStyle:e?.pathStyle||({process:'step',sequence:'straight',trace:'straight',c4:'bezier'} as Partial<Record<DiagramType,EdgePathStyle>>)[diagram.type]||'smoothstep'});setDialog('edit-relation')}} deleteKeyCode={null} proOptions={{hideAttribution:false}}><Background color="#dfe7f0" gap={22} size={1}/><Controls position="bottom-left" showInteractive={false}/>{minimapVisible&&<MiniMap position="bottom-right" nodeStrokeWidth={2} pannable zoomable/>}</ReactFlow>:<div className="empty-canvas"><Network size={42}/><h3>No hay diagramas todavía</h3><p>Crea un diagrama C4, de procesos o personalizado para empezar.</p>{DIAGRAM_TYPES.some(t=>can(`diagram.create.${t}`))&&<button className="primary" onClick={()=>setDialog('new-diagram')}><Plus size={16}/> Crear mi primer diagrama</button>}</div>}{diagram&&<div className="canvas-hint"><Grip size={13}/>{areaSelectionMode?'Arrastra sobre el fondo para seleccionar un área · mueve el grupo arrastrando una caja · Supr para quitarlo':'Arrastra para mover · enlaza desde los puertos · doble clic para navegar'}</div>}</section>
       {inspectorOpen&&<aside className="inspector" data-tour="inspector"><div className="inspector-heading"><div><span className="eyebrow">INSPECTOR</span><h3>{selected?'Ficha del elemento':'Detalles del diagrama'}</h3></div><button className="icon-btn small" onClick={()=>setInspectorOpen(false)}><X size={16}/></button></div><div className="inspector-scroll">{selected?<>
        <div className="selected-type"><IconFor type={selected.type}/>{diagramElementLabel(diagram?.type,selected.type)} <span className="status-pill">{selected.status}</span></div>
        <Field label="Nombre"><input value={selected.name} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{name:e.target.value})}/></Field>
        {diagram&&selectedNode&&<section className="novzi-size-controls" aria-label="Dimensiones de caja"><strong>{!isUmlDiagram(diagram.type)?'Tamaño base (vista mixta)':'Tamaño de esta caja'}</strong><div className="novzi-size-fields"><Field label="Ancho (px)"><input aria-label="Ancho (px)" type="number" min="48" max="4000" step="1" value={sizeWidthDraft} disabled={!can(`diagram.layout.${diagram.type}`)} onChange={e=>setSizeWidthDraft(e.target.value)}/></Field><Field label="Alto (px)"><input aria-label="Alto (px)" type="number" min="48" max="4000" step="1" value={sizeHeightDraft} disabled={!can(`diagram.layout.${diagram.type}`)} onChange={e=>setSizeHeightDraft(e.target.value)}/></Field></div><button type="button" className="ghost" disabled={!can(`diagram.layout.${diagram.type}`)||!validNodeDimension(Number(sizeWidthDraft))||!validNodeDimension(Number(sizeHeightDraft))} onClick={()=>resizeSelected(selectedNode.id,Number(sizeWidthDraft),Number(sizeHeightDraft))}>Aplicar tamaño</button><small>{!isUmlDiagram(diagram.type)?'La anchura y posición se conservan en todas las perspectivas. En Mixta puedes arrastrar las esquinas; en Funcional y Técnica la altura se adapta al contenido. Estos ajustes visuales no crean versiones.':'Puedes arrastrar las esquinas de la caja seleccionada. El tamaño se guarda solo en esta vista.'}</small></section>}
        {diagram&&['uml-class','uml-object','uml-component','uml-package','uml-profile','uml-usecase','uml-composite','uml-deployment'].includes(diagram.type)&&<Field label={diagram.type==='uml-composite'?'Clasificador / parte contenedora':diagram.type==='uml-deployment'?'Nodo / entorno contenedor':diagram.type==='uml-usecase'?'Sujeto que encapsula el caso de uso':diagram.type==='uml-profile'?'Perfil / paquete contenedor':'Paquete contenedor en este diagrama'}><select aria-label="Contenedor UML" disabled={!can(`diagram.layout.${diagram.type}`)} value={diagram.nodes.find(n=>n.elementId===selected.id)?.parentNodeId||''} onChange={e=>setPackageForSelected(e.target.value)}><option value="">Sin contenedor</option>{diagram.nodes.filter(n=>{if(!doc.elements[n.elementId]||!umlContainerAllows(diagram.type,doc.elements[n.elementId].type,selected.type)||n.elementId===selected.id)return false;const self=diagram.nodes.find(x=>x.elementId===selected.id);let cursor=n;const seen=new Set<string>();while(cursor.parentNodeId&&!seen.has(cursor.id)){if(cursor.parentNodeId===self?.id)return false;seen.add(cursor.id);cursor=diagram.nodes.find(x=>x.id===cursor.parentNodeId)||cursor}return true}).map(n=><option key={n.id} value={n.id}>{doc.elements[n.elementId]?.name}</option>)}</select></Field>}
        {diagram?.type==='uml-package'&&['uml-package','uml-subpackage','uml-model'].includes(selected.type)&&can('element.create.uml-subpackage')&&umlNodeDepth(diagram,diagram.nodes.find(n=>n.elementId===selected.id)!)<2&&<button className="ghost" type="button" onClick={addSubpackage}><Plus size={14}/> Crear subpaquete dentro de este paquete</button>}
        {diagram&&['uml-package','uml-profile'].includes(diagram.type)&&['uml-package','uml-subpackage','uml-model','uml-profile','uml-stereotype','uml-metaclass'].includes(selected.type)&&can('element.technical.view')&&<Field label="Visibilidad UML del elemento"><select aria-label="Visibilidad UML del elemento" value={selected.uml?.visibility||'public'} disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} onChange={e=>updateElement(selected.id,{uml:{...(selected.uml||{}),visibility:e.target.value as 'public'|'private'|'protected'|'package'}})}><option value="public">+ Público</option><option value="private">− Privado</option><option value="protected"># Protegido</option><option value="package">~ Paquete</option></select></Field>}
        {diagram?.type==='uml-deployment'&&selected.type==='uml-device'&&can('element.technical.view')&&<Field label="Icono del dispositivo"><select aria-label="Icono del dispositivo UML" disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} value={selected.uml?.deviceIcon||'server'} onChange={e=>updateElement(selected.id,{uml:{...(selected.uml||{}),deviceIcon:e.target.value as NonNullable<ModelElement['uml']>['deviceIcon']}})}>{[['server','Servidor físico'],['desktop','Computador / PC'],['android','Android'],['mobile','Móvil genérico'],['network','Equipo de red'],['storage','Dispositivo de almacenamiento'],['generic','Dispositivo genérico']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>}
        {diagram?.type==='uml-deployment'&&selected.type==='uml-execution'&&can('element.technical.view')&&<Field label="Tipo de entorno de ejecución"><select aria-label="Tipo de entorno UML" disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} value={selected.uml?.runtimeIcon||'generic'} onChange={e=>updateElement(selected.id,{uml:{...(selected.uml||{}),runtimeIcon:e.target.value as NonNullable<ModelElement['uml']>['runtimeIcon']}})}>{[['generic','Entorno genérico'],['docker','Contenedor Docker'],['jvm','Máquina virtual Java'],['nodejs','Node.js'],['database','Motor de base de datos']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>}
        {diagram?.type==='uml-class'&&doc&&<Field label="Propietario semántico UML"><select aria-label="Propietario semántico UML" disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} value={selected.semanticOwnerId||''} onChange={e=>{const candidate=commandEditElement(doc,selected.id,{semanticOwnerId:e.target.value||undefined},dateOf());const problems=newClassIssues(doc,candidate);if(problems.length){announce(problems[0].message);return}updateElement(selected.id,{semanticOwnerId:e.target.value||undefined})}}><option value="">Sin propietario</option>{Object.values(doc.elements).filter(e=>e.id!==selected.id&&umlContainerAllows('uml-class',e.type,selected.type)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>}
        {diagram?.type==='uml-class'&&selected.type==='uml-association-class'&&doc&&!doc.diagrams.some(d=>d.type==='uml-class'&&d.edges.some(e=>e.associationClassId===selected.id))&&<p className="muted-mini">Borrador · Asociación pendiente de vincular</p>}
        {diagram?.type==='uml-usecase'&&doc&&selectedNode&&['uml-comment','uml-constraint'].includes(selected.type)&&<button className="outlined" onClick={()=>{const target=diagram.nodes.find(n=>n.id!==selectedNode.id&&doc.elements[n.elementId]&&useCaseRelationKinds(doc,selected,doc.elements[n.elementId]).includes('annotation')&&can(`relation.create.${relationScope(selected.type,doc.elements[n.elementId].type)}`));if(!target){announce('No hay elementos disponibles para anotar');return}setClassRelation({id:uid(),source:selectedNode.id,target:target.id,sourceHandle:'right',targetHandle:'left',relationKind:'annotation'});setDialog('class-relation')}}>Agregar anotación UML</button>}
        {diagram?.type==='uml-usecase'&&doc&&['actor','usecase','uml-subject'].includes(selected.type)&&<UseCaseDetailsEditor key={`usecase-detail:${selected.id}`} element={selected} doc={doc} disabled={!can(`element.edit.${selected.type}`)} onChange={useCaseDetail=>updateElement(selected.id,{useCaseDetail})} onDocumentChange={next=>patch(()=>next)} canResolve={next=>Object.values(useCaseRegistry(doc)).every(r=>{const changed=useCaseRegistry(next)[r.id];if(JSON.stringify(changed)===JSON.stringify(r))return true;const a=doc.elements[r.sourceElementId],b=doc.elements[r.targetElementId];return !!a&&!!b&&can(`relation.${changed?'edit':'delete'}.${relationScope(a.type,b.type)}`)})}/>}
        {diagram?.type==='uml-activity'&&selected.type==='uml-signal'&&selectedNode&&can(`element.edit.${selected.type}`)&&can('element.create.uml-action')&&can('element.view.uml-action')&&can('diagram.layout.uml-activity')&&<section className="uml-properties"><strong>Señal histórica · conversión explícita</strong><p className="muted-mini">La señal sigue siendo un clasificador; esta aparición se reemplaza por una acción nueva vinculada a ella.</p>{(['sendSignal','acceptEvent'] as const).map(kind=><button key={kind} className="outlined" onClick={()=>{const id=uid();ask('Convertir aparición de señal',kind==='sendSignal'?'Crear acción Enviar señal conservando el clasificador y los enlaces del lienzo.':'Crear acción Aceptar evento conservando el clasificador y los enlaces del lienzo.',()=>{if(applyActivityCommand(old=>commandConvertLegacyActivitySignal(old,diagram.id,selectedNode.id,kind,id,dateOf()))){setSelectedId(id);setActiveOccurrence(id)}},false,'Convertir')}}>{kind==='sendSignal'?'Convertir a Enviar señal':'Convertir a Aceptar evento'}</button>)}</section>}
        {diagram?.type==='uml-activity'&&doc&&selected&&<ActivityDetailsEditor key={'activity-detail:'+selected.id} doc={doc} diagram={diagram} element={selected} disabled={!can(`element.edit.${selected.type}`)} onSave={activityDetail=>updateElement(selected.id,{activityDetail})}/>}
        {diagram?.interaction&&doc&&<SequenceDetailsEditor key={'sequence:'+selected.id} diagram={diagram} doc={doc} element={selected} disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')||!can(`diagram.edit.${diagram.type}`)} onSave={next=>applyActivityCommand(()=>next)}/>}
        {diagram?.type==='uml-deployment'&&can('element.technical.view')&&<DeploymentDetails key={`dep:${selected.id}`} doc={doc} element={selected} disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} onSave={partial=>applyActivityCommand(old=>commandEditElement(old,selected.id,partial,dateOf()))}/>}
        {diagram?.type==='uml-component'&&doc&&can('element.technical.view')&&<ComponentDetails key={`cmp:${selected.id}`} doc={doc} element={selected} disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} onSave={partial=>applyActivityCommand(old=>commandEditElement(old,selected.id,partial,dateOf()))}/>}{diagram?.type==='uml-component'&&doc&&can('element.technical.view')&&<ComponentCatalogRelations key={`cmp-rel:${selected.id}`} doc={doc} element={selected} disabled={!can('element.technical.edit')||!can('relation.edit.technical')} canDelete={can('relation.delete.technical')} onSave={next=>applyActivityCommand(()=>next)}/>}
        {diagram&&isUmlDiagram(diagram.type)&&diagram.type!=='uml-activity'&&!diagram.interaction&&can('element.technical.view')&&<UmlDetailsEditor key={`uml-structure:${selected.id}`} componentContext={diagram?.type==='uml-component'} element={selected} catalog={doc?.elements} disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} onChange={uml=>updateElement(selected.id,{uml})}/>}
        {diagram?.type==='uml-sequence'&&!diagram.interaction&&selected.type==='uml-frame'&&<>
         <Field label="Operador del fragmento combinado"><select aria-label="Operador del fragmento UML" disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} value={['alt','opt','loop','par'].includes(selected.uml?.classifier||'alt')?selected.uml?.classifier||'alt':'alt'} onChange={e=>updateElement(selected.id,{uml:{...(selected.uml||{}),classifier:e.target.value}})}>
          {['alt','opt','loop','par'].map(operator=><option value={operator} key={operator}>{operator}</option>)}
         </select></Field>
         <Field label="Guardas de los operandos (una por línea)"><textarea rows={3} aria-label="Guardas del fragmento combinado" disabled={!can(`element.edit.${selected.type}`)} value={selected.summary} placeholder={'[condición]\n[else]'} onChange={e=>updateElement(selected.id,{summary:e.target.value})}/></Field>
        </>}
        {!(diagram?.type==='uml-sequence'&&selected.type==='uml-frame')&&<Field label="Resumen"><textarea rows={2} value={selected.summary||''} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{summary:e.target.value})}/></Field>}
        <Field label="Descripción"><textarea rows={3} value={selected.description||''} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{description:e.target.value})}/></Field>
        {can('element.technical.view')&&<Field label="Detalle técnico"><textarea rows={2} value={selected.technical||''} disabled={!can(`element.edit.${selected.type}`)||!can('element.technical.edit')} placeholder="Backend, endpoint, entrada/salida..." onChange={e=>updateElement(selected.id,{technical:e.target.value})}/></Field>}
        <div className="inspector-pair"><Field label="Responsable"><input value={selected.owner||''} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{owner:e.target.value})}/></Field><Field label="Estado"><select value={selected.status} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{status:e.target.value})}>{[...new Set(['Borrador','En análisis','En desarrollo','En QA','Validado','Obsoleto',selected.status])].map(x=><option key={x}>{x}</option>)}</select></Field></div>
        <Field label="Autor"><input value={selected.author||''} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{author:e.target.value})}/></Field>
        <div className="inspector-pair"><Field label="Creación"><input type="date" value={selected.createdAt||today()} disabled={!can(`element.edit.${selected.type}`)} onChange={e=>updateElement(selected.id,{createdAt:e.target.value})}/></Field><Field label="Actualización"><input type="date" value={selected.updatedAt||today()} disabled readOnly/></Field></div>
        <div data-academy-view-link className={academyLinkPulse?'academy-link-highlight':''}><Field label="Vista vinculada (doble clic)"><select disabled={!can(`element.edit.${selected.type}`)||!can(`diagram.layout.${diagram?.type}`)} value={selectedLinkDiagramId||''} onChange={e=>{updateOccurrenceLink({childDiagramId:e.target.value||null,childNodeId:null});setAcademyLinkPulse(false)}}><option value="">Ninguna</option>{doc.diagrams.map(d=><option key={d.id} value={d.id}>{d.type.toUpperCase()} · {d.name}</option>)}</select></Field>{academyLinkPulse&&<p className="academy-inspector-tip">Elige el siguiente nivel C4 aquí. No crees una línea entre diagramas: enlaza la vista a esta caja y luego haz doble clic sobre ella.</p>}</div>{selectedLinkDiagramId&&<Field label="Caja de destino (opcional)"><select value={selectedLinkNodeId||''} disabled={!can(`element.edit.${selected.type}`)||!can(`diagram.layout.${diagram?.type}`)} onChange={e=>updateOccurrenceLink({childNodeId:e.target.value||null})}><option value="">Abrir vista general</option>{doc.diagrams.find(d=>d.id===selectedLinkDiagramId)?.nodes.map(n=><option key={n.id} value={n.id}>{doc.elements[n.elementId]?.name||'Caja sin nombre'}</option>)}</select></Field>}{selectedLinkDiagramId&&<button className="inspector-link" onClick={navigateChild}><Maximize2 size={14}/> Navegar dentro de esta caja <ArrowRight size={14}/></button>}
        <div className={'section-head academy-field-settings '+(academyFieldPulse?'academy-field-pulse':'')} data-academy-field-settings><strong>Campos personalizados</strong>{can('field.configure')&&<button type="button" aria-label="Configurar campos personalizados" onClick={()=>{
         if(academyFieldPulse){setFieldLabel(academyFieldPulse==='functional'?'Canal de solicitud':'Protocolo de integración');setFieldType(academyFieldPulse==='functional'?'requirement':'endpoint');setFieldKind(academyFieldPulse==='functional'?'select':'text');setFieldOptions(academyFieldPulse==='functional'?'Web, Móvil, API':'');setAcademyFieldPulse(null)}
         setDialog('fields')
        }}><Settings2 size={13}/> Configurar</button>}</div>{fieldDefs.length?fieldDefs.map(f=><Field key={f.id} label={f.label}>{f.kind==='textarea'?<textarea rows={2} disabled={!can(`element.edit.${selected.type}`)} value={String(selected.fields[f.id]||'')} onChange={e=>updateElement(selected.id,{fields:{...selected.fields,[f.id]:e.target.value}})}/>:f.kind==='select'?<select disabled={!can(`element.edit.${selected.type}`)} value={String(selected.fields[f.id]||'')} onChange={e=>updateElement(selected.id,{fields:{...selected.fields,[f.id]:e.target.value}})}><option value="">Seleccionar</option>{f.options?.map(o=><option key={o}>{o}</option>)}</select>:f.kind==='boolean'?<label className="switch-field"><input type="checkbox" disabled={!can(`element.edit.${selected.type}`)} checked={selected.fields[f.id]===true} onChange={e=>updateElement(selected.id,{fields:{...selected.fields,[f.id]:e.target.checked}})}/> Sí</label>:<input type={f.kind==='url'?'url':f.kind==='date'?'date':f.kind==='number'?'number':'text'} disabled={!can(`element.edit.${selected.type}`)} value={String(selected.fields[f.id]??'')} onChange={e=>updateElement(selected.id,{fields:{...selected.fields,[f.id]:e.target.value}})}/>}</Field>):<p className="muted-mini">Sin campos personalizados para este tipo.</p>}
        {diagram&&filters.length>0&&<section className="element-filters"><div className="section-head"><strong>Categorías de esta vista</strong><button onClick={()=>setDialog('diagram-filters')}>Configurar</button></div><p className="muted-mini">Una misma caja puede pertenecer a varios contextos dentro de este diagrama.</p>{filters.map(filter=><label key={filter.id} className="process-chip"><input type="checkbox" aria-label={`Asignar ${filter.label}`} disabled={!can(`diagram.layout.${diagram.type}`)} checked={diagram.nodes.some(n=>n.elementId===selected.id&&nodeFilterIds(n,diagram,doc!).includes(filter.id))} onChange={e=>toggleElementFilter(filter.id,e.target.checked)}/>{filter.label}</label>)}</section>}
        <div className="section-head"><strong>Enlaces externos</strong>{can(`element.edit.${selected.type}`)&&<button onClick={()=>{setLinkElementId(selected.id);setLinkLabel('');setLinkUrl('');setDialog('add-link')}}><Plus size={13}/> Agregar</button>}</div>{selected.links.map(l=><div key={l.id} className="external-link"><a href={safeLink(l.url)||'#'} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/><span>{l.label}</span></a>{can(`element.edit.${selected.type}`)&&<button title="Quitar enlace" onClick={()=>updateElement(selected.id,{links:selected.links.filter(x=>x.id!==l.id)})}><X size={13}/></button>}</div>)}{!selected.links.length&&<p className="muted-mini">Adjunta Jira, Azure DevOps, documentación o un caso de uso externo.</p>}
        <div className="section-head"><strong>Relaciones en el modelo</strong><span className="tiny-count">{related.length}</span></div>{related.map(e=><button className="relation-row" key={e.id} onClick={()=>navigateElement(e.id)}><IconFor type={e.type}/><span>{e.name}</span><ArrowRight size={12}/></button>)}{!related.length&&<p className="muted-mini">Conecta este elemento con otros usando el editor visual.</p>}
        {diagram&&can(`diagram.layout.${diagram.type}`)&&<button className="danger outlined full" onClick={deleteNode}><Trash2 size={14}/> Quitar caja de esta vista</button>}
       </>:<><div className="inspector-empty"><span><Network size={30}/></span><h4>Un modelo, múltiples vistas</h4><p>Selecciona una caja para editar sus campos, asociar casos de uso, añadir enlaces y navegar hacia sus implementaciones.</p></div>{diagram&&<><Field label="Nombre del diagrama"><input disabled={!can(`diagram.edit.${diagram.type}`)} value={diagram.name} onChange={e=>updateDiagram({name:e.target.value})}/></Field><Field label="Descripción"><textarea rows={3} disabled={!can(`diagram.edit.${diagram.type}`)} value={diagram.description} onChange={e=>updateDiagram({description:e.target.value})}/></Field>{diagram.type==='uml-deployment'&&doc&&diagram.edges.some(e=>!e.deploymentRelationId&&e.relationKind!=='annotation')&&can('element.technical.edit')&&<button className="outlined" onClick={()=>ask('Adaptar relaciones históricas','Solo se registrarán relaciones cuyo significado se puede comprobar. Las ambiguas permanecerán intactas.',()=>applyActivityCommand(old=>adaptDeploymentDocument(old,diagram.id)),false,'Adaptar')}>Adaptar relaciones históricas</button>}{diagram.type==='uml-deployment'&&doc&&can('element.technical.view')&&<DeploymentCatalog key={diagram.id} doc={doc} disabled={!can('element.technical.edit')||!can('relation.edit.technical')} onSave={next=>applyActivityCommand(()=>next)}/>} {diagram.type==='uml-component'&&doc&&can('element.technical.view')&&<ComponentCatalogRelations key={`cmp-global:${diagram.id}`} doc={doc} disabled={!can('element.technical.edit')||!can('relation.edit.technical')} canDelete={can('relation.delete.technical')} onSave={next=>applyActivityCommand(()=>next)}/>} {diagram.type==='uml-activity'&&doc&&<details className="activity-validation"><summary>Revisión de actividad ({activityDocumentIssues(doc).filter(i=>i.diagramId===diagram.id).length})</summary>{activityDocumentIssues(doc).filter(i=>i.diagramId===diagram.id).map(i=><button key={i.key} type="button" className="outlined" onClick={()=>{const n=diagram.nodes.find(n=>n.id===i.nodeId);if(n){setSelectedId(n.elementId);setActiveOccurrence(n.id);setInspectorOpen(true)}else if(i.edgeId){const e=diagram.edges.find(e=>e.id===i.edgeId);if(e){setClassRelation(e);setDialog('class-relation')}}}}>{i.message}</button>)}</details>}{diagram.type==='uml-sequence'&&doc&&(diagram.interaction?<SequenceRootEditor key={diagram.id} diagram={diagram} doc={doc} disabled={!can(`diagram.edit.${diagram.type}`)} onSave={interaction=>updateDiagram({interaction})}/>:can('diagram.edit.uml-sequence')&&can('element.technical.edit')&&<button className="outlined" onClick={()=>ask('Adaptar interacción histórica','Se conservan los datos históricos y se generan ocurrencias únicamente cuando se pueden determinar. Los mensajes ambiguos quedan pendientes de reparación.',()=>applyActivityCommand(old=>adaptSequenceDocument(old,diagram.id)),false,'Adaptar')}>Adaptar al modelo temporal</button>)}{diagram.type==='uml-activity'&&doc&&<ActivityRootEditor key={diagram.id} doc={doc} diagram={diagram} disabled={!can(`diagram.edit.${diagram.type}`)} onSave={activity=>updateDiagram({activity})}/>}<Field label="Tipo de vista"><select disabled={!can(`diagram.edit.${diagram.type}`)} value={diagram.type} onChange={e=>updateDiagram({type:e.target.value as DiagramType})}>{!diagramCreationEnabled(diagram.type)&&<option value={diagram.type}>{diagramLabels[diagram.type]} · existente</option>}<optgroup label="Arquitectura, procesos y trazabilidad">{DIAGRAM_TYPES.filter(t=>!t.startsWith('uml-')&&can(`diagram.create.${t}`)).map(t=><option value={t} key={t}>{diagramLabels[t]}</option>)}</optgroup>{UML_DIAGRAM_GROUPS.map(group=><optgroup key={group.title} label={group.title.replace(/ \(\d+\)$/,` (${group.types.filter(diagramCreationEnabled).length})`)}>{group.types.filter(t=>diagramCreationEnabled(t)&&can(`diagram.create.${t}`)).map(t=><option value={t} key={t}>{diagramLabels[t]}</option>)}</optgroup>)}</select></Field><p className="muted-mini">{diagramDescriptions[diagram.type]}</p>{can(`diagram.delete.${diagram.type}`)&&<button className="danger outlined full" onClick={deleteDiagram}><Trash2 size={14}/> Eliminar diagrama</button>}</>}</>}</div></aside>}
       </div>
     </>}
   </main>
   {academyOpen&&inFullscreenCanvas(<AcademyMissions
    lab={academyLab} workspaces={workspaces} projects={projects} catalogLoading={!workspacesLoaded||(Boolean(academyLab?.projectId)&&wsId===academyLab?.workspaceId&&!projectsLoaded)} activeWorkspaceId={wsId} activeProjectId={projectId}
    doc={doc} saveStatus={saveStatus} mode={mode} diagramId={diagramId} busy={academyBusy} paused={dialog!==null||pendingImport!==null||confirmation!==null} error={academyError}
    onClose={()=>setAcademyOpen(false)} onStartTour={()=>{setAcademyOpen(false);setTutorialOpen(true)}}
    onCreateWorkspace={createAcademyWorkspace} onCreateProject={createAcademyProject} onGoToLab={returnToAcademy}
    onOpenDiagram={academyCreateDiagram} onSelectDiagram={academySelectDiagram} onOpenNode={academyAddNode} onFocusLinkSource={academyFocusLinkSource}
    onReuse={academyReuse} onMixed={academyMixed} onOpenFields={academyOpenFields} onInspectElement={academyInspect}/>)}
   {tutorialOpen&&!dialog&&!pendingImport&&!confirmation&&inFullscreenCanvas(<GuidedTutorial onClose={()=>{setTutorialOpen(false);setTutorialCompleted(()=>{try{return !!localStorage.getItem(TUTORIAL_STORAGE_KEY)}catch{return false}})}}/>)}
   {toast&&<div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
   {saveStatus==='error'&&<div className="save-error" role="alert"><strong>No se guardaron los cambios.</strong> {saveError}<p>NOVZI fusiona automáticamente cambios independientes en diferentes diagramas, cajas o campos. Si dos personas cambian el mismo dato de forma incompatible, protege ambas versiones y conserva tu borrador en esta pestaña. No recargues sin revisar.</p><div className="save-recovery-actions"><button onClick={()=>setDialog('history')}>Ver historial</button>{can('artifact.export')&&<button onClick={downloadLocalBackup}>Descargar mis cambios</button>}<button onClick={()=>ask('Descartar borrador local','Perderás los cambios que no se han guardado en este navegador. Puedes descargar una copia antes de continuar si tienes permiso de exportación.',()=>location.reload(),true,'Descartar y recargar')}>Recargar desde servidor</button></div></div>}
   {descriptionOpen&&diagram&&<Overlay title="Descripción completa del diagrama" onClose={()=>setDescriptionOpen(false)} wide><div className="modal-body"><p className="novzi-description-full">{diagram.description||'Sin descripción'}</p><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setDescriptionOpen(false)}>Cerrar</button></div></div></Overlay>}
   {dialog==='new-organization'&&<Overlay title="Crear organización" onClose={()=>setDialog(null)}><div className="modal-body"><Field label="Nombre de la organización"><input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ej. Zercano"/></Field><div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>Cancelar</button><button className="primary" disabled={!emptyName(newName)} onClick={createOrganizationNow}>Crear organización</button></div></div></Overlay>}
   {dialog==='organization-settings'&&<OrganizationPanel organization={org||null} onClose={()=>setDialog(null)} onChanged={()=>{void listOrganizations().then(items=>{setOrganizations(items);setOrgId(previous=>items.some(o=>o.id===previous)?previous:items[0]?.id||'')});if(account)void listWorkspaces(account.id).then(setWorkspaces)}}/>}
   {(dialog==='new-workspace'||dialog==='new-project'||dialog==='new-diagram')&&<Overlay title={dialog==='new-workspace'?'Crear espacio de trabajo':dialog==='new-project'?'Crear proyecto':'Nuevo diagrama'} onClose={()=>setDialog(null)}><div className="modal-body"><Field label={dialog==='new-workspace'?'Nombre del espacio':dialog==='new-project'?'Nombre del proyecto':'Nombre del diagrama'}><input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder={dialog==='new-workspace'?'Ej. Dirección de Tecnología':dialog==='new-project'?'Ej. Plataforma de pagos':'Ej. Flujo de autenticación'}/></Field>{dialog==='new-diagram'&&<Field label="Tipo de visualización"><select value={newType} onChange={e=>setNewType(e.target.value as DiagramType)}><optgroup label="Arquitectura, procesos y trazabilidad">{DIAGRAM_TYPES.filter(t=>!t.startsWith('uml-')&&can(`diagram.create.${t}`)).map(t=><option value={t} key={t}>{diagramLabels[t]}</option>)}</optgroup>{UML_DIAGRAM_GROUPS.map(group=><optgroup key={group.title} label={group.title.replace(/ \(\d+\)$/,` (${group.types.filter(diagramCreationEnabled).length})`)}>{group.types.filter(t=>diagramCreationEnabled(t)&&can(`diagram.create.${t}`)).map(t=><option value={t} key={t}>{diagramLabels[t]}</option>)}</optgroup>)}</select></Field>}{dialog==='new-diagram'&&<div className="diagram-type-help" role="note"><strong>{diagramLabels[newType]}</strong><p>{diagramDescriptions[newType]}</p><small>{newType==='uml-usecase'?'Para vincular una HU de trazabilidad con un caso de uso, selecciona esa HU en la matriz y usa Vista vinculada → este diagrama → caja de destino.':newType.startsWith('uml-')?'El catálogo de cajas y relaciones se adapta al tipo UML. No se modifica la ficha compartida en otras vistas.':'Podrás crear filtros propios para esta vista después de guardarla.'}</small></div>}<div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>Cancelar</button><button className="primary" disabled={!emptyName(newName)} onClick={dialog==='new-workspace'?createWs:dialog==='new-project'?createPrj:addDiagram}><Plus size={15}/> Crear</button></div></div></Overlay>}
   {dialog==='new-node'&&inFullscreenCanvas(<Overlay title="Agregar caja al diagrama" onClose={()=>setDialog(null)} wide><div className="modal-body"><div className="segmented node-modal-tabs"><button className={nodeTab==='new'?'active':''} onClick={()=>setNodeTab('new')}>Crear elemento</button><button className={nodeTab==='existing'?'active':''} onClick={()=>setNodeTab('existing')}>Reutilizar existente</button></div>{nodeTab==='new'?<><Field label="Nombre de la caja"><input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ej. Motor de facturación"/></Field><Field label="Tipo de elemento"><select value={newElementType} onChange={e=>setNewElementType(e.target.value as ElementType)}>{ELEMENT_TYPES.filter(t=>can(`element.create.${t}`)&&(!diagram||umlElementCreatable(diagram.type,t))).map(t=><option key={t} value={t}>{diagramElementLabel(diagram?.type,t)}</option>)}</select></Field><div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>Cancelar</button><button className="primary" disabled={!emptyName(newName)||!diagram||!can(`element.create.${newElementType}`)||!umlElementCreatable(diagram.type,newElementType)} onClick={addNewNode}><Plus size={15}/> Agregar al lienzo</button></div></>:<><Field label="Buscar elemento del proyecto"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, tipo, resumen..."/></Field><div className="existing-list">{Object.values(doc?.elements||{}).filter(e=>(e.name+' '+e.type+' '+e.summary).toLowerCase().includes(query.toLowerCase())&&(diagram?.type==='uml-usecase'||!diagram?.nodes.some(n=>n.elementId===e.id))&&can(`element.view.${e.type}`)&&(!diagram||umlElementReusable(diagram.type,e.type))&&(diagram?.type!=='uml-activity'||(!e.activityCatalogDiagramId||e.activityCatalogDiagramId===diagram.id)&&!doc?.diagrams.some(d=>d.type==='uml-activity'&&d.nodes.some(n=>n.elementId===e.id)))).slice(0,100).map(e=>{const reusable=<button key={e.id} onClick={()=>addNode(e.id)}><IconFor type={e.type}/><span><strong>{e.name}</strong><small>{diagramElementLabel(diagram?.type,e.type)} · {e.summary}</small></span><Plus size={15}/></button>;const detached=!!doc&&can(`element.delete.${e.type}`)&&(!useCaseElementIsReferenced(doc,e.id))&&(diagram?.type==='uml-usecase'&&isUseCaseCatalogType(e.type)||diagram?.type==='uml-activity'&&e.activityCatalogDiagramId===diagram.id&&!activityCatalogReferenced(doc,e.id));return detached?<div className="uc-catalog-row" key={e.id}>{reusable}<button className="uc-catalog-delete" aria-label={`Eliminar del modelo: ${e.name}`} title="Eliminar ficha del modelo" onClick={()=>ask('Eliminar elemento del modelo',`Se eliminará definitivamente la ficha «${e.name}» del catálogo del proyecto, si no tiene referencias.`,()=>{if(diagram?.type==='uml-activity'){if(!applyActivityCommand(old=>commandDeleteDetachedActivityElement(old,e.id)))return}else patch(old=>commandDeleteDetachedUseCaseElement(old,e.id));setDialog(null)},true,'Eliminar del modelo')}><Trash2 size={15}/></button></div>:reusable})}{!Object.values(doc?.elements||{}).some(e=>(diagram?.type==='uml-usecase'||!diagram?.nodes.some(n=>n.elementId===e.id))&&can(`element.view.${e.type}`)&&(!diagram||umlElementReusable(diagram.type,e.type))&&(diagram?.type!=='uml-activity'||(!e.activityCatalogDiagramId||e.activityCatalogDiagramId===diagram.id)&&!doc?.diagrams.some(d=>d.type==='uml-activity'&&d.nodes.some(n=>n.elementId===e.id))))&&<p className="muted-mini">No hay más elementos disponibles.</p>}</div></>}</div></Overlay>)}
   {dialog==='fields'&&<Overlay title="Campos personalizados por tipo de elemento" onClose={()=>setDialog(null)} wide><div className="modal-body"><p className="dialog-description">Configura fichas específicas para componentes, requerimientos, procesos, endpoints y otros elementos. Los campos se comparten entre las vistas del mismo proyecto.</p><div className="field-grid"><Field label="Nombre del campo"><input value={fieldLabel} onChange={e=>setFieldLabel(e.target.value)} placeholder="Ej. Enlace en Azure DevOps" disabled={!can('field.configure')}/></Field><Field label="Aplica a"><select value={fieldType} disabled={!can('field.configure')} onChange={e=>setFieldType(e.target.value as ElementType|'all')}><option value="all">Todos los tipos</option>{ELEMENT_TYPES.map(t=><option value={t} key={t}>{diagramElementLabel(diagram?.type,t)}</option>)}</select></Field><Field label="Tipo de dato"><select value={fieldKind} disabled={!can('field.configure')} onChange={e=>setFieldKind(e.target.value as FieldKind)}>{FIELD_TYPES.map(t=><option value={t} key={t}>{fieldLabels[t]}</option>)}</select></Field><div className="field-add"><button className="primary" disabled={!can('field.configure')||!emptyName(fieldLabel)} onClick={addField}><Plus size={14}/> Crear campo</button></div></div>{fieldKind==='select'&&<Field label="Opciones separadas por coma"><input value={fieldOptions} disabled={!can('field.configure')} onChange={e=>setFieldOptions(e.target.value)} placeholder="Ej. Pendiente, En revisión, Finalizado"/></Field>}<div className="section-head"><strong>Campos configurados</strong><span className="tiny-count">{doc?.fieldDefinitions.length||0}</span></div><div className="defs-list">{doc?.fieldDefinitions.map(f=><div className="def-row" key={f.id}><span><strong>{f.label}</strong><small>{f.forType==='all'?'Todos':diagramElementLabel(diagram?.type,f.forType)} · {fieldLabels[f.kind]}</small></span>{can('field.configure')&&<button title="Eliminar campo" onClick={()=>ask('Eliminar campo personalizado',`Se eliminará la definición «${f.label}».`,()=>patch(old=>commandRemoveFieldDefinition(old,f.id)),true,'Eliminar campo')}><Trash2 size={14}/></button>}</div>)}</div></div></Overlay>}
   {dialog==='diagram-filters'&&diagram&&<Overlay title={`Filtros: ${diagram.name}`} onClose={()=>setDialog(null)} wide><div className="modal-body diagram-filter-settings">
    <p className="dialog-description">Define contextos, flujos, dominios o capas de este diagrama. Cada vista tiene filtros propios; las etiquetas se asignan a las cajas desde el inspector.</p>
    <div className="diagram-filter-add"><Field label="Nueva categoría"><input aria-label="Nueva categoría" autoFocus placeholder="Ej. Contexto externo, Técnico, Autenticación" value={filterLabel} onChange={e=>setFilterLabel(e.target.value)} maxLength={80}/></Field><button className="primary" disabled={!filterLabel.trim()} onClick={createFilter}><Plus size={15}/> Agregar filtro</button></div>
    {!filters.length&&<p className="muted-mini">Este diagrama aún no tiene categorías. Puedes crear tantas como necesites.</p>}
    <div className="diagram-filter-list">{filters.map(f=><div key={f.id} className="diagram-filter-row"><input aria-label={`Nombre de filtro ${f.label}`} value={filterRename[f.id]??f.label} onChange={e=>setFilterRename(old=>({...old,[f.id]:e.target.value}))}/><button className="ghost" onClick={()=>renameFilter(f.id)}>Guardar</button><button aria-label={`Eliminar filtro ${f.label}`} className="danger outlined" onClick={()=>removeFilter(f.id)}><Trash2 size={14}/></button></div>)}</div>
    <div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>Cerrar filtros</button></div>
   </div></Overlay>}
   {dialog==='class-relation'&&classRelation&&diagram&&doc&&(()=>{
    const current=diagram.edges.find(e=>e.id===classRelation.id),a=doc.elements[diagram.nodes.find(n=>n.id===classRelation.source)?.elementId||''],b=doc.elements[diagram.nodes.find(n=>n.id===classRelation.target)?.elementId||'']
    if(!a||!b)return null
    const scope=relationScope(a.type,b.type),editable=can(`relation.${current?'edit':'create'}.${scope}`)
    const close=()=>{setDialog(null);setClassRelation(null)}
    if(diagram.type==='uml-deployment')return <DeploymentRelationDialog doc={doc} diagram={diagram} initial={classRelation} disabled={!editable||!can('element.technical.edit')} onClose={close} onDelete={current&&can(`relation.delete.${scope}`)?()=>{close();ask('Quitar aparición','La asignación semántica permanece en el catálogo.',()=>applyActivityCommand(old=>commandRemoveRelation(old,diagram.id,current.id)),true,'Quitar aparición')}:undefined} onDeleteSemantic={current?.deploymentRelationId&&can(`relation.delete.${scope}`)?()=>{close();ask('Eliminar del modelo','Se eliminará la relación semántica y sus apariciones.',()=>applyActivityCommand(old=>removeDeploymentRecord(old,current.deploymentRelationId!)),true,'Eliminar del modelo')}:undefined} onSave={next=>editable&&applyActivityCommand(()=>next)}/>
    if(diagram.type==='uml-component')return <ComponentRelationDialog doc={doc} diagram={diagram} initial={classRelation} disabled={!editable||!can('element.technical.edit')} onClose={close} onDelete={current&&can(`relation.delete.${scope}`)?()=>{close();ask('Quitar relación de la vista','El significado permanece en el catálogo.',()=>applyActivityCommand(old=>commandRemoveRelation(old,diagram.id,current.id)),true,'Quitar aparición')}:undefined} onDeleteSemantic={current?.componentRelationId&&can(`relation.delete.${scope}`)?()=>{const id=current.componentRelationId!;close();ask('Eliminar relación del modelo','Se quitarán todas sus apariciones, si no hay referencias.',()=>applyActivityCommand(old=>removeComponentSemanticRelation(old,id)),true,'Eliminar del modelo')}:undefined} onSave={next=>editable&&applyActivityCommand(()=>next)}/>
    if(diagram.interaction)return <SequenceRelationDialog doc={doc} diagram={diagram} initial={classRelation} disabled={!editable||!can('diagram.edit.uml-sequence')} onClose={close} onDelete={current&&can(`relation.delete.${scope}`)?()=>{close();ask('Eliminar relación','Se quitará el mensaje y las ocurrencias sin referencias, conservando las demás fichas.',()=>applyActivityCommand(old=>commandRemoveRelation(old,diagram.id,current.id)),true,'Eliminar relación')}:undefined} onSave={next=>{if(editable&&applyActivityCommand(()=>next))close()}}/>
    if(diagram.type==='uml-activity')return <ActivityRelationDialog doc={doc} diagram={diagram} initial={classRelation} disabled={!editable} onClose={close} onDelete={current&&can(`relation.delete.${scope}`)?()=>{close();ask('Eliminar relación','Se quitará el flujo y las anotaciones relacionadas.',()=>applyActivityCommand(old=>commandRemoveRelation(old,diagram.id,current.id)),true,'Eliminar relación')}:undefined} onSave={edge=>{if(!editable)return;patch(old=>current?commandEditRelation(old,diagram.id,edge.id,edge):commandConnectNodes(old,diagram.id,edge));close()}}/>
    if(diagram.type==='uml-usecase')return <UseCaseRelationDialog doc={doc} diagram={diagram} initial={classRelation} disabled={!editable} onClose={close} onDelete={current&&can(`relation.delete.${scope}`)?()=>{close();ask('Eliminar relación','Se quitará esta aparición de la relación.',()=>patch(old=>commandRemoveRelation(old,diagram.id,current.id)),true,'Eliminar relación')}:undefined} onDeleteSemantic={current?.semanticRelationId&&current.relationKind!=='annotation'&&can(`relation.delete.${scope}`)?()=>{const id=current.semanticRelationId!;close();ask('Eliminar relación del modelo','Se eliminará su significado y todas sus apariciones y anotaciones. Esta acción requiere permiso sobre el modelo.',()=>patch(old=>removeUseCaseSemanticRelation(old,id)),true,'Eliminar del modelo')}:undefined} onSave={edge=>{if(!editable)return;const next=replaceUseCaseRelation(doc,diagram.id,edge);for(const view of next.diagrams){for(const e of view.edges){const old=doc.diagrams.find(d=>d.id===view.id)?.edges.find(x=>x.id===e.id);if(JSON.stringify(old)===JSON.stringify(e))continue;const a=next.elements[view.nodes.find(n=>n.id===e.source)?.elementId||''],b=next.elements[view.nodes.find(n=>n.id===e.target)?.elementId||''];if(!a||!b||!can(`relation.${old?'edit':'create'}.${relationScope(a.type,b.type)}`))throw Error('No tienes permiso para modificar todas las apariciones')}}patch(snapshot=>replaceUseCaseRelation(snapshot,diagram.id,edge));close()}}/>
    return <ClassRelationDialog doc={doc} diagram={diagram} initial={classRelation} disabled={!editable} onClose={close} onDelete={current&&can(`relation.delete.${scope}`)?()=>{close();ask('Eliminar relación',`Se eliminará la relación «${current.label||'Sin nombre'}» y las anotaciones que dependen de ella; las fichas se conservan.`,()=>{patch(old=>commandRemoveRelation(old,diagram.id,current.id));announce('Relación eliminada')},true,'Eliminar relación')}:undefined} onSave={edge=>{if(!editable)return;const from=doc.elements[diagram.nodes.find(n=>n.id===edge.source)?.elementId||''],to=doc.elements[diagram.nodes.find(n=>n.id===edge.target)?.elementId||''];if(!from||!to||!can(`relation.${current?'edit':'create'}.${relationScope(from.type,to.type)}`))return;const candidate=replaceClassRelationAcrossViews(doc,diagram.id,edge);for(const view of candidate.diagrams){const previous=doc.diagrams.find(d=>d.id===view.id);for(const updated of view.edges){const old=previous?.edges.find(e=>e.id===updated.id);if(JSON.stringify(old)===JSON.stringify(updated))continue;const a=candidate.elements[view.nodes.find(n=>n.id===updated.source)?.elementId||''],b=candidate.elements[view.nodes.find(n=>n.id===updated.target)?.elementId||''];if(!a||!b||!can(`relation.${old?'edit':'create'}.${relationScope(a.type,b.type)}`))throw Error('No tienes permiso para actualizar la asociación en todas sus apariciones')}}patch(old=>replaceClassRelationAcrossViews(old,diagram.id,edge));close()}}/>
   })()}
   {dialog==='edit-relation'&&edgeEdit&&<Overlay title="Configurar relación" onClose={()=>setDialog(null)}><div className="modal-body"><div className="relation-settings-grid novzi-reconnect-selectors"><Field label="Origen de la relación"><select aria-label="Origen de la relación" disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.source} onChange={e=>setEdgeEdit(old=>old?{...old,source:e.target.value,sourceHandle:undefined}:old)}>{diagram?.nodes.filter(n=>doc?.elements[n.elementId]&&can(`element.view.${doc.elements[n.elementId].type}`)).map(n=><option key={n.id} value={n.id}>{doc!.elements[n.elementId].name}</option>)}</select></Field><Field label="Destino de la relación"><select aria-label="Destino de la relación" disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.target} onChange={e=>setEdgeEdit(old=>old?{...old,target:e.target.value,targetHandle:undefined}:old)}>{diagram?.nodes.filter(n=>doc?.elements[n.elementId]&&can(`element.view.${doc.elements[n.elementId].type}`)).map(n=><option key={n.id} value={n.id}>{doc!.elements[n.elementId].name}</option>)}</select></Field></div><Field label="Nombre o protocolo de la relación"><input autoFocus disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={diagram&&umlRelationNameLocked(diagram.type,edgeEdit.relationKind||'')?umlRelationNotation(edgeEdit.relationKind||'').label||'':edgeEdit.label} readOnly={!!diagram&&umlRelationNameLocked(diagram.type,edgeEdit.relationKind||'')} onChange={e=>setEdgeEdit(old=>old?{...old,label:e.target.value}:old)} placeholder="Ej. HTTPS, publica evento, consulta"/></Field>
    {diagram&&UML_RELATIONS_BY_DIAGRAM[diagram.type]&&<Field label="Tipo de relación UML"><select aria-label="Tipo de relación UML" disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.relationKind||UML_RELATIONS_BY_DIAGRAM[diagram.type]![0]} onChange={e=>setEdgeEdit(old=>old?{...old,relationKind:e.target.value,lineStyle:umlRelationNotation(e.target.value).stroke,direction:umlRelationNotation(e.target.value).direction}:old)}>{edgeEdit.relationKind&&!UML_RELATIONS_BY_DIAGRAM[diagram.type]!.includes(edgeEdit.relationKind)&&<option value={edgeEdit.relationKind}>{diagram.type==='uml-deployment'&&['dependency','manifestation'].includes(edgeEdit.relationKind)?'Dependencia / Despliegue / Manifestación — '+umlRelationLabel(edgeEdit.relationKind):umlRelationLabel(edgeEdit.relationKind)} · histórica</option>}{UML_RELATIONS_BY_DIAGRAM[diagram.type]!.filter(kind=>{const edge=diagram.edges.find(e=>e.id===edgeEdit.edgeId);const source=doc?.elements[diagram.nodes.find(n=>n.id===edge?.source)?.elementId||''];const target=doc?.elements[diagram.nodes.find(n=>n.id===edge?.target)?.elementId||''];return !source||!target||umlRelationEndpointValid(diagram.type,kind,source.type,target.type)}).map(kind=><option key={kind} value={kind}>{umlRelationLabel(kind)}</option>)}</select></Field>}{diagram&&(diagram.type==='uml-object'||diagram.type==='uml-class'&&['association','navigable-association','bidirectional-association','aggregation','composition'].includes(edgeEdit.relationKind||'association'))&&<div className="relation-settings-grid"><Field label="Multiplicidad origen"><input aria-label="Multiplicidad origen UML" value={edgeEdit.sourceMultiplicity} disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} placeholder="1" onChange={e=>setEdgeEdit(old=>old?{...old,sourceMultiplicity:e.target.value}:old)}/></Field><Field label="Multiplicidad destino"><input aria-label="Multiplicidad destino UML" value={edgeEdit.targetMultiplicity} disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} placeholder="0..*" onChange={e=>setEdgeEdit(old=>old?{...old,targetMultiplicity:e.target.value}:old)}/></Field><Field label="Rol origen"><input aria-label="Rol origen UML" value={edgeEdit.sourceRole} disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} onChange={e=>setEdgeEdit(old=>old?{...old,sourceRole:e.target.value}:old)}/></Field><Field label="Rol destino"><input aria-label="Rol destino UML" value={edgeEdit.targetRole} disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} onChange={e=>setEdgeEdit(old=>old?{...old,targetRole:e.target.value}:old)}/></Field></div>}{diagram&&isUmlDiagram(diagram.type)&&<div className="uml-notation-readonly" role="note"><strong>Notación UML 2.5.1</strong><span>El tipo de relación define la dirección y el trazo. Selecciona otro tipo UML para cambiar la notación.</span></div>}
    {(!diagram||!isUmlDiagram(diagram.type))&&<div className="relation-settings-grid"><Field label="Dirección"><select disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.direction} onChange={e=>setEdgeEdit(old=>old?{...old,direction:e.target.value as EdgeDirection}:old)}><option value="forward">Origen → destino</option><option value="reverse">Destino → origen</option><option value="both">Bidireccional ↔</option><option value="none">Sin flechas</option></select></Field>
    <Field label="Trazo"><select disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.lineStyle} onChange={e=>setEdgeEdit(old=>old?{...old,lineStyle:e.target.value as EdgeLineStyle}:old)}><option value="solid">Continua</option><option value="dashed">Discontinua</option><option value="dotted">Punteada</option></select></Field></div>}
    {diagram&&!isUmlDiagram(diagram.type)&&<div className="relation-settings-grid"><Field label="Conector de salida"><select aria-label="Conector de salida" disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.sourceHandle||'right'} onChange={e=>setEdgeEdit(old=>old?{...old,sourceHandle:e.target.value,portsLocked:true}:old)}>{['right','left','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'].map(handle=><option key={handle} value={handle}>{handle}</option>)}</select></Field><Field label="Conector de llegada"><select aria-label="Conector de llegada" disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.targetHandle||'left'} onChange={e=>setEdgeEdit(old=>old?{...old,targetHandle:e.target.value,portsLocked:true}:old)}>{['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'].map(handle=><option key={handle} value={handle}>{handle}</option>)}</select></Field></div>}
    {diagram&&!isUmlDiagram(diagram.type)&&<label className="muted-mini"><input type="checkbox" checked={!!edgeEdit.portsLocked} disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} onChange={e=>setEdgeEdit(old=>old?{...old,portsLocked:e.target.checked}:old)}/> Conservar conectores de salida y llegada cuando se organice el diagrama</label>}
    <div className="relation-settings-grid">    <Field label="Recorrido"><select disabled={!edgeScope||!can(`relation.edit.${edgeScope}`)} value={edgeEdit.pathStyle} onChange={e=>setEdgeEdit(old=>old?{...old,pathStyle:e.target.value as EdgePathStyle}:old)}><option value="smoothstep">Ortogonal redondeada</option><option value="step">Ortogonal</option><option value="straight">Recta</option><option value="bezier">Curva</option></select></Field></div>
    <div className="modal-actions relation-modal-actions">{edgeScope&&diagram&&!isUmlDiagram(diagram.type)&&can(`relation.edit.${edgeScope}`)&&<button className="ghost" onClick={()=>{setRouteEditorEdgeId(edgeEdit.edgeId);setDialog(null);announce('Arrastra los controles azules de la línea; los puntos amarillos ajustan los giros. Los cambios se guardan al soltar.')}}><MousePointer2 size={14}/> Editar recorrido en el lienzo</button>}{edgeScope&&can(`relation.delete.${edgeScope}`)&&<button className="danger outlined" onClick={deleteSelectedRelation}><Trash2 size={14}/> Eliminar relación</button>}<button className="ghost" onClick={()=>setDialog(null)}>Cancelar</button>{edgeScope&&can(`relation.edit.${edgeScope}`)&&<button className="primary" onClick={saveEdgeLabel}>Guardar relación</button>}</div></div></Overlay>}
   {dialog==='organize'&&diagram&&<Overlay title="Organizar para lectura" onClose={()=>setDialog(null)}><div className="modal-body"><p className="dialog-description">Distribuye las cajas por capas de entrada, negocio, integraciones y persistencia cuando el tipo de diagrama lo permite. Conserva las relaciones y los giros ajustados manualmente.</p><Field label="Prioridad de diseño"><select aria-label="Modo de organización" value={beautifyMode} onChange={e=>setBeautifyMode(e.target.value as BeautifyMode)}><option value="presentation">Legible / presentación · más espacio y menos cruces</option><option value="compact">Compacto / edición · menos desplazamiento</option></select></Field><p className="muted-mini">Los diagramas UML conservan su notación. Guarda una copia JSON antes de reorganizar un diagrama complejo. Puedes cancelar sin cambios.</p><div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>Cancelar</button><button className="primary" onClick={acceptOrganize}>Aplicar organización</button></div></div></Overlay>}
   {dialog==='add-link'&&<Overlay title="Agregar enlace externo" onClose={()=>setDialog(null)}><div className="modal-body"><Field label="Etiqueta del enlace"><input autoFocus value={linkLabel} onChange={e=>setLinkLabel(e.target.value)} placeholder="Ej. Caso de uso, Jira, Azure DevOps"/></Field><Field label="URL HTTPS"><input type="url" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://..."/></Field><div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>Cancelar</button><button className="primary" disabled={!linkLabel.trim()||!safeLink(linkUrl)} onClick={saveExternalLink}>Agregar enlace</button></div></div></Overlay>}
   {dialog==='export-diagram'&&<Overlay title="Exportar desde NOVZI" onClose={()=>{if(!exportBusy)setDialog(null)}}><div className="modal-body novzi-export-modal">
    <p className="dialog-description">Exporta el proyecto como JSON o el diagrama actual como imagen firmada por NOVZI.</p>
    <Field label="Formato"><select aria-label="Formato de exportación" value={exportFormat} onChange={e=>setExportFormat(e.target.value as 'project-json'|'diagram-json'|'png'|'jpg')} disabled={exportBusy}>
     <option value="project-json">JSON · Proyecto completo</option><option value="diagram-json" disabled={!diagram}>JSON · Solo diagrama actual</option><option value="png" disabled={!diagram}>PNG · Diagrama actual</option><option value="jpg" disabled={!diagram}>JPG · Diagrama actual</option>
    </select></Field>
    {!['project-json','diagram-json'].includes(exportFormat)&&doc&&diagram&&<div className="novzi-export-advanced-choice">
     <Field label="Contenido de la exportación"><select aria-label="Contenido de exportación" value={advancedExportMode} onChange={e=>{const next=e.target.value as AdvancedExportMode;setAdvancedExportMode(next);setAdvancedExportFields(old=>normalizeChoices(old,next))}} disabled={exportBusy}>
      <option value="simple">Solo diagrama · Disponible para todos</option>
      <option value="embedded" disabled={!exportLicense?.features['diagram.export.advanced']}>Campos embebidos en la imagen · PRO</option>
      <option value="dictionary" disabled={!exportLicense?.features['diagram.export.advanced']}>Fichas de elementos (ZIP) · PRO</option>
      <option value="both" disabled={!exportLicense?.features['diagram.export.advanced']}>Imagen + fichas de elementos (ZIP) · PRO</option>
     </select></Field>
     {!exportLicense?.features['diagram.export.advanced']&&<p className="muted-mini">Exportar campos, relaciones y vínculos es una funcionalidad PRO. Activa una licencia de prueba en «Licencia» para utilizarla.</p>}
     {['dictionary','both'].includes(advancedExportMode)&&<Field label="Formato de las fichas"><select aria-label="Formato de las fichas" value={exportDocumentFormat} disabled={exportBusy} onChange={e=>setExportDocumentFormat(e.target.value as 'html'|'pdf'|'docx')}><option value="pdf">PDF · Para compartir o imprimir</option><option value="docx">Word · Documento editable</option><option value="html">HTML · Para abrir en navegador</option></select></Field>}
     {advancedExportMode!=='simple'&&<AdvancedExportFields doc={doc} diagram={diagram} mode={advancedExportMode} choices={advancedExportFields} onChange={setAdvancedExportFields}/>}
    </div>}
    {!['project-json','diagram-json'].includes(exportFormat)&&<div className="novzi-license-notice" role="status"><ShieldCheck size={18}/><span>{exportLicense?.licenseActive&&exportLicense.features['diagram.export.clean']?'Licencia activa: sin marca de agua visible. Imagen firmada y auditada.':exportLicense?'Sin licencia comercial: imagen con marca de agua. Firma digital y auditoría incluidas.':'Comprobando licencia… El servidor determina siempre los permisos.'}</span></div>}
    <p className="muted-mini">Las exportaciones de imagen usan la última versión guardada. No se puede desactivar la firma ni la marca de agua desde el navegador.</p>
    <div className="modal-actions"><button type="button" className="ghost" disabled={exportBusy} onClick={()=>setDialog(null)}>Cancelar</button><button type="button" className="primary" disabled={exportBusy||(!['project-json','diagram-json'].includes(exportFormat)&&(!diagram||saveStatus!=='saved'||!exportLicense))} onClick={()=>void exportSelected()}><Download size={15}/>{exportBusy?'Generando imagen…':exportFormat==='project-json'?'Descargar JSON del proyecto':exportFormat==='diagram-json'?'Descargar JSON del diagrama':'Descargar '+exportFormat.toUpperCase()}</button></div>
   </div></Overlay>}
   {pendingImport&&<Overlay title="Confirmar importación" onClose={()=>{if(!importBusyRef.current)setPendingImport(null)}}><div className="modal-body">{pendingImport.mode==='diagram'?<><p><strong>Reemplazar solo el diagrama activo.</strong> Los otros diagramas, fichas existentes y relaciones compartidas se conservarán. Los elementos importados tendrán identidades nuevas.</p><p>Destino: <strong>{doc?.diagrams.find(d=>d.id===pendingImport.targetDiagramId)?.name}</strong></p><Field label="Diagrama de origen"><select aria-label="Diagrama de origen" disabled={importBusy} value={pendingImport.sourceDiagramId||''} onChange={e=>setPendingImport(old=>old?{...old,sourceDiagramId:e.target.value}:null)}><option value="">Seleccionar diagrama</option>{pendingImport.document.diagrams.filter(d=>d.type===doc?.diagrams.find(x=>x.id===pendingImport.targetDiagramId)?.type).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><p className="muted-mini">Si faltan dependencias de otras vistas, se rechazará la importación; puedes importar el proyecto completo en su lugar.</p></>:<><p><strong>Reemplazar el proyecto completo.</strong> Se sustituirán todos sus diagramas, fichas y definiciones de campos. La revisión anterior quedará en el historial.</p><p><strong>{pendingImport.document.diagrams.length} diagramas y {Object.keys(pendingImport.document.elements).length} elementos.</strong></p></>}<p>El servidor validará permisos, referencias, reglas UML y versión antes de guardar.</p><div className="modal-actions"><button className="ghost" disabled={importBusy} onClick={()=>setPendingImport(null)}>Cancelar</button><button className="primary" disabled={importBusy||pendingImport.mode==='diagram'&&!pendingImport.sourceDiagramId} onClick={()=>void commitImport()}>{importBusy?'Importando…':'Importar documento'}</button></div></div></Overlay>}
   {confirmation&&<Overlay title={confirmation.title} onClose={()=>setConfirmation(null)}><div className="modal-body"><p className="dialog-description">{confirmation.description}</p><div className="modal-actions"><button className="ghost" onClick={()=>setConfirmation(null)}>Cancelar</button><button className={confirmation.danger?'danger outlined':'primary'} onClick={()=>{const fn=confirmation.onAccept;setConfirmation(null);fn()}}>{confirmation.button}</button></div></div></Overlay>}
   {dialog==='license'&&wsId&&<LicensePanel workspaceId={wsId} workspaceName={ws?.name||'NOVZI'} platformAdmin={!!account.platformAdmin} onClose={()=>setDialog(null)}/>}
   {dialog==='history'&&projectId&&diagram&&<DiagramVersionHistory projectId={projectId} diagramId={diagram.id} diagramName={diagram.name} canCheckpoint={saveStatus==='saved'&&!!canEdit} canRestore={projectPolicy?.roleKey==='owner'&&saveStatus==='saved'} onRestored={handleVersionRestored} onOpenProjectHistory={()=>setDialog('project-history')} onClose={()=>setDialog(null)}/>}
   {dialog==='project-history'&&projectId&&<VersionHistory projectId={projectId} currentVersion={currentVersion} canRestore={projectPolicy?.roleKey==='owner'&&saveStatus==='saved'} onRestored={handleVersionRestored} onClose={()=>setDialog(null)}/>}
   {dialog==='audit'&&wsId&&<AuditPanel workspaceId={wsId} onClose={()=>setDialog(null)}/>}
   {dialog==='workspace-settings'&&ws&&<WorkspaceSettings workspace={ws} access={accessPolicy} onClose={()=>setDialog(null)} onRenamed={(id,name)=>{setWorkspaces(old=>old.map(x=>x.id===id?{...x,name}:x));announce('Espacio actualizado')}} onDeleted={id=>{setWorkspaces(old=>old.filter(x=>x.id!==id));setWsId(workspaces.find(x=>x.id!==id)?.id||'');setProjects([]);setProjectId('');setDoc(null);setDialog(null);announce('Espacio eliminado')}}/>}
   {dialog==='project-settings'&&project&&<ProjectSettings project={project} access={projectPolicy} canEditNow={saveStatus==='saved'} onClose={()=>{setDialog(null);void apiProjectAccess(project.id).then(setProjectPolicy).catch(()=>{})}} onRenamed={updated=>{setProjects(old=>old.map(x=>x.id===updated.id?updated:x));announce('Proyecto actualizado')}} onDeleted={id=>{setProjects(old=>old.filter(x=>x.id!==id));setProjectId(projects.find(x=>x.id!==id)?.id||'');setDoc(null);setDialog(null);announce('Proyecto eliminado')}}/>}
 </div>
}
export default function NovziEditor(){return <ReactFlowProvider><AppInner/></ReactFlowProvider>}
