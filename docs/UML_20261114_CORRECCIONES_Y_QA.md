# NOVZI V4.8.1 · UML: relaciones, paquetes, perfiles y casos de uso

Fecha: 2026-11-14. Referencia: OMG UML 2.5.1, secciones 10.4, 11.2–11.6, 12.2–12.3, 18.1, anexo B.

## Código aplicado

- Ensamblaje UML: socket orientado hacia la bola; el anclaje prioriza un tramo recto que no cruce codos. Funciona con los mismos elementos en componentes y estructura compuesta.
- Despliegue: conserva una categoría visible «Dependencia / Despliegue / Manifestación», pero distingue `communication-path` y `deployment` como relaciones diferentes. Las variantes heredadas `dependency` y `manifestation` siguen siendo legibles.
- Paquetes: cuatro opciones en la UI: Paquete, Subpaquete, Model y Profile. El Subpaquete es una **presentación de UML Package** que exige contenedor. Model y Profile son especializaciones de Package, no cajas genéricas.
- Casos de uso: solo Actor, Caso de uso y Sujeto para nuevos elementos. Sujeto puede contener casos de uso; HU y requerimientos históricos siguen siendo legibles pero no se ofrecen para crear.
- Perfiles: Profile, Stereotype, Metaclass y Package/Model, con relaciones `extension`, `apply`, `reference`, `generalization`, restricciones semánticas de extremos y contención para estereotipos. Una Metaclass se referencia, no se considera propiedad del Profile.
- Inspector: visibilidad UML (`public`, `private`, `protected`, `package`) persistida en `uml.visibility` y validada; atributos de estereotipos disponibles.
- Seguridad: nueva migración 007 que otorga **solo permisos nuevos** a roles estándar existentes. Los roles personalizados conservan sus concesiones.
- Compatibilidad de lectura: se mantienen tipos y relaciones históricos. No hay conversión automática destructiva.

## Instalación

Respaldar PostgreSQL y archivos antes de aplicar. Extraer el ZIP sobre la raíz de NOVZI, conservando `.env`.

```powershell
npm run db:migrate
npm run typecheck
npm run test:graph
npm run test:ui
npm run test:coverage
npm run coverage:check:90
```

## Pruebas visuales con `NOVZI_QA_UML_Cinco_Vistas_20261114.json`

Crear un proyecto de QA **vacío** e importar el JSON. El importador reemplaza el contenido del proyecto actual.

1. Paquetes: comprobar contención de Subpaquete, diferencia visual de Model y Profile, cambiar la visibilidad, mover un contenedor.
2. Perfiles: comprobar Profile con estereotipos contenidos, Metaclass fuera, extensión hacia Metaclass, `apply` desde paquete, `reference` desde Profile, generalización entre estereotipos.
3. Casos de uso: Sujeto con dos casos contenidos; Actor fuera; asociación e `include`.
4. Componentes: mover ambos extremos del enlace y observar que el semicírculo se abre hacia la bola, en tramos verticales y horizontales.
5. Despliegue: diferenciar dispositivo, entorno y artefacto y sus tipos de relación.

### Estado de validación de esta entrega

- `npm run test:graph`: 59/59 aprobado en el entorno de preparación.
- `npm run test:qa-tools`: 4/4 aprobado.
- TypeScript frontend: aprobado.
- Suite UI, cobertura ≥90% y typecheck completo de API: pendientes en Windows (binarios Windows en las dependencias disponibles y paquete `sharp` Linux ausente).

NOVZI implementa un subconjunto del metamodelo y la notación UML 2.5.1; no se certifica conformidad OMG total.
