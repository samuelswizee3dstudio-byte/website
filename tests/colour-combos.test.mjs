import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colourChoicesFrom, isCustomColour } from '../src/lib/catalogue.mjs';
import { validateColourNote, COLOUR_NOTE_MAX } from '../src/lib/validation.mjs';

test('a colour list containing "Custom" marks the choice as taking free text', () => {
  const [choice] = colourChoicesFrom({
    colours: 'Bubblegum,Candy floss,Ice,Pop,Twist,Fizz,Fresh,Custom',
    colour_label: 'Colour combination',
  });
  assert.equal(choice.label, 'Colour combination');
  assert.equal(choice.custom, true);
  assert.equal(choice.values.length, 8);
  assert.equal(choice.values.at(-1), 'Custom');
});

test('a list without it does not', () => {
  const [choice] = colourChoicesFrom({ colours: 'Black,White' });
  assert.equal(choice.custom, false);
});

test('"Custom" is recognised whatever the case or spacing', () => {
  for (const v of ['Custom', 'custom', ' CUSTOM ']) assert.equal(isCustomColour(v), true);
  for (const v of ['Bubblegum', '', null, undefined, 'customise']) assert.equal(isCustomColour(v), false);
});

test('the customer\'s own wording is accepted, tidied, and bounded', () => {
  assert.deepEqual(validateColourNote('  Pink   base,  white letters '), { ok: true, value: 'Pink base, white letters' });
  assert.equal(validateColourNote("Navy & lime (Sam's)").ok, true);
  assert.equal(validateColourNote('').ok, false);
  assert.equal(validateColourNote('   ').ok, false);
  assert.equal(validateColourNote(undefined).ok, false);
  assert.equal(validateColourNote('a'.repeat(COLOUR_NOTE_MAX + 1)).ok, false);
  assert.equal(validateColourNote('pink 💖').ok, false);
  assert.equal(validateColourNote('<script>alert(1)</script>').ok, false);
});
