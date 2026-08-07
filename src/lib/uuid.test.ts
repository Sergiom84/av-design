import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { esUuid } from './uuid';

describe('esUuid', () => {
  test('acepta un uuid v4', () => {
    assert.ok(esUuid('dae8d438-95ed-42e4-aebf-31db9b9b9b4a'));
    assert.ok(esUuid('DAE8D438-95ED-42E4-AEBF-31DB9B9B9B4A'));
  });

  test('rechaza lo que no es uuid', () => {
    assert.ok(!esUuid('no-es-uuid'));
    assert.ok(!esUuid(''));
    assert.ok(!esUuid('dae8d438-95ed-42e4-aebf'));
    assert.ok(!esUuid("'; drop table salas; --"));
    assert.ok(!esUuid('dae8d438-95ed-42e4-aebf-31db9b9b9b4a '));
  });
});
