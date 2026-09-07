import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deliveryFeeFor,
  isLocalPostcode,
  isFamilyDiscountItem,
  familyDiscountUnits,
  qualifiesForFamilyDiscount,
  DELIVERY_FEE_PENCE,
  FREE_DELIVERY_THRESHOLD_PENCE,
  FAMILY_DISCOUNT_MIN_ITEMS,
} from '../src/lib/shipping.mjs';

test('free UK delivery starts at £40, not before', () => {
  assert.equal(FREE_DELIVERY_THRESHOLD_PENCE, 4000);
  assert.equal(deliveryFeeFor(3999), DELIVERY_FEE_PENCE);
  assert.equal(deliveryFeeFor(4000), 0);
  assert.equal(deliveryFeeFor(9999), 0);
  // The old £20 threshold must no longer give free postage.
  assert.equal(deliveryFeeFor(2000), DELIVERY_FEE_PENCE);
});

test('WA5 is matched, and the postcodes that merely start WA5 are not', () => {
  for (const ok of ['WA5 1AB', 'wa5 1ab', 'WA51AB', ' WA5  2XY ']) {
    assert.equal(isLocalPostcode(ok), true, ok);
  }
  // WA50 and WA55 are different outward codes and must not qualify. This is the
  // whole reason the check is not a plain startsWith.
  for (const no of ['WA50 1AB', 'WA55 2CD', 'WA1 1AA', 'WA15 8PP', 'W5 1AB', 'M5 3AB', '', null, undefined]) {
    assert.equal(isLocalPostcode(no), false, String(no));
  }
});

test('a product opts into the family discount by metadata, and only "true" counts', () => {
  assert.equal(isFamilyDiscountItem({ family_discount: 'true' }), true);
  assert.equal(isFamilyDiscountItem({ family_discount: 'TRUE' }), true);
  assert.equal(isFamilyDiscountItem({ family_discount: ' true ' }), true);
  assert.equal(isFamilyDiscountItem({ family_discount: 'yes' }), false);
  assert.equal(isFamilyDiscountItem({}), false);
  assert.equal(isFamilyDiscountItem(undefined), false);
});

test('qualifying units are counted across products, not per product', () => {
  // "A family of three" usually means three different people, and they may not
  // all want the same kind of clicker.
  const basket = [
    { qty: 2, qualifies: true },   // two of one clicker
    { qty: 1, qualifies: true },   // one of another
    { qty: 5, qualifies: false },  // cubes, which do not count
  ];
  assert.equal(familyDiscountUnits(basket), 3);
  assert.equal(qualifiesForFamilyDiscount(familyDiscountUnits(basket)), true);
});

test('two clickers do not earn the discount, three do', () => {
  assert.equal(FAMILY_DISCOUNT_MIN_ITEMS, 3);
  assert.equal(qualifiesForFamilyDiscount(2), false);
  assert.equal(qualifiesForFamilyDiscount(3), true);
  assert.equal(qualifiesForFamilyDiscount(4), true);
});

test('a basket of only non-qualifying items earns nothing', () => {
  assert.equal(familyDiscountUnits([{ qty: 9, qualifies: false }]), 0);
  assert.equal(qualifiesForFamilyDiscount(0), false);
  assert.equal(familyDiscountUnits([]), 0);
  assert.equal(familyDiscountUnits(undefined), 0);
});
