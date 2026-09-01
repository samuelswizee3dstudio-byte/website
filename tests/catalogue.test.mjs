import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, slugify, formatPrice, formatPriceRange } from '../src/lib/catalogue.mjs';

const product = (over = {}) => ({ id: 'prod_1', active: true, name: 'Thing', description: '', images: [], metadata: {}, ...over });
const price = (over = {}) => ({ id: 'price_1', active: true, currency: 'gbp', type: 'one_time', unit_amount: 500, product: 'prod_1', nickname: null, metadata: {}, ...over });

test('slugify handles names the family will actually type', () => {
  assert.equal(slugify('Axolotl Fidget Buddy'), 'axolotl-fidget-buddy');
  assert.equal(slugify('Name Plate — 3 Letters'), 'name-plate-3-letters');
  assert.equal(slugify('Salt & Pepper'), 'salt-and-pepper');
  assert.equal(slugify('  Café  '), 'cafe');
  assert.equal(slugify('!!!'), 'product');
});

test('a product with no active price is not sellable and is dropped', () => {
  assert.equal(normalise([product()], [price({ active: false })]).length, 0);
  assert.equal(normalise([product()], []).length, 0);
});

test('inactive or hidden products are dropped', () => {
  assert.equal(normalise([product({ active: false })], [price()]).length, 0);
  assert.equal(normalise([product({ metadata: { hidden: 'true' } })], [price()]).length, 0);
});

test('non-GBP and recurring prices are ignored, not guessed at', () => {
  assert.equal(normalise([product()], [price({ currency: 'usd' })]).length, 0);
  assert.equal(normalise([product()], [price({ type: 'recurring' })]).length, 0);
});

test('variants sort by metadata sort then amount, and get labels', () => {
  const out = normalise([product()], [
    price({ id: 'price_b', unit_amount: 900, metadata: { variant_label: '8 to 10 letters', sort: '3' } }),
    price({ id: 'price_a', unit_amount: 500, metadata: { variant_label: 'Up to 4 letters', sort: '1' } }),
  ]);
  assert.deepEqual(out[0].variants.map((v) => v.id), ['price_a', 'price_b']);
  assert.equal(out[0].priceFrom, 500);
  assert.equal(out[0].priceTo, 900);
  assert.equal(formatPriceRange(out[0]), '£5 – £9');
});

test('multiple unlabelled prices fall back to the amount as a label', () => {
  const out = normalise([product()], [price({ id: 'price_a', unit_amount: 500 }), price({ id: 'price_b', unit_amount: 750 })]);
  assert.deepEqual(out[0].variants.map((v) => v.label), ['£5', '£7.50']);
});

test('a single price needs no variant label', () => {
  const out = normalise([product()], [price()]);
  assert.equal(out[0].variants.length, 1);
  assert.equal(out[0].variants[0].label, '');
});

test('metadata flags are read, and only "true" counts', () => {
  const out = normalise(
    [product({ metadata: { personalise: 'TRUE', featured: 'yes', category: 'name-items', personalise_label: 'Word' } })],
    [price()]
  );
  assert.equal(out[0].personalise, true);
  assert.equal(out[0].featured, false);
  assert.equal(out[0].category, 'name-items');
  assert.equal(out[0].personaliseLabel, 'Word');
});

test('metadata slug wins over the product name', () => {
  const out = normalise([product({ name: 'Long Winded Name', metadata: { slug: 'axolotl' } })], [price()]);
  assert.equal(out[0].slug, 'axolotl');
});

test('duplicate names get distinct, deterministic slugs', () => {
  const out = normalise(
    [product({ id: 'prod_1', name: 'Axolotl' }), product({ id: 'prod_2', name: 'Axolotl' })],
    [price({ id: 'price_1', product: 'prod_1' }), price({ id: 'price_2', product: 'prod_2' })]
  );
  assert.deepEqual(out.map((p) => p.slug).sort(), ['axolotl', 'axolotl-2']);
});

test('metadata image overrides the Stripe photo', () => {
  const out = normalise([product({ images: ['https://stripe/x.png'], metadata: { image: '/images/mine.jpg' } })], [price()]);
  assert.deepEqual(out[0].images, ['/images/mine.jpg']);
});

test('prices format the way a price tag reads', () => {
  assert.equal(formatPrice(1000), '£10');
  assert.equal(formatPrice(350), '£3.50');
  assert.equal(formatPrice(999), '£9.99');
});
