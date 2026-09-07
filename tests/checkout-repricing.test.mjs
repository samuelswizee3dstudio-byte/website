import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickReplacementPrice } from '../src/lib/checkout-core.mjs';

const gbp = (id, label, extra = {}) => ({ id, active: true, currency: 'gbp', type: 'one_time', metadata: label ? { variant_label: label } : {}, ...extra });

test('an archived letter-count price maps to the live price with the same label', () => {
  const stale = { id: 'price_old5', metadata: { variant_label: '5 letters' } };
  const live = [gbp('price_new3', '3 letters'), gbp('price_new5', '5 letters'), gbp('price_new8', '8 letters')];
  assert.equal(pickReplacementPrice(stale, live)?.id, 'price_new5');
});

test('a single-price product needs no label to match', () => {
  const stale = { id: 'price_oldcube', metadata: {} };
  assert.equal(pickReplacementPrice(stale, [gbp('price_newcube', '')])?.id, 'price_newcube');
});

test('no honest match means no substitution', () => {
  // Two live prices and no label: it would be a guess which one they meant.
  assert.equal(pickReplacementPrice({ metadata: {} }, [gbp('a', '3 letters'), gbp('b', '5 letters')]), null);
  // Label that no live price carries.
  assert.equal(pickReplacementPrice({ metadata: { variant_label: '12 letters' } }, [gbp('a', '3 letters')]), null);
  // Only inactive, foreign-currency or recurring candidates.
  assert.equal(pickReplacementPrice({ metadata: { variant_label: '3 letters' } }, [
    gbp('a', '3 letters', { active: false }), gbp('b', '3 letters', { currency: 'usd' }), gbp('c', '3 letters', { type: 'recurring' }),
  ]), null);
});

test('label matching is forgiving about case and spaces', () => {
  const stale = { metadata: { variant_label: ' 3 Letters ' } };
  assert.equal(pickReplacementPrice(stale, [gbp('x', '3 letters')])?.id, 'x');
});
