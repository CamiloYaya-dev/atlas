import { useEffect, useState } from 'react'
import { Overlay, Field } from '../../components/molecules/Overlay'
import { DeleteConfirmation } from '../../components/molecules/DeleteConfirmation'
import { renameWorkspace, deleteWorkspace } from './api'
import { listProjects } from '../projects/api'
import type { Workspace, Project } from '@atlas/contracts'
import type { WorkspaceAccess } from '../security/types'
interface Props { workspace: Workspace; access: WorkspaceAccess | null; onClose: () => void; onRenamed: (id: string, name: string) => void; onDeleted: (id: string) => void }
export default function WorkspaceSettings({ workspace, access, onClose, onRenamed, onDeleted }: Props) {
    const [name, setName] = useState(workspace.name), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(false), [containedProjects, setContainedProjects] = useState<Project[]>([])
    const can = (key: string) => access?.roleKey === 'owner' || !!access?.permissions.includes(key)
    useEffect(() => setName(workspace.name), [workspace.id, workspace.name])
    async function rename() {
        if (name.trim().length < 2 || busy) return; setBusy(true); setError(''); setNotice('')
        try { const result = await renameWorkspace(workspace.id, name.trim()); onRenamed(result.id, result.name); setNotice('Nombre del espacio actualizado correctamente.') }
        catch (e) { setError((e as Error).message || String(e)) } finally { setBusy(false) }
    }
    async function requestDeletion() {
        setBusy(true); setError(''); setNotice('')
        try { const projects = await listProjects(workspace.id); setContainedProjects(projects); setConfirmDelete(true) }
        catch (e) { setError((e as Error).message || String(e)) } finally { setBusy(false) }
    }
    async function remove() {
        setBusy(true); setError('')
        try { await deleteWorkspace(workspace.id, workspace.name, containedProjects.length > 0); onDeleted(workspace.id) }
        catch (e) { setError((e as Error).message || String(e)) } finally { setBusy(false) }
    }
    //const mayDeleteProjects=access?.roleKey==='owner'
    return <>
        {!confirmDelete && <Overlay title={`Administrar espacio: ${workspace.name}`} onClose={onClose} wide>
            <div className="modal-body">
                <p className="sec-help">Los permisos de este espacio determinan quién puede crear proyectos, administrar miembros y modificar el espacio. Cada proyecto tiene sus propios permisos.</p>
                {error && !confirmDelete && <div role="alert" className="sec-error">{error}</div>}
                {notice && <div className="sec-notice" role="status">{notice}</div>}
                <Field label="Nombre del espacio"><input value={name} disabled={!can('workspace.rename') || busy} onChange={e => setName(e.target.value)} /></Field>
                <div className="modal-actions"><button onClick={onClose}>Cerrar</button>{can('workspace.rename') && <button className="primary" disabled={busy || name.trim().length < 2 || name.trim() === workspace.name} onClick={() => void rename()}>Guardar nombre</button>}</div>
                {can('workspace.delete') && <div className="sec-create-role"><h4>Eliminar espacio</h4><p className="sec-help">La eliminación requiere una confirmación dentro de ATLAS. Si contiene proyectos, solo su propietario puede eliminar el espacio completo y todo su contenido.</p><button className="danger outlined" disabled={busy} onClick={() => void requestDeletion()}>Eliminar espacio…</button></div>}
            </div>
        </Overlay>}
        {confirmDelete && <DeleteConfirmation
            title={`Eliminar espacio: ${workspace.name}`}
            name={workspace.name}
            description={containedProjects.length === 0 ? 'El espacio no contiene proyectos. Esta acción es irreversible.' : `Este espacio contiene ${containedProjects.length} proyecto(s): ${containedProjects.map(p => p.name).join(', ')}.`}
            consequences={containedProjects.length > 0 ? 'ATENCIÓN: se eliminarán TODOS los proyectos, diagramas, versiones históricas y asignaciones de este espacio. No podrás recuperarlos desde la aplicación. Genera primero una copia de seguridad.' : 'Se eliminarán los miembros, permisos y registros asociados a este espacio.'}
            checkboxLabel={containedProjects.length > 0 ? 'Entiendo que también se eliminarán de manera definitiva TODOS los proyectos y diagramas del espacio.' : undefined}
            busy={busy} error={error}
            onCancel={() => { setConfirmDelete(false); setError('') }}
            onConfirm={remove}
        />}
    </>
}
