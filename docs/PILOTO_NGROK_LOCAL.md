# Piloto cerrado mediante ngrok — seguridad operativa

Esta guía describe un **piloto temporal**, no un despliegue de producción.

1. Arrancar PostgreSQL local (Docker) y API y frontend desde el proyecto. PostgreSQL publica solo en `127.0.0.1:5432`, el puerto de prueba `5433` también solo en loopback. No abrir esos puertos en el firewall/router.
2. Exponer **solo la vista previa del frontend compilado** (puerto **4173**) mediante `npm run pilot:start`, que hace proxy `/api` a `127.0.0.1:3001`; no crear túnel público directo al puerto 3001 ni exponer el servidor de desarrollo de Vite 5173.
3. Usar una URL HTTPS temporal y proteger el túnel con control de acceso de ngrok si el plan lo permite. El login de ATLAS sigue siendo obligatorio y no sustituye la protección del túnel.
4. En Vite, configurar `preview.allowedHosts` con el host exacto asignado por ngrok (no usar `allowedHosts:true` ni comodines). El servicio preview no es un servidor de producción; úsalo exclusivamente para un piloto temporal.
5. Agregar el origen HTTPS exacto del túnel a `CORS_ORIGINS` en `apps/api/.env` y reiniciar la API. Validar que la petición llega por proxy y no se bloquea por `Origin`.
6. Con las variables anteriores definidas, ejecutar `npm run pilot:check`; después `npm run pilot:start`, y en otra terminal `ngrok http 4173`. Para el piloto, la cookie debe tener atributo `Secure` en HTTPS. Configurar `ATLAS_SECURE_COOKIES=true` y usar el origen HTTPS. Revisar en DevTools → Application → Cookies y repetir el E2E de login a través del dominio externo.
7. **No** abrir aún el acceso al público ni usar datos sensibles/productivos. Tener copias de respaldo, contraseñas distintas por usuario, revisar logs y revocar sesiones cuando finalice el piloto.
8. No exponer el puerto **5173** de desarrollo con HMR ni las fuentes TSX del proyecto; el piloto utiliza la compilación estática `dist` y el proxy del puerto 4173. Apagar el túnel al terminar cada sesión. Detener ngrok no detiene PostgreSQL ni revoca sesiones por sí solo.

**No automatizamos la creación del túnel ni presentamos esta guía como validada:** requerirá la URL efectiva de ngrok, configuración local y prueba de acceso desde otra red.
