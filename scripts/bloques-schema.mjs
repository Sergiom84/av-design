/**
 * Recortes de `db/schema.sql` por bloque `-- BEGIN X` / `-- END X`.
 *
 * Dos hechos del repositorio, en un solo sitio para que no se repitan mal:
 *
 * 1. `db/schema.sql` lo sigue Git con `core.autocrlf`, así que llega al árbol
 *    en CRLF; las migraciones nuevas todavía no están seguidas y están en LF.
 *    Comparar los dos crudos falla por el fin de línea, no por el SQL.
 * 2. Simular «el esquema anterior al bloque X» obliga a retirar también los
 *    bloques que se apoyan en X: dejarlos rompe el esquema recortado. La lista
 *    no se adivina ni se recorta en silencio: la prueba declara la
 *    clasificación de todos los bloques del fichero y aquí se contrasta con las
 *    referencias reales del SQL, así que un bloque nuevo detiene la prueba.
 */
import assert from 'node:assert/strict';

/** Normaliza el fin de línea para comparar SQL, nunca para escribirlo. */
export const nl = (s) => s.replaceAll('\r\n', '\n');

const BLOQUES = /-- BEGIN ([A-Z0-9 ]+)\n([\s\S]*?)-- END \1/g;
const CREACIONES = /create (?:or replace )?(?:table|function|view|type) (?:if not exists )?([a-z_0-9]+)/g;

const patronDe = (nombre) => new RegExp(`-- BEGIN ${nombre}[\\s\\S]*?-- END ${nombre}`);

/** Bloques del esquema, en orden de aparición, con el cuerpo normalizado. */
export function bloquesDeSchema(esquema) {
  const bloques = [...nl(esquema).matchAll(BLOQUES)].map((m) => ({ nombre: m[1], cuerpo: m[2] }));
  assert.ok(bloques.length > 0, 'db/schema.sql no expone ningún bloque -- BEGIN/-- END');
  return bloques;
}

/** El bloque del esquema y el de su migración dicen lo mismo. Ausente falla. */
export function exigirBloqueEquivalente(esquema, migracion, nombre, ruta) {
  const patron = patronDe(nombre);
  const trozo = (texto, donde) => {
    const m = texto.match(patron);
    assert.ok(m, `Falta el bloque ${nombre} en ${donde}`);
    return nl(m[0]);
  };
  assert.equal(
    trozo(esquema, 'db/schema.sql'),
    trozo(migracion, ruta),
    `El bloque ${nombre} de db/schema.sql y el de ${ruta} no son equivalentes`,
  );
}

const objetosDe = (cuerpo) => [...cuerpo.matchAll(CREACIONES)].map((m) => m[1]);

/**
 * Esquema anterior a `base`: sin ese bloque y sin los que dependen de él.
 * `declarado` clasifica todos los bloques del fichero (`true` = se retira).
 */
export function esquemaAnteriorA(esquema, base, declarado) {
  const bloques = bloquesDeSchema(esquema);
  assert.deepEqual(
    bloques.map((b) => b.nombre).sort(),
    Object.keys(declarado).sort(),
    `Hay bloques de db/schema.sql sin clasificar frente a ${base}: decidir si dependen de él antes de recortar`,
  );
  assert.equal(declarado[base], true, `El propio bloque ${base} debe declararse como retirado`);
  const desde = bloques.findIndex((b) => b.nombre === base);
  assert.ok(desde >= 0, `db/schema.sql no contiene el bloque ${base}`);
  // El esquema se aplica en orden, así que un bloque solo puede apoyarse en los
  // anteriores. Mirar también hacia atrás confundiría redefinir una función con
  // depender de ella y se llevaría por delante el bloque que se está migrando.
  const fuera = new Set([base]);
  const objetos = objetosDe(bloques[desde].cuerpo);
  assert.ok(objetos.length > 0, `No se detecta ningún objeto creado por ${base}`);
  for (const b of bloques.slice(desde + 1)) {
    if (objetos.some((o) => new RegExp(`\\b${o}\\b`).test(b.cuerpo))) {
      fuera.add(b.nombre);
      objetos.push(...objetosDe(b.cuerpo));
    }
  }
  for (const b of bloques) {
    assert.equal(
      fuera.has(b.nombre),
      declarado[b.nombre],
      `La dependencia real de «${b.nombre}» sobre ${base} no coincide con la declarada`,
    );
  }
  return [...fuera].reduce((texto, nombre) => {
    const patron = patronDe(nombre);
    assert.match(texto, patron);
    return texto.replace(patron, '');
  }, esquema);
}
