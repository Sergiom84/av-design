# E3 · Revisiones, alternativas y diagrama

Contrato local de 14-10-2026. Base comprobada local y remota:
`codex/e1-e2-local`, `7ba796077ff39e799b9b7eb87109b648c3df5c2d`.
Alcance AVX-06, AVX-07, AVX-08 y AVX-13. E1/E2 se conservan;
sin investigación nueva, commit, push, merge, despliegue ni producción.

## Diseño e historia

Una revisión nombrada conserva autor real, fecha, número, hash, antecedente
y un snapshot consistente e inmutable. Incluye medidas/mesa/sillas, equipos
y sus dimensiones congeladas, XYZ/ausencias/giros y posición visual separada,
muebles, puertas, rosetas, conexiones/bocas/rutas físicas, BOM adicional y
anotaciones. Catálogo, puertos y parámetros se capturan como contexto histórico;
restaurar nunca modifica sus tablas globales.

Quedan fuera movimientos, existencias, reservas, compras/recepciones, cargas,
hitos, visitas, seriales/activos y preferencias personales. La retención es
durable sin purga automática; el historial no es un segundo editor ni sustituye
la retención temporal E1. No hay borrado de revisiones desde la aplicación.

Crear/restaurar/duplicar verifica `diseno_version` y hash del diseño base bajo transacción.
Triggers de las tablas de diseño detectan también cambios A→B→A.
El hash cubre escrituras anteriores que no incrementaban `diagrama_version`.
Restaurar reconcilia identidades de la misma sala, preserva relaciones y genera
una revisión nueva; referencia retirada/incompatible, atribución BOM o dependencia
operativa incompatible provoca rechazo íntegro, nunca cascada sobre operación.
El diff distingue medidas, equipo/puertos, rutas, material y presentación visual.

Los identificadores de cable se congelan en una columna persistida, inicializada
con el orden actual. Nuevas conexiones reciben el siguiente correlativo por
señal; mover, eliminar, restaurar o copiar no renumera las existentes.

## Alternativas

La previsualización enumera qué se copia y las exclusiones operativas.
Duplicar genera sala e identidades nuevas para instancias/conexiones/bocas/rutas,
manteniendo geometría, ausencias, rotaciones, dimensiones congeladas y relación
de puertos. Copia BOM como diseño sin atribuirla al lote de importación original.
Se registra origen/herencia de medidas y revisión inicial. El destino pertenece
a la misma localización (o sigue siendo legado); se rechaza obra cerrada.
La comparación usa el mismo diff y muestra material original/copia; guardar
como plantilla conserva la acción existente.

## Diagrama y anotaciones

El editor lógico existente gana selección múltiple accesible, alineación,
distribución y ordenación deterministas con altura real de bloques, vista previa,
aplicar/cancelar y deshacer/rehacer. Sólo cambia `esquema_x/y`; XYZ, metros,
conexiones y orden de alta permanecen. Fixture de 15 equipos, matriz de 24 bocas
y 100 conexiones, con zoom, selección y etiquetas comprobados.

Anotación normalizada: id/texto, ancla `sala|equipo|conexion|visual`, ancla_id
y coordenadas visuales opcionales. Borrar un ancla exige conservar la nota
desvinculada o retirarla; el servidor también protege otras superficies de baja.
Símbolos geométricos propios y leyenda derivados de categorías/señales usadas,
con texto y forma además de color. Un helper compartido alimenta UI y PDF;
no se incorpora biblioteca externa ni un dibujo paralelo.

E1 lee revisión/antecedentes/anotaciones dentro de su snapshot consistente.
Un diseño modificado identifica hash de borrador y su antecedente, sin atribuir
el contenido vivo a una revisión anterior. PDF incluye notas, leyenda y referencia
de diseño; matrices grandes se paginan de manera legible. Manifiesto y tablas
identifican por sala el estado consistente sin alterar las 18 columnas CSV cable.

## Permisos, migraciones y errores

Lectura: sesión vigente, contraseña cambiada y `salas:ver`. Escritura:
`salas:editar`, usuario real para autoría y guardas de obra cerrada/pertenencia.
Contexto sensible de material respeta permisos de catálogo/almacén/compras.
Cada petición reconsulta permisos; las APIs mutantes verifican origen y entrada.
Errores de conflicto/destino/ancla/referencia se explican y no dejan escrituras
parciales. Migraciones versionadas e incorporadas a schema, rollback estructural
guardado contra datos existentes; sólo se aplican a la nueva base sintética.

## Gates y propiedad

Destino nuevo: `av_design_e3_prueba`, usuario `av_design_e3`, loopback:5547,
servidor:5432; app localhost:3105, caché independiente. Antes de escribir se
verifican URL e identidad real. Fixture `PRUEBA-REV-01`, sin seed/inventario real.
Regresiones E2 reutilizadas en otra base nueva `av_design_e3_regresiones`, usuario
del mismo nombre, loopback:5548. Las copias de los gates conservan filas crudas;
al comparar negocio E2 exceptúan sólo el contador E3 monotónico y su timestamp
de sala, cuyo aumento tras cambios y reversiones es deliberado.

Ejecutor dominio: migración revisiones/IDs, core/API y UI historial/alternativas.
Ejecutor editor: operaciones/anotaciones/símbolos y guardado editor lógico.
Ejecutor entregables: documentos E1 y lectura del identificador persistido.
Arquitecto: integración schema, fixture/gates, navegador, evidencia y documentación.
No hay edición simultánea del mismo archivo.

Gates: inmutabilidad/consistencia/diff, conflicto ABA y rollback; restauración y
duplicación sin hechos operativos; legado/obra cerrada, pertenencia/propiedad y
permiso retirado; matriz grande, ratón/teclado, escritorio completo antes de móvil;
exportaciones reales renderizadas/inspeccionadas, XLSX reabierto y hashes.
Reusar regresiones E1/E2 afectadas (stock único, null, seed app/CSV, imágenes
corruptas, reversión posterior/ABA). `npm test`, build Webpack sin BD, tipos,
lint y `git diff --check`. Evidencia separada `output/e3-revisiones/`.

Una implementación, revisión independiente con artefacto/contrato/salida cruda,
una corrección conjunta y gate determinista. No se acepta el informe del autor
como evidencia ni se abre E4–E8.
