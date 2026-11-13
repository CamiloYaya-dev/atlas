# ATLAS · Hotfix de prueba ZIP y cobertura parcial (13/11/2026)

## Qué se corrigió

- `advanced-document.unit.test.ts` deja de asumir que todo HTML comprimido siempre ocupa menos bytes. En ZIP/DEFLATE, archivos muy pequeños pueden crecer. La prueba ahora abre las entradas locales del ZIP, descomprime el HTML, compara contenido, tamaños y métodos, y verifica directorio central y cabecera final.
- `coverage-suite.mjs` avisa explícitamente cuando una fase de cobertura se interrumpe antes de ejecutar integración o pruebas operacionales. Las cifras de c8 de una ejecución incompleta no son cobertura global.

## ¿Se eliminaron pruebas?

No. Comparación de los paquetes anteriores entregados: 46 archivos de pruebas antes y 48 después de la exportación avanzada, con dos archivos nuevos. Ningún archivo de pruebas desapareció.

## Verificaciones hechas en el entorno de análisis

- Pruebas específicas de exportación y licencias: 17/17, utilizando un cargador TypeScript alternativo debido a dependencias nativas de otro sistema operativo.
- TypeScript (`apps/api` y `apps/web`): aprobado.
- El ZIP producido por `zipFiles()` se abrió con la librería estándar de Python: 2 entradas íntegras y método ZIP correcto (imagen almacenada, HTML deflate).

## Comprobar en Windows

Desde la raíz de ATLAS y tras respaldar el código:

```powershell
npm run typecheck
npm run test:export
npm run test:unit
npm run test:ui
npm run test:coverage
npm run coverage:check:90
```

`npm run test:coverage` usa PostgreSQL QA separado en el puerto 5433 y necesita Docker operativo. No depende de la base de producción. No se certifica cobertura >=90% hasta que la suite completa finalice y el reporte consolidado cumpla el umbral para las cuatro métricas y todas las capas.

No cambia esquemas, credenciales, tablas ni reglas de licencia. No se disminuye el umbral ni se excluyen archivos.
