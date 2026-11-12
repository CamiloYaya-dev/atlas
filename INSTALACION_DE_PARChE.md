# Aplicación de ATLAS V4.3 sobre V4.2.2

Para evitar perder archivos `.env`, el volumen Docker y el administrador existente:

1. Detén ATLAS con `Ctrl+C` en la consola del frontend/backend. No borres el volumen `atlas_dev_data`.
2. Haz una copia de seguridad o usa Git para registrar el estado actual.
3. Descomprime **ATLAS_V4_3_Parche_QA.zip** en la carpeta raíz del proyecto, reemplazando archivos coincidentes.
4. En PowerShell ejecuta:

```powershell
npm install
npm run typecheck
npm run test:unit
npm run test:db
npx playwright install chromium
npm run test:e2e:local
```

`test:e2e:local` requiere puertos 3001 y 5173 libres, usa una base temporal de QA en 5433 y cuentas temporales. No ejecuta pruebas destructivas sobre tu base de desarrollo 5432.

Para iniciar la app normal después:

```powershell
npm run dev:all
```

El parche incluye comandos puros de edición para que las pruebas unitarias ejerciten el editor real, endurecimiento de relaciones duplicadas, filtros de vista sin referencias compartidas, suite HTTP de QA, Playwright, y CI.

V4.3 no declara cobertura al 100% ni despliegue público listo para producción. Mira `QA_COBERTURA.md`.
