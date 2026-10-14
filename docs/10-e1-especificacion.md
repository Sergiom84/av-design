# E1 · Entregable de obra fiable

Contrato local de 13-10-2026. Origen: `Xtenav/PROMPT_CONTINUACION.md` y
AVX-01–03 de `research/comparison-backlog.{md,json}`. Base limpia `f38baa8`;
la referencia local `origin/main` añade únicamente `.mcp.json`. Se trabaja en
el checkout actual, sin commit, push ni producción. E2–E8 quedan fuera.

## Datos y revisión

Una generación lee sala, equipos, posiciones, mobiliario, puertas, puertos,
conexiones, parámetros, artículos, existencias y reservas en una transacción
Postgres `REPEATABLE READ READ ONLY`. Reutiliza los lectores y cálculos actuales.
Después cierra la transacción y genera desde ese objeto, sin nuevas consultas.
Los filtros del editor no se envían: los agregados abarcan toda la selección.

El snapshot recibe fecha, identificador único y hash de sus datos. PDF, tablas
y manifiesto llevan esa revisión. Los archivos de un paquete se guardan
temporalmente durante 30 minutos, ligados al usuario que lo creó. Descargar
de nuevo devuelve los mismos bytes. Otra generación recibe otra revisión.
Esta retención temporal no es el historial de diseño de AVX-06 y no sobrevive
a un reinicio o a varias instancias de servidor con discos independientes.

## Permisos y alcance

Servidor exige sesión vigente, contraseña provisional cambiada y `salas:ver`.
Una selección de obra exige además `proyectos:ver`, y cada sala debe pertenecer
a esa obra; una sala legado puede exportarse sola. BOM con precios y stock
exige `catalogo:ver`, `almacen:ver` y `compras:ver`. Las descargas vuelven a
comprobar esos permisos y la propiedad del paquete; el identificador no concede
acceso. No se añade un permiso nuevo ni se modifican tablas operativas.

## Formatos

- PDF vectorial de plano, cuatro elevaciones y esquema, con cajetín de obra y
  sala, códigos, fecha, revisión y paginado. A4/A3, horizontal/vertical y escala
  física 1:20/25/50/100. Lo que no cabe se pagina, sin ajustar la escala en
  silencio. El esquema lógico se declara sin escala. Ausencias y estimados
  se identifican; no se inventan medidas.
- BOM consolidada por artículo, usando `necesidadDeSala`, `calcularFaltante`
  y `agruparMaterialCable`. Necesidad, existencias, reservado global,
  disponible libre, reservado en la selección y a comprar tienen columnas
  distintas. El stock global se usa una vez en el agregado de obra. Cantidades
  de unidades distintas no se suman entre sí. Precios desconocidos quedan
  vacíos; orientativos y subtotales parciales están identificados.
- XLSX con números reales, acentos y unidades; CSV UTF-8 con BOM, `;` y decimal
  español. CSV de cables conserva las 18 columnas existentes. Textos con
  prefijos de fórmula se neutralizan. ExcelJS, PDFKit y fflate son librerías
  portables específicas de formato; no se incorpora editor documental.
- ZIP seleccionable con manifiesto de revisión, salas, formatos, archivos,
  tamaños, hashes y errores. Generación secuencial con progreso por documento.
  Un error conserva los archivos correctos y permite descargarlos separados
  o en paquete parcial. El último paquete completo queda accesible durante
  una nueva generación. Sin datos de diseño o stock escritos al exportar.

## Gates

Fixture aislada `PRUEBA-DOC-01`, segunda sala y caso incompleto en una BD
local exclusiva. Pruebas de totales, null/zero/orientativo, CSV, escala,
paginado, selección/propiedad/permisos, falla parcial e identidad de descarga.
Comparación cruda BD antes/después. `npm test`, build y types; flujo navegador
escritorio completo, móvil al cierre. Abrir XLSX, inspeccionar ZIP y renderizar
y revisar todas las páginas PDF; conservar evidencia y comandos reproducibles.
