# ATLAS V4.8.1 · UML estructural — clases, objetos y componentes

Esta actualización mejora **tres** de los catorce tipos UML. Los demás conservan el soporte inicial del editor; no se declara conformidad UML 2.5.1 completa.

## Paquetes que contienen elementos

En un diagrama UML de clases, objetos o componentes, agrega una caja **Paquete**. Después crea o selecciona una caja y, en el Inspector, elige **Paquete contenedor en este diagrama**. También puedes arrastrar una caja libre al interior del paquete: el editor la agrupa al soltarla. Los miembros quedan anclados al paquete y se mueven con él; sus coordenadas se almacenan relativas a la vista. La pertenencia es propia de cada vista y no duplica las fichas del catálogo compartido.

Para sacar un elemento del paquete, selecciona **Fuera de paquete** desde el Inspector. Por ahora no se permite anidar paquetes, y un elemento contenido no se puede arrastrar fuera del borde: usa el Inspector para desagruparlo. El paquete no es una línea de relación ni una simple caja suelta. Se conservan los IDs originales y las relaciones del diagrama.

## Clases UML

Selecciona una **Clase UML** o **Interfaz UML** y, en el Inspector, usa **Estructura de clase UML**. Puedes agregar:

- Atributos: nombre, tipo de dato, longitud/ancho, visibilidad `+`, `-`, `#`, `~`, multiplicidad y valor inicial.
- Operaciones/métodos: nombre, visibilidad, tipo de retorno y lista de parámetros tipados.

La caja se dibuja con compartimentos de nombre, atributos y métodos. Los campos se almacenan como datos estructurados (`element.uml`), no como texto mezclado en resumen o descripción. No se modifica el esquema de PostgreSQL.

## Objetos UML

Un objeto muestra su nombre subrayado como `instancia: Clase`, con los slots debajo. En el Inspector selecciona la clase del objeto y añade cada atributo con su valor concreto. Esto permite distinguir la definición de clase de una instancia y visualizar varias instancias de la misma clase.

## Componentes UML

Los componentes utilizan un símbolo de componente y el diálogo de líneas ofrece tipos de relación semánticos, no solo estilos visuales:

- **Ensamblaje:** bola y encaje (ball/socket)
- **Interfaz proporcionada:** círculo (lollipop)
- **Interfaz requerida:** semicírculo (socket)
- **Dependencia:** línea discontinua con flecha abierta
- **Realización:** línea discontinua con triángulo hueco

Para UML de clases: asociación sin flechas por defecto, generalización con triángulo hueco, composición con rombo relleno, agregación con rombo sin relleno y dependencia/realización discontinuas. El diálogo permite multiplicidades y roles en los extremos.

Nota: esta versión no implementa XMI UML, comprobación semántica integral de interfaces, ni la totalidad de las decoraciones opcionales de UML 2.5.1.

## Compatibilidad y permisos

`ModelElement.uml` y `DiagramNode.parentNodeId` son opcionales: se admiten documentos anteriores. El backend valida el detalle UML, los IDs de paquete y los extremos. El contenido de UML estructural se considera detalle técnico: requiere `element.technical.view` para verse y `element.technical.edit` para editarse, además del permiso granular de la caja y el permiso de disposición para reagrupar.

## Pruebas y ejemplo

- `npm run typecheck`
- `npm run test:graph` (incluye las regresiones estructurales nuevas)
- `node scripts/verify-uml-three-qa.cjs` valida la importación de QA, sin modificar PostgreSQL
- `npm run test:ui`, `npm run test:coverage`, `npm run coverage:check:90` deben validarse en Windows/CI.

El ejemplo **`qa/ATLAS_CIRCUITO_UML_3_VISTAS_QA.json`** incluye 4 vistas conectadas: trazabilidad, UML de clases, objetos y componentes. Utiliza un proyecto vacío porque el importador reemplaza el documento actual.
