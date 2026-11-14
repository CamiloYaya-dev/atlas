# ATLAS V4.8.1 — UML Actividades (parche)

## Cambios
- Nodos UML con forma real: inicio (círculo sólido), final de actividad (diana), final de flujo (círculo con X), decisión/fusión (rombo), bifurcación/unión (barra), acción (rectángulo redondeado), objeto (rectángulo) y partición (carril contenedor).
- Reutilización de nodos en vistas existentes. No convierte ni elimina las antiguas señales del UML de actividades: solo deja de ofrecer su creación en esta vista.
- Los flujos crean relaciones semánticas de control u objeto, ambas de línea continua y flecha abierta. No son intercambiables: UML las distingue aunque se parezcan gráficamente.
- Las particiones no son extremos de flujos; sus hijos tienen coordenadas relativas.
- «Modelo UML» deja de ofrecerse en Perfiles, pero se mantiene su lectura en documentos anteriores.
- Despliegue sigue ofreciendo relación de comunicación y despliegue; el editor muestra además el nombre «Dependencia / Despliegue / Manifestación» para tipos heredados.

## Instalación
Aplicar ZIP sobre ATLAS V4.8.1 previo. Ejecutar `npm run db:migrate` por la migración 008 (permisos de nuevos elementos), luego `npm run typecheck` y `npm run test:graph`.

## Alcance no certificado
La suite completa UI y el umbral de cobertura 90% deben ejecutarse en el Windows de destino. No se alteran umbrales ni exclusiones.
