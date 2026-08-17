import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * Toda acción de servidor que escribe comprueba su permiso.
 *
 * Esto no es una prueba de comportamiento, es un barrido. Son sesenta y seis
 * acciones repartidas en seis ficheros, y una acción de servidor es una
 * dirección pública: se puede llamar sin pasar por la pantalla que esconde el
 * botón. Añadir la sesenta y siete y olvidar la guarda no da ningún síntoma
 * —la pantalla sigue funcionando para quien tiene permiso— y la única forma de
 * enterarse es que lo diga una prueba.
 *
 * El barrido recorre el árbol y **comprueba que ha encontrado ficheros**. Una
 * lista escrita a mano aquí tendría el mismo problema que se intenta evitar:
 * el fichero nuevo tampoco estaría en ella.
 */

const RAIZ = 'src';

/*
  Lo que puede exportar una acción sin guarda de edición, y por qué. Cada
  entrada es una excepción razonada, no una lista de lo que no dio tiempo.
*/
const SIN_GUARDA_DE_EDICION: Record<string, string[]> = {
  // La puerta: no puede exigir sesión para dejarte entrar.
  'src/app/acciones-sesion.ts': ['entrar', 'salir', 'cambiarMiClave', 'quienSoy'],
  // Usan `exigirAdmin`, que es `exigirEdicion('usuarios')` y además el rol.
  'src/app/acciones-usuarios.ts': [],
};

const GUARDAS = ['exigirEdicion(', 'exigirAdmin(', 'exigirUsuario('];

function ficheros(directorio: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith('.ts') || ruta.endsWith('.tsx')) salida.push(ruta);
  }
  return salida;
}

function normalizar(ruta: string): string {
  return ruta.split('\\').join('/');
}

/** El cuerpo de una función exportada, desde su llave hasta la que la cierra. */
function cuerpo(texto: string, desde: number): string {
  let i = texto.indexOf('{', desde);
  if (i < 0) return '';
  let profundidad = 0;
  const inicio = i;
  for (; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidad += 1;
    else if (texto[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

/**
 * Si el fichero es un módulo de acciones de servidor.
 *
 * No vale con buscar `'use server'` en cualquier parte: dos ficheros lo
 * mencionan dentro de un comentario y no son acciones. Y no vale con exigir
 * que sea el primer carácter: un fichero puede empezar con una cabecera de
 * comentario. Se salta lo que no es código y se mira la primera línea que sí
 * lo es, que es exactamente lo que hace el compilador.
 */
function esModuloServidor(texto: string): boolean {
  let enBloque = false;
  for (const cruda of texto.split('\n')) {
    const linea = cruda.trim();
    if (enBloque) {
      if (linea.includes('*/')) enBloque = false;
      continue;
    }
    if (linea === '') continue;
    if (linea.startsWith('//')) continue;
    if (linea.startsWith('/*')) {
      if (!linea.includes('*/')) enBloque = true;
      continue;
    }
    return /^(['"])use server\1/.test(linea);
  }
  return false;
}

const modulosServidor = ficheros(RAIZ)
  .map(normalizar)
  .filter((ruta) => esModuloServidor(readFileSync(ruta, 'utf8')));

describe('las acciones de servidor comprueban permiso', () => {
  it('el barrido encuentra módulos de servidor', () => {
    // Sin esto, un fallo del barrido (ruta mala, extensión nueva) pasaría por
    // "ninguna acción sin guarda" y la prueba diría que sí en verde.
    assert.ok(
      modulosServidor.length >= 6,
      `El barrido solo encontró ${modulosServidor.length} módulos con 'use server'.`,
    );
  });

  it('cada acción exportada empieza comprobando el permiso', () => {
    const sinGuarda: string[] = [];

    for (const ruta of modulosServidor) {
      const texto = readFileSync(ruta, 'utf8');
      const permitidas = SIN_GUARDA_DE_EDICION[ruta] ?? [];

      const patron = /^export async function (\w+)/gm;
      let encontrada: RegExpExecArray | null;

      while ((encontrada = patron.exec(texto)) !== null) {
        const nombre = encontrada[1];
        if (permitidas.includes(nombre)) continue;

        const codigo = cuerpo(texto, encontrada.index);
        if (!GUARDAS.some((guarda) => codigo.includes(guarda))) {
          sinGuarda.push(`${ruta}: ${nombre}`);
        }
      }
    }

    assert.deepEqual(
      sinGuarda,
      [],
      'Acciones de servidor sin comprobar permiso:\n' + sinGuarda.join('\n'),
    );
  });

  it('la excepción documentada existe de verdad', () => {
    // Una excepción para un fichero que ya no existe es una guarda que alguien
    // cree tener. Se detecta aquí y no dentro de un año.
    for (const ruta of Object.keys(SIN_GUARDA_DE_EDICION)) {
      assert.ok(
        modulosServidor.includes(ruta),
        `${ruta} está en la lista de excepciones pero ya no es un módulo de servidor.`,
      );
    }
  });
});
