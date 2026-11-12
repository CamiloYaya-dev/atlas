# ATLAS V4.2.2 — Corrección TS2554

## Aplicación

**Parche:** copia `apps/api/src/security/password.ts` en la misma ruta de tu proyecto. No hay cambios de base de datos ni migraciones.

**Verificación en PowerShell (raíz del monorepo):**

```powershell
npm run typecheck
npm run dev
```

Si necesitas comprobar todo el bootstrap, puedes ejecutar `npm run dev:all`, pero no es necesario repetir migraciones y seed para corregir este error.

## ¿Por qué ocurre?

`promisify(scrypt)` no siempre conserva la firma de 4 argumentos con opciones explícitas en TypeScript. La implementación hace un envoltorio `new Promise` del `scrypt` nativo de Node y mantiene N=32768, r=8, p=3, maxmem=64 MiB, con el mismo formato `scrypt$...`.

## Limitaciones

Esta corrección se ha probado con Node.js en el módulo de derivación de contraseñas. La comprobación integral `npm run typecheck` requiere las dependencias npm del proyecto instaladas.
