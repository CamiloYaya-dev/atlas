# ATLAS V4.8.1 — Ensamblaje UML y tamaño de cajas

## Cambios

- Los símbolos de interfaz proporcionada/requerida se dibujan en el punto medio **de longitud de la ruta SVG real**, con orientación tangente a la misma, no a la línea recta que une dos nodos. Para rutas rectas, ortogonales, curvas y conexiones laterales/superiores/inferiores se calcula la tangente del trazado. Se enmascara únicamente el tramo que queda bajo el símbolo, preservando la ruta y sus puntos de conexión.
- En UML de estructura compuesta `delegation` desaparece de la lista de **nuevas** conexiones. Los diagramas anteriores siguen aceptando y dibujando sus delegaciones históricas, para no perder información.
- Todos los nodos en React Flow tienen un tamaño visual controlado. Selecciona uno para arrastrar las esquinas de su borde o indica medidas exactas en píxeles desde el Inspector.
- `DiagramNode.width` / `DiagramNode.height` son **opcionales** y por aparición. La ficha del elemento reutilizada en otro diagrama no cambia de tamaño.
- La API comprueba que ancho/alto sean enteros finitos entre 48 y 4000 px. Las operaciones locales imponen además el mínimo semántico del tipo. Para contenedores, no se permiten cambios que corten hijos; puertos de estructura compuesta se recolocan en el borde de origen después de un resize.
- Se respetan `diagram.layout.<tipo>` y el control de cambios/guardado existente.

## Compatibilidad y limitaciones

- No se modifica el esquema `schema: 1` ni se requieren migraciones SQL.
- El selector de delegación no se ofrece para nuevas relaciones. Las ya almacenadas siguen siendo legibles y editables por su clave histórica.
- La conformidad completa con las semánticas de todos los diagramas OMG UML 2.5.1 no se declara en este parche.
- Prueba API completa, UI y cobertura general son tareas de validación obligatorias en el Windows con dependencias nativas instaladas.

## Verificación

```
npm run typecheck
npm run test:graph
npm run test:ui
npm run test:coverage
npm run coverage:check:90
```

Pruebas enfocadas: ruta SVG horizontal, vertical, curva y ortogonal; límites de resize y persistencia por vista; reajuste de puerto al borde; contención de hijos; retrocompatibilidad de delegación.
