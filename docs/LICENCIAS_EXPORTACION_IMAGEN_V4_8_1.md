# ATLAS V4.8.1 — Licenciamiento base y exportación de imágenes

## Entrega

- El botón **Exportar** ofrece JSON del proyecto completo o **PNG/JPG del diagrama actual**. PNG/JPG utiliza el último documento persistido, no el viewport recortado en pantalla; incluye cajas, relaciones, etiquetas y cabecera del diagrama.
- **Sin licencia comercial activa**: PNG/JPG con marca visible repetida `ATLAS · USO NO COMERCIAL`.
- **Licencia activa de pago**: PNG/JPG sin marca visible.
- **Ambos casos**: la API aplica la política, inserta metadatos de procedencia HMAC-SHA256 en el PNG/JPG y guarda auditoría inmutable; no confía en indicadores de licencia del navegador. JSON mantiene su flujo anterior.
- La firma se calcula sobre el **hash de la imagen exacta**, su organización, usuario, diagrama, versión y licencia de exportación. Se verifica retirando el bloque de metadatos ATLAS, calculando nuevamente el hash y contrastando la firma con el registro del servidor.
- El backend genera el gráfico desde la versión guardada y filtrada por las ACL del proyecto. No admite que el cliente envíe su propio bitmap limpio para obtener firma comercial.

## Instalación (Windows, dentro de la carpeta del proyecto)

1. Respaldar proyecto y BD; extraer el **parche** sobre la raíz de ATLAS conservando `.env`, `node_modules` y volúmenes Docker.
2. `npm install` (nueva dependencia oficial **sharp** para PNG/JPG; el `package-lock.json` viene actualizado, incluidos binarios opcionales para Windows).
3. `npm run db:migrate` (aplica **006_licensing_export_provenance.sql**; no altera las migraciones anteriores ni el JSON de diagramas).
4. En `apps/api/.env`, configurar `ATLAS_EXPORT_SIGNING_KEY` con **32 caracteres aleatorios o más**. En entorno `production` es obligatoria; en desarrollo, si se omite, se deriva temporalmente de `ATLAS_CSRF_SECRET`.
5. Reiniciar API/web. `npm run typecheck`, `npm run test:export`, `npm run test:ui`, `npm run build`.

**No cambiar secretos de firma sin plan de rotación**: la validación de exportaciones antiguas usa el mismo secreto. Guardar la clave y las copias de seguridad de la base de datos en un almacén seguro.

## Catálogo de funcionalidades

Centralizado en `apps/api/src/modules/licensing/licensing.ts`:

| Feature code | Sin licencia | Pro/Enterprise activo |
|---|---|---|
| `diagram.export.png` | Sí | Sí |
| `diagram.export.jpg` | Sí | Sí |
| `diagram.export.clean` | No | Sí |

Cada funcionalidad futura se añade a `FEATURES`, se resuelve vía `getEntitlements` y se protege con `requireFeature(snapshot,feature)`. **Los permisos de seguridad de usuario son una capa distinta** (`artifact.export`, `project.read`). Tener una licencia no amplía el acceso a proyectos ajenos.

## API

Todas las rutas privadas exigen sesión. POST/PUT exigen CSRF `X-CSRF-Token`, igual que el resto de ATLAS.

| Método | Endpoint | Función / autorización |
|---|---|---|
| GET | `/api/v1/workspaces/:workspaceId/license` | Entitlements efectivos; miembro del workspace |
| PUT | `/api/v1/admin/workspaces/:workspaceId/license` | Emite/revoca licencia; **solo platformAdmin** |
| POST | `/api/v1/projects/:projectId/diagrams/:diagramId/export-image` | Descarga imagen; permiso `artifact.export` + feature en servidor |
| GET | `/api/v1/projects/:projectId/export-history` | Últimas 100 exportaciones; permiso de proyecto `artifact.export` |
| POST | `/api/v1/exports/verify` | Comprueba firma, hash y registro; exige acceso a la organización |

**Cuerpo de emisión (admin)**:

```json
{"planCode":"pro","status":"active","startsAt":"2026-11-12T00:00:00Z","expiresAt":"2027-11-12T00:00:00Z","features":{}}
```

Revocar sin borrar la evidencia: `{"planCode":"pro","status":"revoked","features":{}}`.

**Exportación**: `{"format":"png","expectedVersion":12}` (o `jpg`). La versión debe coincidir con la guardada; HTTP 409 si no. El contenido de respuesta es binario `image/png` o `image/jpeg`, con cabecera `X-ATLAS-Export-Id`.

**Verificación**: `{"imageBase64":"..."}` (máximo 4 MB). Responde `verified:true/false`, motivo y `exportId` cuando exista. El registro de servidor está disponible aunque un editor elimine los metadatos de una copia, pero **la verificación automatizada no puede atribuir de manera concluyente una imagen sin firma**.

## Persistencia

Nueva migración 006: tablas `workspace_licenses` y `export_audit_logs` (este último, solo INSERT), índice por organización/proyecto. También registra `diagram.exported` y `license.changed` en `audit_events`. Se conservan registros históricos aunque se retire la licencia o se elimine el diagrama. Definir más adelante política de retención/privacidad antes del lanzamiento público.

## Alcance de seguridad y límites explícitos

- Marca visible y firma criptográfica disuaden y aportan trazabilidad, **no impiden** que alguien haga capturas o quite los metadatos. Si una imagen firmada se modifica, el hash ya no coincide; si los metadatos desaparecen, no es posible verificarla solo a partir de los píxeles con este MVP.
- No incluye esteganografía robusta contra recortes/recompresión ni detección automática de uso comercial externo. Estas son fases posteriores si se necesitan.
- No incluye pagos, suscripciones, activación por usuario, facturación ni panel de venta. Nadie puede activarse PRO desde el navegador; los administradores de plataforma emiten licencias.
- La exportación reconstituye el diagrama guardado como SVG renderizado por servidor. Respeta posiciones, cajas, relaciones, etiquetas, estilos básicos y enlaces (indicados visualmente); no es una captura píxel por píxel de React Flow.
- Límites por exportación: 260 cajas, 700 relaciones, máximo 20 millones de píxeles, con rate limiting global de API. Metadatos contienen IDs técnicos, no contraseñas ni tokens.

## Criterios QA

- Free: ambos formatos descargables, marca repetida, firma y auditoría. Pro vigente: ambos formatos sin marca, con firma y auditoría.
- Licencia ausente, expirada, revocada o futura: nunca habilita exportación limpia.
- Sin `artifact.export`: HTTP 403. Proyecto/diagrama ajeno: no visible. CSRF inválido: HTTP 403. Versiones desactualizadas: HTTP 409.
- Firma original verificada, archivo alterado falla, archivo sin firma no pasa como genuino.
- El JSON, importación, versiones, ramas, Academy, permisos, relaciones múltiples y diagramas existentes no se alteran.
