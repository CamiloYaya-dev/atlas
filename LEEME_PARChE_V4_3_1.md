# ATLAS V4.3.1 — Parche de permisos, integración, Windows y coverage

1. Cierra los procesos de ATLAS que estén ejecutando pruebas o frontend/backend.
2. Extrae **el contenido del parche** sobre la raíz existente del monorepo (donde vive `package.json`). Acepta reemplazar los archivos incluidos.
3. No borres `apps/api/.env`, `apps/web/.env`, `node_modules` ni volúmenes de PostgreSQL. El parche no contiene `.env`.
4. En PowerShell (raíz de ATLAS):

   ```powershell
   npm install
   npm run typecheck
   npm run test:unit
   npm run test:db
   npm run test:e2e:local
   npm run test:coverage
   npm run coverage:summary
   npm run coverage:check
   ```

5. Abre `coverage/index.html` en Chrome y revisa `coverage/lcov.info` para SonarQube.
6. La puerta del 95 % seguramente marcará **NO PASA** hasta ampliar la suite. Un porcentaje inferior es un resultado real, no un error del instalador.

Consulta `QA_COVERAGE_95.md` para los hallazgos y la diferencia entre pruebas aprobadas y cobertura.

**Correcciones específicas:** proyección de campos de propietario, `role_id` en pruebas de aislamiento y ruta con espacios al ejecutar Playwright en Windows. Los cambios de tests no tocan producción.
