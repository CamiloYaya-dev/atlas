# ATLAS V4.3 — QA automatizada por comportamiento

ATLAS es un monorepo React + TypeScript + Fastify + PostgreSQL. Esta actualización conserva el login cerrado, el editor y los permisos de V4.2.2, e integra pruebas por capas y una base QA aislada.

## Inicio rápido Windows

```powershell
npm install
npm run dev:all
```

Abrir `http://127.0.0.1:5173`. Requiere Docker Desktop. La base de desarrollo local se ejecuta en 5432.

## Calidad (scripts npm; sin .bat)

```powershell
npm run test:unit     # Sin Docker ni base de datos
npm run test:db       # API + PostgreSQL QA (5433, independiente)
npx playwright install chromium   # Una sola vez
npm run test:e2e:local # Navegador real con DB QA y cuentas temporales
npm run test:full     # Tipo, unitarias, integración, build y E2E
```

Ver `QA_EJECUCION_WINDOWS.md` y `QA_COBERTURA.md` antes de declarar una versión apta para release.

**Evidencia disponible:** 84 pruebas unitarias ejecutadas exitosamente sobre los módulos de negocio en el entorno de preparación. Integración HTTP/DB, Chromium y compilación integral no han sido certificados aquí; requieren ejecución con npm/Docker y revisión de logs.

## Arquitectura

- `apps/web`: frontend React, editor y operaciones de modelo reutilizables.
- `apps/api`: API Fastify, autorización, servicios y repositorios PostgreSQL.
- `packages/contracts`: entidades, tipos y catálogo de capacidades.
- `packages/fixtures`: datos ficticios.
- `apps/api/src/app.ts`: composición Fastify testeable sin escuchar puertos.
- `tests/e2e`: flujos visuales de navegador.
- `.github/workflows/ci.yml`: unitarias, integración, build y E2E.

## Restricción de seguridad

No se ejecutan pruebas destructivas en la BD de desarrollo ni en producción. `test:db` y `test:e2e:local` usan exclusivamente `127.0.0.1:5433/atlas_test` y verifican `NODE_ENV=test`. Las cuentas E2E son temporales.

---

## Documentación histórica V4.2

# ATLAS V4.2.1 — Desarrollo con npm (sin archivos BAT)

Frontend React/Vite, API Fastify, PostgreSQL 16 en Docker local, acceso cerrado, control de roles y permisos granulares.

## Requisitos

- Node.js 22+ y npm.
- Docker Desktop encendido.
- Puertos `5173`, `3001`, `5432` disponibles (y `5433` para pruebas integrales).
- Trabajar desde una terminal PowerShell, Windows Terminal o VS Code abierta **en la raíz del monorepo**.

## Primera ejecución (Windows)

```powershell
npm install
npm run dev:all
```

`dev:all` crea los `.env` que falten, inicia PostgreSQL, ejecuta migraciones y seeds, solicita el administrador inicial si no existe, ejecuta `typecheck` y arranca WEB + API. La contraseña del administrador se ingresa en la terminal con caracteres ocultos. No hay usuario predeterminado ni registro público.

- App: http://localhost:5173
- API: http://localhost:3001/api/v1
- Salud: http://localhost:3001/api/v1/health
- Preparación: http://localhost:3001/api/v1/ready

## Uso cotidiano y depuración

```powershell
npm run dev:all       # Todo en un comando; incluye preparación y typecheck
npm run dev           # Solo frontend + backend (BD ya inicializada)
npm run dev:web       # Solo web; error visible en terminal del frontend
npm run dev:api       # Solo API; error visible en terminal del backend
npm run db:up         # Levanta solo PostgreSQL
npm run db:status     # Estado de BD
npm run db:logs       # Logs de PostgreSQL
npm run db:stop       # Detiene BD SIN borrar datos
npm run db:migrate    # Migraciones (no ejecuta seeds)
npm run db:seed       # Datos de prueba, sin eliminar los existentes
npm run admin:status  # Verifica si hay administrador
npm run admin:setup   # Solo crea el primer administrador
npm run typecheck     # Errores TypeScript
npm run test:policy   # Pruebas de política de permisos
npm run test          # Pruebas del backend
npm run check         # Tipos + políticas + pruebas + build
npm run db:test       # Base QA local aislada (5433) + tests de integración
npm run smoke         # Comprueba health/ready/frontend con servicios arriba
npm run db:backup     # Copia local PostgreSQL (backups/)
```

### Flujo recomendado para diagnosticar un error

1. Si el error es de compilación, ejecuta `npm run typecheck`.
2. Si es un HTTP 500, ejecuta `npm run dev:api` y revisa la traza.
3. Si es del lienzo / React, ejecuta `npm run dev:web`, abre F12 y revisa consola y Network.
4. Si la API no conecta a la BD, ejecuta `npm run db:status`, `npm run db:logs`, `npm run smoke`.
5. Si sospechas una ruptura de permisos, ejecuta `npm run test:policy` y `npm run db:test`.

En Windows, usa `Ctrl+C` para detener Vite y Fastify. PostgreSQL permanece en Docker hasta ejecutar `npm run db:stop`. **No ejecutes `docker compose down -v`**: destruiría el volumen de datos.

## Orden y capas

- `apps/web`: interfaz y editor con React Flow.
- `apps/api`: controladores/rutas, aplicación/casos de uso, dominio y persistencia con `pg`.
- `packages/contracts`: contratos TS entre frontend y backend.
- `packages/fixtures`: datos ficticios.
- `apps/api/migrations`: migraciones SQL numeradas.
- `scripts/`: solo utilidades Node, invocadas desde `package.json`.

## Ambientes y producción

Docker PostgreSQL es **solo para desarrollo**. Mantener Web/API/BD separados por ambiente y sin compartir instancias entre DEV y PROD. No exponer PostgreSQL públicamente. Para el despliegue usa las guías existentes en `docs/`, con secretos configurados fuera de Git.

## Seguridad y limitaciones

El modo `AUTH_MODE=local` permite crear el admin inicial por CLI y luego iniciar sesión. No ejecutar bootstrap en producción sin un proceso formal de aprovisionamiento. `db:seed` es solo para desarrollo. Las capacidades, permisos y autenticación mantienen la implementación de ATLAS V4.2; esta actualización cambia exclusivamente la experiencia de ejecución y mantenimiento.

No se ha ejecutado aquí un arranque completo con Docker y las dependencias npm. Los comandos están verificados a nivel de JSON y sintaxis JavaScript; los flujos de BD/API se deben validar en Windows.


## Cobertura y QA (V4.3.1)

La meta obligatoria es **>=95 % de líneas, sentencias, funciones y ramas por archivo**, además de pruebas de integración y E2E correctas. **Este objetivo aún no está certificado.**

- `npm run test:coverage:unit`: informe agregado inicial (sin PostgreSQL).
- `npm run test:coverage`: cobertura agregada unitarias + integración con PostgreSQL QA (Docker 5433).
- `npm run coverage:summary`: muestra cobertura medida global y por API/WEB/paquetes.
- `npm run coverage:check`: falla si los porcentajes no llegan a 95 %.
- `npm run test:coverage:gate`: cobertura + comprobación de umbral, usada en CI.
- `npm run test:full`: typecheck + gate de cobertura + build + E2E.

Guía y diagnóstico: `QA_COVERAGE_95.md`. Los porcentajes no se infieren del número de pruebas aprobadas.
