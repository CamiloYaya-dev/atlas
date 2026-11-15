import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {COVERAGE_METRICS} from './coverage-target.mjs'
const row=(total,covered)=>Object.fromEntries(COVERAGE_METRICS.map(m=>[m,{total,covered,skipped:0,pct:100*covered/total}]))
test('el informe presenta API, Web y contratos de forma independiente, sin esconder un Web bajo',()=>{
 const root=mkdtempSync(join(tmpdir(),'atlas-layers-'))
 try{
  mkdirSync(join(root,'scripts'));for(const f of ['coverage-merge.mjs','coverage-target.mjs'])copyFileSync(new URL(f,import.meta.url),join(root,'scripts',f))
  for(const kind of ['backend','frontend'])mkdirSync(join(root,'coverage',kind),{recursive:true})
  const write=(kind,data)=>writeFileSync(join(root,'coverage',kind,'coverage-summary.json'),JSON.stringify(data))
  write('backend',{'C:\\test\\atlas\\apps\\api\\src\\a.ts':row(900,900),'C:\\test\\atlas\\packages\\contracts\\src\\b.ts':row(50,50),'C:\\test\\atlas\\packages\\fixtures\\src\\c.ts':row(50,50)})
  write('frontend',{'src/editor.tsx':row(100,50)})
  const result=spawnSync(process.execPath,[join(root,'scripts','coverage-merge.mjs')],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
  const layers=JSON.parse(readFileSync(join(root,'coverage','coverage-layers.json'),'utf8'))
  assert.equal(layers.API.lines.pct,100);assert.equal(layers.Web.lines.pct,50);assert.equal(layers.Contratos.branches.pct,100)
  const total=JSON.parse(readFileSync(join(root,'coverage','coverage-summary.json'),'utf8')).total
  assert.equal(total.lines.covered,1050);assert.equal(total.lines.total,1100)
  assert.match(readFileSync(join(root,'coverage','index.html'),'utf8'),/Web<\/th><td class="bad">50.00%/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
