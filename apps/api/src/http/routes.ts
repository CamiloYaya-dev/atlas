import type {FastifyInstance} from 'fastify'
import {pool} from '../db/pool'
import {registerAuthRoutes} from '../modules/auth/presentation/auth.controller'
import {registerAdminController} from '../modules/admin/presentation/admin.controller'
import {registerAccessController} from '../modules/access/presentation/access.controller'
import {registerWorkspaceController} from '../modules/workspaces/presentation/workspaces.controller'
import {registerProjectMembersController} from '../modules/projects/presentation/project-members.controller'
import {registerLicensingController} from '../modules/licensing/licensing.controller'
import {registerExportsController} from '../modules/exports/exports.controller'
import {registerProjectController} from '../modules/projects/presentation/projects.controller'
export async function routes(app:FastifyInstance){
 app.get('/api/v1/health',async()=>({status:'ok',service:'atlas-api'}))
 app.get('/api/v1/ready',async(_req,reply)=>{try{await pool.query('SELECT 1');return {status:'ready',database:'connected'}}catch{return reply.code(503).send({status:'unavailable',database:'disconnected'})}})
 await registerAuthRoutes(app)
 await registerAdminController(app)
 await registerAccessController(app)
 await registerWorkspaceController(app)
 await registerProjectController(app)
 await registerProjectMembersController(app)
 await registerLicensingController(app)
 await registerExportsController(app)
}
