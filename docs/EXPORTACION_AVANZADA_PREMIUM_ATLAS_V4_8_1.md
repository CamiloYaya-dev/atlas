# ATLAS — Exportación avanzada premium (V4.8.1)

## Qué cambió

- Conectores paralelos: la trayectoria de la flecha se aproxima perpendicularmente a los puertos verticales (arriba/abajo) y horizontalmente a los laterales.
- Barra superior: se retiran «Misiones» y «Renombrar» duplicados; permanecen disponibles en menú lateral y administración del proyecto.
- Exportación PNG/JPG normal sigue disponible, con marca de agua cuando no existe licencia comercial.
- Capacidad PRO `diagram.export.advanced`: imagen con fichas de inspector al pie de cada caja, documento de diccionario complementario, o ambos. Un selector por caja controla el destino de **cada campo**, incluido campo personalizado, relaciones, enlaces y vista/caja vinculada.
- El backend valida licencia, acceso al proyecto y nombres de campos, reconstruye el diccionario desde el documento autorizado guardado y entrega un ZIP en modos con diccionario.
- El diccionario se entrega en HTML autónomo, imprimible desde el navegador a PDF. La imagen continúa firmada y auditada por el backend; el HTML no cuenta con verificador criptográfico independiente.

## Comportamiento por plan

- Gratis: PNG/JPG simple con watermark, firma y auditoría. La exportación avanzada es rechazada con 403.
- PRO/Enterprise (licencia activa): PNG/JPG sin watermark, exportación avanzada, firma y auditoría.
- Una licencia revocada, caducada o todavía no vigente no concede capacidades.

## Compatibilidad

Los documentos de proyecto, esquemas SQL, historia de versiones y elementos existentes no se migran ni alteran. No se instala ningún paquete externo nuevo.

## Pruebas

- `npm run typecheck`
- `npm run test:graph`
- `npm run test:advanced-export`
- `npm run test:export`
- `npm run test:ui`
- `npm run test:coverage`
- `npm run coverage:check:90`

No debe darse por alcanzado el umbral de cobertura hasta ver las métricas emitidas por estos comandos en Windows.
