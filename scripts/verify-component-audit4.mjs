/** Run from any directory: node scripts/verify-component-audit4.mjs */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('qa/uml-component-evidence/auditoria-4/manifest.sha256.json', root), 'utf8'));
let errors=0;
for (const [path, expected] of Object.entries(manifest.files)) {
  try {
    const actual = createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
    if (actual !== expected) { console.error(`DISTINTO: ${path}`); errors++; }
  } catch { console.error(`FALTA: ${path}`); errors++; }
}
const policy=readFileSync(new URL('packages/contracts/src/uml-component-policy.ts',root),'utf8');
const functionStart = policy.indexOf('export function componentConnectorAssociationIssues');
const functionEnd = policy.indexOf('\n}', functionStart);
const typeCheck = functionStart >= 0 && functionEnd > functionStart ? policy.slice(functionStart,functionEnd) : '';
if (!typeCheck.includes('role=doc.elements[end.roleId],detail=role?.uml?.component') || /doc\.elements\[end\.partWithPortId\s*\|\|\s*end\.roleId\]/.test(typeCheck)) { console.error('AUD-CMP-010: implementación antigua o incompleta'); errors++; }
console.log(`Raíz: ${fileURLToPath(root)}\nEntrega: ${manifest.release}\nArchivos verificados: ${Object.keys(manifest.files).length}\nResultado: ${errors ? 'FALLÓ ('+errors+')' : 'OK — AUD-CMP-010 presente'}`);
process.exitCode=errors?1:0;
