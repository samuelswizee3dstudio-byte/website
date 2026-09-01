import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePersonalisation, validateQuantity } from '../src/lib/validation.mjs';

test('personalisation accepts letters and numbers up to 10', () => {
  for (const ok of ['JAKE', 'a', 'Ava2011', 'ABCDEFGHIJ', '1234567890']) {
    assert.equal(validatePersonalisation(ok).ok, true, ok);
  }
});

test('personalisation trims surrounding whitespace', () => {
  const r = validatePersonalisation('  JAKE  ');
  assert.equal(r.ok, true);
  assert.equal(r.value, 'JAKE');
});

test('personalisation rejects the things a ten-year-old will actually type', () => {
  for (const bad of ['', '   ', 'ABCDEFGHIJK', 'Jake Smith', "O'Brien", 'Jake!', '🙂', 'Jake-2', 'a\nb']) {
    assert.equal(validatePersonalisation(bad).ok, false, JSON.stringify(bad));
  }
});

test('personalisation rejects non-strings', () => {
  for (const bad of [null, undefined, 42, {}, ['JAKE']]) {
    assert.equal(validatePersonalisation(bad).ok, false, String(bad));
  }
});

test('quantity accepts 1 to 10 only, as whole numbers', () => {
  assert.equal(validateQuantity(1).ok, true);
  assert.equal(validateQuantity(10).ok, true);
  assert.equal(validateQuantity('3').ok, true);
  for (const bad of [0, -1, 11, 1.5, NaN, 'lots', null]) {
    assert.equal(validateQuantity(bad).ok, false, String(bad));
  }
});
