import {pool} from './pool'
async function main(){const {rows}=await pool.query<{n:string}>('SELECT count(*)::text AS n FROM atlas_users WHERE platform_admin=true AND active=true');await pool.end();if(Number(rows[0].n)<1){console.error('ATLAS sin administrador. Ejecuta npm run admin:setup.');process.exitCode=2}else console.log('Administrador activo: OK')}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;void pool.end()})
