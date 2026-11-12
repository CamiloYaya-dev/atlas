# Pruebas de ATLAS V4

1. Ejecuta `npm run dev:all` con Docker Desktop abierto.
2. `http://localhost:3001/api/v1/health` debe responder JSON `status: ok`.
3. `http://localhost:5173` debe mostrar el editor Zercano con diagramas C1-C4.
4. Edita el nombre de una caja y espera el estado Guardado.
5. Pulsa F5: comprueba que la modificación sigue allí (persistencia PostgreSQL).
6. Crea un workspace y un proyecto, agrega una caja y edítala.
7. Crea un campo personalizado para requerimientos.
8. Exporta un proyecto JSON, crea otro e impórtalo.
9. Detén con Ctrl+C y vuelve a abrir: datos intactos.
10. `npm run typecheck` y `npm run test` deben completar sin errores.

No publiques el modo DEMO. Una respuesta de health no demuestra que la autorización multiusuario esté probada.
