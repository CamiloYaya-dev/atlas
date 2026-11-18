const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('node:module')
require.extensions['.ts']=function(mod,file){mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file)}
const {assessAcademy}=require('../apps/web/src/features/academy/progress.ts')
const source=fs.readFileSync('apps/web/src/features/academy/progress.browser.test.ts','utf8')
const code=source.slice(source.indexOf('function fixture():'),source.indexOf("describe('Academia"))+'\nmodule.exports=fixture;'
const fixtureModule=new Module('fixture.js',module)
fixtureModule._compile(ts.transpileModule(code,{fileName:'fixture.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,'fixture.js')
const fixture=fixtureModule.exports
const doc=fixture()
assert.equal(assessAcademy(doc,true,'mixed','trace').integrationBadge,true);console.log('PASS complete training fixture with inspector and fields unlocks badges')
doc.elements.hu.summary=''
assert.equal(assessAcademy(doc,true,'mixed','trace').functionalBadge,false);console.log('PASS missing HU inspector field blocks functional badge')
doc.elements.hu.summary='Solicitud validada'
doc.elements.hu.fields['training-channel']=''
assert.equal(assessAcademy(doc,true,'mixed','trace').functionalBadge,false);console.log('PASS empty custom functional field blocks functional badge')
doc.elements.hu.fields['training-channel']='Web'
doc.elements.endpoint.fields['training-protocol']='FTP'
assert.equal(assessAcademy(doc,true,'mixed','trace').technicalBadge,false);console.log('PASS wrong technical protocol blocks technical badge')
doc.elements.endpoint.fields['training-protocol']='HTTPS'
assert.equal(assessAcademy(doc,true,'mixed','trace').technicalBadge,true);console.log('PASS restored saved values unlock badges')
assert.equal(assessAcademy(doc,false,'mixed','trace').integrationBadge,false);console.log('PASS unsaved model is never accredited')
