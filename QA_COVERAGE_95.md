# ATLAS V4.3.1 — Cobertura real y puerta de calidad del 95 %

## Estado de referencia (logs del usuario)

- Unitarias: **84 aprobadas / 84 ejecutadas** antes del parche. Se añaden 2 regresiones de autorización.
- Integración: **10 aprobadas y 4 fallidas, en 14 pruebas** (13 pruebas API: 10 aprobadas, 3 fallidas; 1 prueba de servicios: fallida). Dos errores de API son consecutivos al primero.
- E2E: **no se ejecutaron los recorridos**; Windows no podía iniciar `node.exe` desde una ruta con espacios.
- **Coverage: no se puede afirmar un porcentaje** a partir de los conteos de pruebas.

## Arreglos V4.3.1

1. **403 al guardar C1 + C2**: el propietario no recibía `fieldDefinitions` para tipos sin elementos visibles. La proyección ahora respeta `field.configure`, pero sigue filtrando metadatos no autorizados para lectores. Se agregaron pruebas de regresión.
2. **Miembro de integración**: el test viejo insertaba únicamente `role='viewer'`. Con el sistema de roles granulares es obligatorio `role_id`; ahora usa el rol real del espacio de prueba.
3. **Playwright en Windows**: `node.exe` se ejecuta con `shell: false`, evitando el error `"C:\\Program" no se reconoce...`.
4. **Coverage**: se introduce `c8` sobre V8. Los archivos que no se ejecutan cuentan como 0 % mediante `all: true`, y solo se excluyen los tests y declaraciones de tipos. Reportes HTML, LCOV y resumen JSON.

## Ejecución desde PowerShell (raíz del repositorio)

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

Para una primera medición sin Docker:

```powershell
npm run test:coverage:unit
```

Para medición agregada de pruebas unitarias + integración, necesitas Docker Desktop funcionando:

```powershell
npm run test:coverage
```

Los resultados aparecen en:
- `coverage/index.html` (detalles por archivo y línea)
- `coverage/lcov.info` (importable a SonarQube)
- `coverage/coverage-summary.json` (porcentajes globales y por archivo)
- `npm run coverage:summary` imprime las cuatro métricas para API, Web, paquetes y total

La puerta **`npm run coverage:check` exige al menos 95 % de líneas, sentencias, funciones y ramas por archivo y globalmente**. Fallará hasta que la suite logre esas cifras; NO se disminuye automáticamente el umbral. En CI se ejecuta esta misma puerta y se adjunta el informe.

## Nota sobre el navegador y la calidad real

`c8` mide código instrumentado por Node en tests unitarios/API, **no mide automáticamente toda la lógica React ejecutada solamente en Chromium**. Por eso, el reporte incluye los archivos React no cubiertos como pendientes y el 95 % no puede certificarse únicamente con este recolector. Es necesario añadir pruebas de componentes (Vitest + Testing Library) con métricas propias y ejecutar Playwright E2E para recorridos reales. Ninguna herramienta de coverage prueba por sí sola la seguridad, los contratos o el comportamiento esperado.

## Condición de aceptación acordada

- 95 % mínimo en cada métrica relevante y módulo, sin excluir producción artificialmente.
- Al menos una prueba de autorización positiva y negativa por comportamiento sensible.
- Suites unitarias, de integración y E2E aprobadas.
- Builds y `typecheck` en verde, con evidencia de CI.
- Antes de producción, completar tests de UI/componente y análisis de mutaciones de la lógica crítica.

No declarar ATLAS certificado hasta cumplir los anteriores puntos.
