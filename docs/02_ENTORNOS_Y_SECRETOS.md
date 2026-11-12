# Matriz de variables y secretos — ATLAS V4.2

## Backend `apps/api/.env` (LOCAL solamente)

La plantilla de desarrollo incluye `AUTH_MODE=local`, puerto 3001, `DATABASE_URL` de Docker local y un `ATLAS_CSRF_SECRET` **de desarrollo**, jamás publicarlo.

## Backend PROD (secretos en el proveedor, no en repositorio)

- `NODE_ENV=production`
- `AUTH_MODE=local`
- `DATABASE_URL`: credenciales limitadas para la base de datos PROD administrada, con host privado cuando sea posible.
- `DB_SSL=true`: certificado válido y verificación TLS.
- `ATLAS_CSRF_SECRET`: secreto aleatorio de al menos 32 caracteres, propio de PROD; rotarlo invalida CSRF de sesiones existentes.
- `CORS_ORIGINS=https://app.tudominio.com`: solo los orígenes autorizados, separados por comas.
- `TRUST_PROXY=true` cuando hay proxy de confianza delante del servicio.
- `PORT`, `HOST`, `DB_POOL_MAX` según servicio.

## Frontend PROD

- `VITE_API_BASE_URL=https://api.tudominio.com`. No hay claves privadas en Vite.

**Nunca** publicar contraseña admin, URL DB o secreto CSRF en un repositorio, bundle frontend, screenshot o documentación pública. En Windows el script `npm run admin:setup` solicita la clave en modo seguro sin persistirla en texto.
