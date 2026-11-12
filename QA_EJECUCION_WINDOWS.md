# ATLAS V4.3 — Ejecución de pruebas en Windows / PowerShell

## Requisitos

- Node.js 22+, npm, Docker Desktop en ejecución.
- Para E2E: Chromium de Playwright (`npx playwright install chromium`, una sola vez).
- Descomprimir este repositorio en una carpeta nueva y abrir PowerShell **en la raíz que contiene package.json**.
- **No ejecutar pruebas contra producción.**

## Primera preparación

```powershell
npm install
npm run typecheck
npm run test:unit
```

`npm run test:unit` no necesita Docker, ni PostgreSQL y no modifica datos.

## Pruebas de base de datos y API sin tocar tus diagramas

```powershell
# Docker Desktop debe estar iniciado
npm run test:db
```

Esto levanta un segundo contenedor `db_test` en el puerto **5433** con base `atlas_test` (no `atlas` de desarrollo en 5432), migra y ejecuta pruebas HTTP e integración. `ATLAS_ALLOW_DB_TESTS` está controlado por el comando y solo autoriza 127.0.0.1:5433/atlas_test.

## Pruebas visuales con navegador

```powershell
npx playwright install chromium
npm run test:e2e:local
```

Este comando prepara una base QA, crea cuentas temporales solo allí, inicia API y frontend en sus puertos 3001/5173, ejecuta Playwright y cierra los servidores lanzados por el runner. **Detén ATLAS dev** antes, para que esos puertos estén libres.

## Todo el control de calidad

```powershell
npm run test:all   # TypeScript + unitarias + API/BD + build
npm run test:full  # Lo anterior + recorridos E2E en Chromium
```

Para pruebas aisladas del editor:

```powershell
npm run test:unit
```

## Depuración

- Salida con stack: consola de `npm run test:unit`, `npm run test:db` o `npm run test:e2e:local`.
- Playwright genera artefactos de fallos en `test-results/artifacts` y reporte HTML en `test-results/html`.
- Consulta adicional: `npm run test:coverage` para cobertura del núcleo unitario (no confundir con cobertura E2E).
- No existe un “verde” válido si se omiten pruebas que requieren credenciales o conexión; los comandos deben fallar con explicación.

## Riesgos conocidos

- La suite UI E2E necesita validación inicial en Windows/Chromium; sus selectores pueden requerir ajustes si cambia la interfaz.
- Las pruebas HTTP y de PostgreSQL no se pudieron ejecutar en el entorno de preparación sin npm/Docker; ejecutarlas antes de aprobar V4.3.
- No hay declaración de cobertura del 100%; registrar los porcentajes reales y ampliar casos críticos.
