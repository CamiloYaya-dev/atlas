import {spawnSync} from 'node:child_process';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {command,npm} from './process-utils.mjs';
import {assertDisposableQaService} from './qa-db-guard.mjs';

const root=resolve(import.meta.dirname,'..');
const reportDir=resolve(root,'test-results','qa');
const summaryTxt=resolve(reportDir,'integration-summary.txt');
const summaryJson=resolve(reportDir,'integration-summary.json');

await mkdir(reportDir,{recursive:true});
// Evitar mostrar informes de una ejecución previa cuando la preparación falla.
await Promise.all([rm(summaryTxt,{force:true}),rm(summaryJson,{force:true})]);

async function setupFailure(stage,message,code=1){
  const summary=[
    'NOVZI QA INTEGRATION — PREPARACIÓN FALLIDA',
    `Etapa: ${stage}`,
    `Motivo: ${message}`,
    'Pruebas de integración ejecutadas: 0 (NO se ejecutaron)',
    'No interpretar este resultado como fallos de aserciones.',
    'Base afectada: únicamente QA novzi_test, 127.0.0.1:5433.',
    ''
  ].join('\n');
  await Promise.all([
    writeFile(summaryTxt,summary,'utf8'),
    writeFile(summaryJson,JSON.stringify({status:'setup-failed',stage,message,testsExecuted:0},null,2)+'\n','utf8')
  ]);
  console.error('\n'+summary);
  process.exitCode=code||1;
}

// Comprobación previa de seguridad: si db_test dejara de ser efímera,
// NO ejecutar una recreación destructiva por accidente.
const config=spawnSync('docker',['compose','--profile','test','config','--format','json'],{
  cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,windowsHide:true
});
if(config.error||config.status!==0){
  await setupFailure('Verificación de Docker Compose',config.error?.message||config.stderr?.trim()||`Código ${config.status}`);
}else{
  let safe=false;
  try{
    assertDisposableQaService(JSON.parse(config.stdout));
    safe=true;
  }catch(error){
    await setupFailure('Protección de la base QA',error.message);
  }
  if(safe){
    console.log('[NOVZI QA] Recreando SOLO db_test: datos ficticios temporales en tmpfs, puerto 5433.');
    const code=await command('docker',['compose','--profile','test','up','-d','--force-recreate','--wait','db_test']);
    if(code!==0){
      await setupFailure('Inicialización de PostgreSQL QA','No se pudo recrear db_test.',code);
    }else{
      const testEnv={
        DATABASE_URL:'postgresql://novzi:novzi_test_only@127.0.0.1:5433/novzi_test',
        MIGRATIONS_DATABASE_URL:'postgresql://novzi:novzi_test_only@127.0.0.1:5433/novzi_test',
        NODE_ENV:'test',AUTH_MODE:'local',
        NOVZI_CSRF_SECRET:'qa-local-secret-key-novzi-integration-2026-not-production',
        NOVZI_ALLOW_DB_TESTS:'true'
      };
      console.log('Migrando EXCLUSIVAMENTE la base de prueba local en puerto 5433...');
      const migrate=await npm(['run','db:migrate'],testEnv);
      if(migrate!==0){
        await setupFailure('Migraciones QA','db:migrate terminó con error; las pruebas no llegaron a ejecutarse.',migrate);
      }else{
        console.log('Ejecutando pruebas de integración y aislamiento...');
        const tests=await npm(['run','test:integration'],testEnv);
        process.exitCode=tests||0;
      }
    }
  }
}
