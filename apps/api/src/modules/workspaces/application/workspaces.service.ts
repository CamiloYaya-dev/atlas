import {WorkspacesRepository} from '../infrastructure/workspaces.repository'
import {cleanName} from '../../../domain/errors'
export class WorkspacesService {
 constructor(private readonly repo=new WorkspacesRepository()){}
 list(userId:string){return this.repo.listForUser(userId)}
 create(name:unknown,userId:string){return this.repo.create(cleanName(name,120),userId)}
}
