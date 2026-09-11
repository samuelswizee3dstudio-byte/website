import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderDescription } from '../src/lib/checkout-core.mjs';

// This string is the order alert: it is what shows in the Stripe app and in the
// Payments list, so a person should be able to tell what to print without
// opening the payment.

test('a personalised line names the product and the word', () => {
  assert.equal(
    orderDescription([{ name: 'Name Clicker Keyring', variant: '5 letters', text: 'ELLIE', qty: 1 }]),
    'Name Clicker Keyring (5 letters) "ELLIE"',
  );
});

test('quantity shows only when there is more than one', () => {
  assert.equal(orderDescription([{ name: 'Infinity Cube', qty: 1 }]), 'Infinity Cube');
  assert.equal(orderDescription([{ name: 'Infinity Cube', qty: 3 }]), 'Infinity Cube ×3');
});

test('a basket lists every line, personalised or not', () => {
  assert.equal(
    orderDescription([
      { name: 'Name Clicker Keyring', variant: '3 letters', text: 'SAM', qty: 2 },
      { name: 'Sensory Clicky Cube', variant: '', text: '', qty: 1 },
    ]),
    'Name Clicker Keyring (3 letters) "SAM" ×2, Sensory Clicky Cube',
  );
});

test('a long basket is truncated rather than sent whole', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `Shaped Bubble Popper Keyring ${i}`, qty: 1 }));
  const out = orderDescription(many);
  assert.equal(out.length, 300);
  assert.ok(out.endsWith('…'));
});

test('an empty basket still gives Stripe something to show', () => {
  assert.equal(orderDescription([]), 'Swizee order');
  assert.equal(orderDescription(undefined), 'Swizee order');
});
