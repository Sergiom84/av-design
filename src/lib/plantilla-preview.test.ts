import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { construirEscena } from './croquis';
import { entradaDePlantilla, serializarPlantilla, puedeLeerPlantillas } from './plantilla-preview';
import { fixturePlantilla } from '@/pruebas/plantilla-preview-fixture';
import { PERMISOS_POR_ROL } from './usuarios';

describe('preview de la plantilla usa el croquis canónico', () => {
  it('mantiene cero confirmado, ausencia estimada, giro, mesa y opcionales aparte', () => {
    const datos = fixturePlantilla(); const entrada = entradaDePlantilla(datos);
    assert.equal(entrada.equipos.length, 2); assert.equal(entrada.equipos[0].posicion_confirmada, true);
    assert.deepEqual(entrada.equipos[0].posicion, { x_m: 0, y_m: 0, z_m: 0 });
    assert.equal(entrada.equipos[1].posicion_confirmada, false);
    const escena = construirEscena(entrada);
    assert.equal(escena.mesa?.rotacion_grados, 30);
    assert.equal(escena.equipos.find(e => e.id === 'linea-1')?.estimada, false);
    assert.equal(escena.equipos.find(e => e.id === 'linea-2')?.estimada, true);
    assert.equal(datos.lineas[1].x_m, null, 'el adaptador no modifica el origen');
  });
  it('un mueble auxiliar no apaga aforo y un asiento sí; no inventa puertas', () => {
    const datos = fixturePlantilla();
    datos.muebles.push({ id: 'silla', sala_id: '', mobiliario_id: 'cat-silla', nombre: 'Silla', forma: 'rectangulo', largo_m: .5, ancho_m: .5, alto_m: .8,
      x_m: 1, y_m: 1, z_m: 0, rotacion_grados: 20, posicion_confirmada: true, orden: 0, rol: null });
    assert.equal(entradaDePlantilla(datos).sala.sillas_modo, 'derivadas');
    datos.muebles[0].rol = 'asiento';
    assert.equal(entradaDePlantilla(datos).sala.sillas_modo, 'manuales');
    assert.deepEqual(entradaDePlantilla(datos).puertas, []);
  });
  it('la identidad ignora orden de claves pero detecta un giro o revisión de catálogo', () => {
    const datos = fixturePlantilla(); const antes = serializarPlantilla(datos);
    assert.equal(antes, serializarPlantilla(JSON.parse(JSON.stringify(datos))));
    datos.lineas[0].rotacion_grados = 0; assert.notEqual(antes, serializarPlantilla(datos));
    datos.lineas[0].rotacion_grados = 90; datos.lineas[0].referencia!.revision++;
    assert.notEqual(antes, serializarPlantilla(datos));
  });
  it('la lectura exige sección y cambio de clave resuelto, también con salas editables', () => {
    const yo = { permisos: PERMISOS_POR_ROL.tecnico, debeCambiarClave: false };
    assert.equal(puedeLeerPlantillas(yo), true);
    assert.equal(puedeLeerPlantillas({ ...yo, permisos: { ...yo.permisos, plantillas: 'oculto' } }), false);
    assert.equal(puedeLeerPlantillas({ ...yo, debeCambiarClave: true }), false);
    assert.equal(puedeLeerPlantillas(null), false);
  });
  it('el montaje efectivo conserva el aforo destino, incluidos cero y ausencia, sin duplicar asientos manuales', () => {
    const datos=fixturePlantilla(); datos.plantilla.aforo=8;
    for(const aforo of [4,0,null]) {
      const entrada=entradaDePlantilla(datos,{aforo});
      assert.equal(entrada.sala.aforo,aforo);
      assert.equal(construirEscena(entrada).sillas.length,aforo ?? 0);
    }
    const anulada=entradaDePlantilla(datos,{largo_m:null,mesa_largo_m:null,aforo:null});
    assert.equal(anulada.sala.largo_m,0);assert.equal(anulada.sala.mesa_largo_m,null);
  });
});
