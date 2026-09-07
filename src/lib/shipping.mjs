// Delivery rules, in one place. The checkout function charges from these and the
// site's copy is written from them, so a price change is a one-line edit and the
// two can never disagree.
//
// UK only. Two ways to get an order:
//   - Local delivery, free, WA5 postcodes, Rebecca drives it round herself.
//   - Royal Mail 2nd Class anywhere in the UK.
//
// Collection was removed on 7 Sept 2026 at Rebecca's request: she does not want
// customers calling at the house unannounced, and does not want the family's
// location known while this is a child-led business. Nothing on the site should
// invite anyone to the address.

export const DELIVERY_FEE_PENCE = 350;
export const FREE_DELIVERY_THRESHOLD_PENCE = 4000;

/** The postcode area Rebecca will deliver to herself. */
export const LOCAL_POSTCODE_AREA = 'WA5';

export const LOCAL_LABEL = `Free local delivery (${LOCAL_POSTCODE_AREA} postcodes)`;
export const DELIVERY_LABEL = 'UK delivery — Royal Mail 2nd Class';

/** Days quoted to the customer. Making time is the same either way. */
export const MAKE_DAYS = 7;
export const POST_DAYS_MIN = 2;
export const POST_DAYS_MAX = 3;
/** Local drops happen on Rebecca's own rounds, so quote a couple of days. */
export const LOCAL_DAYS_MAX = 2;

/** @param {number} subtotalPence @returns {number} pence to charge for delivery */
export function deliveryFeeFor(subtotalPence) {
  return subtotalPence >= FREE_DELIVERY_THRESHOLD_PENCE ? 0 : DELIVERY_FEE_PENCE;
}

/**
 * True for a postcode inside the free local area.
 *
 * Stripe cannot restrict a shipping option by postcode: the options are fixed
 * when the session is created, before the customer types an address. So this is
 * used for the site's own basket check, and the order still needs a human eye —
 * see `LOCAL_MISMATCH_NOTE`.
 *
 * @param {unknown} postcode
 */
export function isLocalPostcode(postcode) {
  const raw = String(postcode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return false;
  // A UK inward code is always exactly three characters (digit, letter, letter),
  // so the outward code is everything before the last three. Splitting on the
  // space instead fails when it is missing, and a plain startsWith('WA5') would
  // wrongly match WA50 and WA55, which are different places.
  const outward = raw.length > 3 ? raw.slice(0, -3) : raw;
  return outward === LOCAL_POSTCODE_AREA;
}

export function formatMoney(pence) {
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds.toFixed(0)}` : `£${pounds.toFixed(2)}`;
}

/** "£3.50 UK delivery, free over £40" — used in several places verbatim. */
export const DELIVERY_SUMMARY =
  `${formatMoney(DELIVERY_FEE_PENCE)} UK delivery, free over ${formatMoney(FREE_DELIVERY_THRESHOLD_PENCE)}`;

/** The one-liner used wherever both options are described together. */
export const DELIVERY_SUMMARY_FULL =
  `Free local delivery in ${LOCAL_POSTCODE_AREA}, or ${DELIVERY_SUMMARY}`;

/** Shown to Rebecca in the order metadata when the two do not agree. */
export const LOCAL_MISMATCH_NOTE =
  `CHECK ADDRESS: local delivery chosen but the postcode is outside ${LOCAL_POSTCODE_AREA}`;

// --- The family discount ----------------------------------------------------
// 10% off when someone buys name clickers for three or more people. Stripe
// coupons cannot express "three or more units", only a minimum spend, so the
// count is done here and the discount attached to the session.

export const FAMILY_DISCOUNT_PERCENT = 10;
export const FAMILY_DISCOUNT_MIN_ITEMS = 3;
export const FAMILY_DISCOUNT_NAME = `Family discount, ${FAMILY_DISCOUNT_PERCENT}% off ${FAMILY_DISCOUNT_MIN_ITEMS}+ name clickers`;

/** Products opt in with metadata `family_discount = true`. */
export function isFamilyDiscountItem(productMetadata) {
  return String(productMetadata?.family_discount ?? '').trim().toLowerCase() === 'true';
}

/**
 * How many qualifying units are in the basket, counted across every product
 * that opts in, because "a family of three" usually means three different
 * people and not necessarily three of the same thing.
 *
 * @param {Array<{ qty: number, qualifies: boolean }>} lines
 */
export function familyDiscountUnits(lines) {
  return (lines ?? []).reduce((n, l) => n + (l.qualifies ? Math.max(0, l.qty | 0) : 0), 0);
}

/** @param {number} units */
export function qualifiesForFamilyDiscount(units) {
  return units >= FAMILY_DISCOUNT_MIN_ITEMS;
}
