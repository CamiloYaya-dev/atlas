# Plan de despliegue — ATLAS V4.2

Este documento define el destino de despliegue, **no afirma que ya esté desplegado**.

| Recurso | Local | DEV remoto | PROD |
|---|---|---|---|
| Frontend | `localhost:5173` | `dev.tudominio.com` | `app.tudominio.com` |
| API | `localhost:3001` | `api-dev.tudominio.com` | `api.tudominio.com` |
| PostgreSQL | Docker local | Instancia PostgreSQL DEV | Instancia PostgreSQL PROD |
| Autenticación | Cuentas internas locales | Cuentas internas DEV | Cuentas internas PROD |
| Sesiones | DB local | DB DEV | DB PROD |

## Procedimiento de despliegue futuro

1. Reservar y configurar DNS/TLS para front/API en DEV, y producir después de validación.
2. Provisionar **dos PostgreSQL independientes**; desactivar acceso indiscriminado por internet. Aplicar mínimos privilegios y backups, verificando restauración.
3. Configurar secretos por entorno en el proveedor de API (`DATABASE_URL`, `ATLAS_CSRF_SECRET`, `CORS_ORIGINS`, `DB_SSL`). No copiarlos entre ambientes.
4. Ejecutar migraciones en DEV con una identidad de DB restringida antes de levantar la API; luego correr `admin:create` **por única vez** con credenciales nuevas. Sin seed ficticio en PROD.
5. Desplegar API Fastify, publicar `/ready` y validar inicio sesión con cookie `Secure` y cabeceras CSRF.
6. Desplegar React configurando `VITE_API_BASE_URL=https://api.tudominio.com` (en DEV la variante dev). Si un reverse proxy sirve ambos en un solo origen, adaptar la configuración.
7. Ejecutar la matriz de pruebas multiusuario de `docs/06_VALIDACION_SEGURIDAD.md`, pruebas de carga, alertas y verificación de permisos ante usuarios hostiles.
8. Tras aprobación, repetir en PROD con recursos y credenciales nuevas. No copiar datos de PROD a DEV sin anonimizar.

**Nota:** app/API en subdominios son mismo sitio a efectos de `SameSite`, pero tienen distinto origen. `credentials:'include'` y `CORS_ORIGINS` estricto son obligatorios. La base de datos no requiere dominio público. `DB_SSL=true` no equivale a aislamiento de red: desplegar API y DB en red privada cuando sea necesario.
