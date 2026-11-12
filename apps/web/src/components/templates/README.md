# Atomic Design en ATLAS
- `atoms/`: elementos indivisibles (botones, iconos, etiquetas).
- `molecules/`: campos de formulario y modales (`Overlay`, `Field`).
- `organisms/`: diagramas interactivos (`AtlasNode`, futuro `DiagramCanvas`).
- `templates/`: composiciones de layout reutilizables.
- `pages/`: vistas vinculadas a rutas (fase siguiente).

La vista `App.tsx` original se mantiene funcional en esta migración y se está separando incrementalmente, no se afirma que ya haya finalizado la migración a Atomic Design.
