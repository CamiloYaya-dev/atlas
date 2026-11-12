# ADR — ATLAS V4.2

## ADR-001: Monorepo, frontend/API/DB independientes

Mantener un solo repositorio para versionar contratos y facilitar cambios atómicos, pero despliegue físico separado. No partir microservicios sin evidencia operacional.

## ADR-002: Acceso cerrado ahora; SaaS futuro

Deshabilitar signup e invitaciones públicas de V4.1, crear cuenta admin por CLI y permitir alta de otros usuarios únicamente desde administración. No introducir un proveedor externo de autenticación como requisito para desarrollo local. Si se añade SSO empresarial, crear un adaptador de identidad y preservar el catálogo de permisos.

## ADR-003: Capacidades atómicas, no check de rol global

Las decisiones sobre C1-C4, cajas, relaciones, campos e importación/exportación se toman por permisos específicos guardados en DB. Los perfiles funcional/técnico son plantillas editables, no controles hardcodeados.

## ADR-004: Lectura por proyección, escritura por diff autorizado

Como los documentos completos aún son agregados JSONB, ocultar solo la UI no es suficiente. La API filtra los documentos de lectura y fusiona los cambios permitidos dentro de transacciones. Cambios de relaciones requieren permiso de relaciones, no solo de layout. Un proyecto no se exporta por la API sin `artifact.export`.

## ADR-005: Cookie opaca, hash de tokens y CSRF

No guardar token de sesión en localStorage. Mantener hash de token y revocación en PostgreSQL, enviar token via cookie HttpOnly y CSRF derivado por HMAC. Este diseño reduce exposición a robo por XSS pero no elimina los riesgos, y exige HTTPS/CORS estricto.

## ADR-006: Seguridad de contraseñas

Usar `scrypt` de Node con N=32768, r=8, p=3 y sal aleatoria; se recomienda Argon2id como objetivo en futuras revisiones. Rotación, MFA y recuperación segura quedan como pendientes antes de producción.
