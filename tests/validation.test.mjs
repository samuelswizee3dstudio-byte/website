import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePersonalisation, validateQuantity, maxCharsForPrice, validateColour } from '../src/lib/validation.mjs';

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

test('variant letter limits are enforced, not just the global cap', () => {
  // Paying the 3-letter price for an 8-letter word must be impossible.
  assert.equal(validatePersonalisation('JONATHAN', 3).ok, false);
  assert.equal(validatePersonalisation('BEN', 3).ok, true);
  assert.equal(validatePersonalisation('JONATHAN', 8).ok, true);
  // A nonsense limit falls back to the overall cap rather than opening it up.
  assert.equal(validatePersonalisation('ABCDEFGHIJK', 99).ok, false);
  assert.equal(validatePersonalisation('ABCDEFGHIJ', 99).ok, true);
});

test('letter limits are read from price metadata or the variant label', () => {
  assert.equal(maxCharsForPrice({ metadata: { max_chars: '6' } }), 6);
  assert.equal(maxCharsForPrice({ metadata: { variant_label: '4 letters' } }), 4);
  assert.equal(maxCharsForPrice({ metadata: { variant_label: 'Up to 4 letters' } }), 4);
  // A range label caps at its upper bound: "8 to 10 letters" allows 10.
  assert.equal(maxCharsForPrice({ metadata: { variant_label: '8 to 10 letters' } }), 10);
  assert.equal(maxCharsForPrice({ metadata: { variant_label: '5 to 7 letters' } }), 7);
  assert.equal(maxCharsForPrice({ nickname: '5 characters' }), 5);
  // No hint at all: fall back to the overall cap.
  assert.equal(maxCharsForPrice({ metadata: {} }), 10);
  // Never allow more than the global maximum.
  assert.equal(maxCharsForPrice({ metadata: { max_chars: '50' } }), 10);
});

test('a colour must be one the product actually offers', () => {
  const allowed = ['Blue', 'Pink', 'Glow in the dark'];
  assert.equal(validateColour('Blue', allowed).ok, true);
  // Case and whitespace are forgiven, but the stored value is Stripe's exact string.
  assert.equal(validateColour('  blue ', allowed).value, 'Blue');
  assert.equal(validateColour('glow in the dark', allowed).value, 'Glow in the dark');
  // Anything not on the list is refused — the browser does not get to invent colours.
  assert.equal(validateColour('Chrome', allowed).ok, false);
  assert.equal(validateColour('', allowed).ok, false);
  assert.equal(validateColour(null, allowed).ok, false);
  // A product with no colours cannot take one.
  assert.equal(validateColour('Blue', []).ok, false);
});

test('the colour error names the real options, so the customer can fix it', () => {
  const r = validateColour('Chrome', ['Blue', 'Pink']);
  assert.equal(r.ok, false);
  assert.match(r.message, /Blue, Pink/);
});
