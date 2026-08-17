import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  alcanza,
  esRol,
  esSeccion,
  excepcionesReales,
  IDS_SECCION,
  normalizarUsuario,
  PERMISOS_POR_ROL,
  puede,
  resolverPermisos,
  ROLES,
  SECCIONES,
  seccionDeRuta,
  usuarioValido,
} from './usuarios';

describe('los roles', () => {
  it('`av` ya no es un rol de la aplicación aunque siga en el enum de Postgres', () => {
    assert.equal(esRol('av'), false);
    assert.equal(esRol('tecnico_avanzado'), true);
  });

  it('cada rol tiene permiso definido para todas las secciones', () => {
    for (const rol of ROLES) {
      for (const seccion of IDS_SECCION) {
        assert.ok(PERMISOS_POR_ROL[rol][seccion], `${rol} / ${seccion}`);
      }
    }
  });

  it('solo el administrador ve la sección de usuarios', () => {
    for (const rol of ROLES) {
      const esperado = rol === 'admin' ? 'editar' : 'oculto';
      assert.equal(PERMISOS_POR_ROL[rol].usuarios, esperado, rol);
    }
  });

  it('lectura no edita nada', () => {
    for (const seccion of IDS_SECCION) {
      assert.notEqual(PERMISOS_POR_ROL.lectura[seccion], 'editar', seccion);
    }
  });
});

describe('editar incluye ver', () => {
  it('el orden es oculto < ver < editar', () => {
    assert.equal(alcanza('editar', 'ver'), true);
    assert.equal(alcanza('ver', 'ver'), true);
    assert.equal(alcanza('ver', 'editar'), false);
    assert.equal(alcanza('oculto', 'ver'), false);
    assert.equal(alcanza('oculto', 'oculto'), true);
  });
});

describe('el permiso efectivo', () => {
  it('sin excepciones manda el rol', () => {
    assert.deepEqual(resolverPermisos('tecnico'), PERMISOS_POR_ROL.tecnico);
  });

  it('la excepción de una persona pisa a su rol', () => {
    const permisos = resolverPermisos('tecnico', { compras: 'editar' });
    assert.equal(permisos.compras, 'editar');
    // Y no toca lo demás.
    assert.equal(permisos.salas, PERMISOS_POR_ROL.tecnico.salas);
  });

  it('una excepción puede quitar, no solo dar', () => {
    const permisos = resolverPermisos('tecnico_avanzado', { almacen: 'oculto' });
    assert.equal(permisos.almacen, 'oculto');
    assert.equal(puede(permisos, 'almacen', 'ver'), false);
  });

  it('al administrador no se le puede quitar nada', () => {
    // Guardar «admin sin acceso a usuarios» deja la aplicación sin nadie que
    // pueda repartir permisos, y salir de ahí es entrar a la base a mano.
    const permisos = resolverPermisos('admin', { usuarios: 'oculto', salas: 'oculto' });
    assert.equal(permisos.usuarios, 'editar');
    assert.equal(permisos.salas, 'editar');
  });
});

describe('solo se guarda la diferencia contra el rol', () => {
  it('lo que coincide con el rol no es una excepción', () => {
    const todo = { ...PERMISOS_POR_ROL.tecnico };
    assert.deepEqual(excepcionesReales('tecnico', todo), {});
  });

  it('lo que cambia sí se guarda', () => {
    const elegido = { ...PERMISOS_POR_ROL.tecnico, compras: 'editar' as const };
    assert.deepEqual(excepcionesReales('tecnico', elegido), { compras: 'editar' });
  });

  it('una sección sin elegir no inventa una excepción', () => {
    assert.deepEqual(excepcionesReales('tecnico', {}), {});
  });
});

describe('a qué sección pertenece una ruta', () => {
  it('la raíz solo casa consigo misma', () => {
    assert.equal(seccionDeRuta('/'), 'panel');
    assert.equal(seccionDeRuta('/salas'), 'salas');
  });

  it('gana la coincidencia más larga, no la primera', () => {
    assert.equal(seccionDeRuta('/salas/abc/plano'), 'salas');
    assert.equal(seccionDeRuta('/usuarios/abc'), 'usuarios');
  });

  it('no basta con empezar parecido', () => {
    assert.equal(seccionDeRuta('/salasx'), null);
    assert.equal(seccionDeRuta('/entrar'), null);
  });
});

describe('el identificador de acceso', () => {
  it('se normaliza a minúsculas: el corrector del móvil no crea a otra persona', () => {
    assert.equal(normalizarUsuario('  XE05206 '), 'xe05206');
  });

  it('sin espacios, sin acentos y con un largo razonable', () => {
    assert.equal(usuarioValido('xe05206'), true);
    assert.equal(usuarioValido('nombre.apellido'), true);
    assert.equal(usuarioValido('ab'), false);
    assert.equal(usuarioValido('con espacio'), false);
    assert.equal(usuarioValido('sergió'), false);
    assert.equal(usuarioValido('x'.repeat(33)), false);
  });
});

describe('el menú y los permisos hablan del mismo sitio', () => {
  it('cada sección tiene identificador único y ruta única', () => {
    assert.equal(new Set(SECCIONES.map((s) => s.id)).size, SECCIONES.length);
    assert.equal(new Set(SECCIONES.map((s) => s.ruta)).size, SECCIONES.length);
  });

  it('toda sección declarada es una sección válida', () => {
    for (const { id } of SECCIONES) assert.equal(esSeccion(id), true);
    assert.equal(esSeccion('inventado'), false);
  });
});
