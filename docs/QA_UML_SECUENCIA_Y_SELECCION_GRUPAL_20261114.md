# NOVZI V4.8.1 — UML secuencia y selección múltiple

## Instalación

Aplica el ZIP de parche sobre la raíz de tu copia de NOVZI, conservando el contenido de tus `.env` y tu base de datos. No son necesarias migraciones ni instalar dependencias nuevas.

## Secuencia (UML)

- Nuevo catálogo visible con un solo **Participante** (tipo persistido `uml-lifeline`). Los diagramas antiguos que usan `actor` como participante se siguen leyendo.
- **Fragmento combinado** (tipo persistido `uml-frame`): `alt`, `opt`, `loop`, `par`; guardas por línea y separación gráfica entre operandos.
- **Referencia de interacción** (`uml-interaction`) sigue independiente; «marco de interacción» deja de aparecer en el selector de secuencia.
- **Ejecución / activación**: se ancla al eje vertical de un participante, mantiene su altura editable y se desplaza con él.
- **Destrucción**: se acopla al extremo inferior del participante o de la activación seleccionada; el trazado de la línea de vida se corta en ese punto.
- El modelo persiste `parentNodeId` y posiciones relativas en la vista, sin alterar otras apariciones del elemento.

## Selección por área

1. Pulsa **Seleccionar área** sobre el lienzo.
2. Dibuja un rectángulo con el cursor para seleccionar varias cajas (y relaciones).
3. Arrastra una caja seleccionada para desplazar el grupo o pulsa **Eliminar** (también Supr/Backspace cuando no editas un campo).
4. NOVZI utiliza su propia confirmación; no hay diálogos nativos.
5. La eliminación afecta a la vista, no borra las fichas compartidas del proyecto. Si el contenedor se borra sin su hijo, ese hijo se desacopla conservando sus coordenadas absolutas.
6. Mientras el modo de selección está activo, el desplazamiento del lienzo con botón central o derecho sigue habilitado. Para volver al arrastre normal, desactiva el modo.

## Validación de esta entrega

- `npm run typecheck -w @novzi/web`: aprobado.
- `npm run test:graph`: 76/76 aprobadas (contención y encastre, fragmentos, movimiento y borrado grupal, compatibilidad de actividades).
- `npm run test:qa-tools`: 4/4 aprobadas.
- Pruebas de interfaz de Vitest: no ejecutables en este entorno por ausencia de `@rollup/rollup-linux-x64-gnu`.
- Cobertura global ≥90 %: no certificada.

## Restricción conocida

NOVZI aún no implementa un editor temporal UML de nivel formal completo (por ejemplo, ordenación automática, validación de ocurrencias de mensajes y fragmentos anidados). Este cambio resuelve lo solicitado y conserva datos históricos; no equivale a conformidad completa OMG UML 2.5.1.
