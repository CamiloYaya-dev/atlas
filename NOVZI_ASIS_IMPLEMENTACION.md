# NOVZI | Diagnósticos AS-IS con línea base histórica

Implementación incremental sobre NOVZI 4.8.1. No requiere un proyecto separado para AS-IS, ni modifica las migraciones 001–015.

## Instalación en tu carpeta actual `novzi`

1. Cierra el servidor NOVZI y realiza un respaldo con `npm run db:backup`.
2. Descomprime **NOVZI_ASIS_parche.zip** sobre la raíz del monorepo NOVZI (la carpeta que tiene `package.json`). El parche **no contiene** `.git`, `.env`, respaldos ni dependencias.
3. Desde esa carpeta:

```powershell
npm run db:up
npm run db:migrations:status
npm run db:migrate
npm run typecheck
npm run dev
```

**Si el estado de alguna migración aplicada aparece `DISTINTO` o `MODIFICADA`, detente.** No borres la base, no cambies checksums y no uses `docker compose down -v`.

## Cómo probar el flujo

1. Abre un proyecto existente, por ejemplo **Zercano · Plataforma**.
2. Ve a **Gestión funcional > Diagnósticos AS-IS > +**. Crea un registro, completa **proceso**, **fecha**, **comportamiento actual**, **resultado** y guarda.
3. Opcional: selecciona una plantilla de formulario AS-IS y agrega campos personalizados. Adjunta evidencias, enlaces y/o relaciona hallazgos y HU.
4. En **Vínculos y trazabilidad**, vincula al menos un **diagrama** actual. Puedes vincular cajas o relaciones individuales de ese diagrama.
5. Si todavía no existe un diagrama, usa **Crear diagrama del proceso**: abre el editor normal de NOVZI con un diagrama de proceso; crea, guarda y regresa al diagnóstico para vincularlo.
6. Guarda todos los cambios del diagnóstico. Presiona **Cerrar diagnóstico y generar línea base** y confirma en el modal de NOVZI.
7. Comprueba que el diagnóstico queda en **solo lectura** y que puedes consultar el diagrama histórico y las evidencias preservadas.
8. Abre el diagrama de trabajo, modifícalo, guarda y regresa al AS-IS. Usa **Comparar con actual**: el histórico conserva su diseño y la comparación detecta el cambio.
9. Presiona **Crear nueva evaluación** para iniciar otro AS-IS del mismo proceso, sin alterar el primero.

## Modelo y seguridad

- Se agrega el tipo `asis` a la gestión funcional y la migración nueva `016_asis_baselines.sql`.
- Cada registro conserva su código `ASIS-001`, etc., aislado por proyecto.
- El cierre es transaccional: registra el formulario, campos personalizados, plantilla, vínculos, hallazgos vinculados, diagramas seleccionados, catálogo de elementos necesario, versión del documento del proyecto y copias binarias de las evidencias adjuntas.
- Los diagramas históricos **no son enlaces a la última versión**: la API devuelve el documento congelado independiente.
- Se validan permisos por proyecto y por tipo de diagrama antes de cerrar/consultar.
- Tras el cierre, los disparadores SQL evitan modificaciones y eliminaciones individuales del AS-IS, sus vínculos, sus evidencias y su línea base. La eliminación de todo el proyecto sigue permitida: exige conservar respaldos externos.
- Al exportar a PDF/Word/HTML un AS-IS cerrado, se usa su **formulario y plantilla originales**, no la plantilla editable actual.
- Las evidencias por URL se conservan como URL; no se descarga una copia de servidores externos. Los adjuntos subidos a NOVZI sí se copian.

## Alcance y limitaciones actuales

- Este es un flujo operativo AS-IS específico integrado a las capacidades existentes; **no** convierte todavía todos los tipos funcionales en tipos completamente configurables desde cero.
- El botón **Crear diagrama del proceso** abre el editor existente, pero **todavía hay que vincular el diagrama al diagnóstico manualmente al regresar**, después de guardar el diagrama.
- Un diagnóstico cerrado mantiene una única línea base; para un nuevo hito se crea **otro diagnóstico**, no se reemplaza la línea base anterior.
- La comparación ofrece previsualizaciones y detección de cambios, no un diff semántico caja por caja.
- Este paquete pasó verificación TypeScript API/web y pruebas unitarias focalizadas. No se ejecutaron migración real en PostgreSQL, E2E ni pruebas integrales en este entorno. Se recomienda validar sobre copia de DB antes de usar en producción.
- `npm run test:unit` y la QA global **no** son requisito de aceptación aquí; probar localmente esta funcionalidad en su propia fase.
