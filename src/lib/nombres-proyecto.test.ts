import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  codigoLibreDeProyecto,
  codigoSugeridoProyecto,
  prefijoCodigoProyecto,
} from './nombres-proyecto';

const EL_23_DE_AGOSTO = new Date(2026, 7, 23);

describe('prefijoCodigoProyecto', () => {
  test('día, mes y dos cifras de año', () => {
    assert.equal(prefijoCodigoProyecto(EL_23_DE_AGOSTO), '230826');
  });

  test('rellena con cero el día y el mes de una cifra', () => {
    assert.equal(prefijoCodigoProyecto(new Date(2026, 0, 5)), '050126');
  });

  test('el año 2000 no se queda sin cifras', () => {
    assert.equal(prefijoCodigoProyecto(new Date(2000, 2, 1)), '010300');
  });
});

describe('codigoSugeridoProyecto', () => {
  test('la primera obra del día es el _1', () => {
    assert.equal(codigoSugeridoProyecto(EL_23_DE_AGOSTO, []), '230826_1');
  });

  test('sigue por el correlativo mayor de esa fecha', () => {
    assert.equal(
      codigoSugeridoProyecto(EL_23_DE_AGOSTO, ['230826_1', '230826_2']),
      '230826_3',
    );
  });

  test('un hueco por el medio no se reutiliza: la referencia ya está en una factura', () => {
    assert.equal(
      codigoSugeridoProyecto(EL_23_DE_AGOSTO, ['230826_1', '230826_3']),
      '230826_4',
    );
  });

  test('los códigos de otros días no cuentan', () => {
    assert.equal(
      codigoSugeridoProyecto(EL_23_DE_AGOSTO, ['220826_7', '010126_9']),
      '230826_1',
    );
  });

  test('una referencia tecleada a mano no consume número', () => {
    assert.equal(codigoSugeridoProyecto(EL_23_DE_AGOSTO, ['TP26']), '230826_1');
  });
});

describe('codigoLibreDeProyecto', () => {
  test('sin código no inventa ninguno', () => {
    assert.equal(codigoLibreDeProyecto(null, ['230826_1']), null);
  });

  test('libre, se queda como está', () => {
    assert.equal(codigoLibreDeProyecto('230826_2', ['230826_1']), '230826_2');
  });

  test('ocupado, salta al siguiente libre', () => {
    assert.equal(
      codigoLibreDeProyecto('230826_1', ['230826_1', '230826_2']),
      '230826_3',
    );
  });

  test('una referencia a mano se respeta aunque se repita', () => {
    assert.equal(codigoLibreDeProyecto('TP26', ['TP26']), 'TP26');
  });
});
