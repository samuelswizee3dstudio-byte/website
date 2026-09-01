// Delivery rules, in one place. The checkout function charges from these and the
// site's copy is written from them, so a price change is a one-line edit and the
// two can never disagree.
//
// UK only. Collection from Great Sankey, Warrington is always free.

export const DELIVERY_FEE_PENCE = 350;
export const FREE_DELIVERY_THRESHOLD_PENCE = 2000;

export const COLLECTION_LABEL = 'Collect from Great Sankey, Warrington';
export const DELIVERY_LABEL = 'UK delivery — Royal Mail 2nd Class';

/** Days quoted to the customer. Making time is the same either way. */
export const MAKE_DAYS = 7;
export const POST_DAYS_MIN = 2;
export const POST_DAYS_MAX = 3;

/** @param {number} subtotalPence @returns {number} pence to charge for delivery */
export function deliveryFeeFor(subtotalPence) {
  return subtotalPence >= FREE_DELIVERY_THRESHOLD_PENCE ? 0 : DELIVERY_FEE_PENCE;
}

export function formatMoney(pence) {
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds.toFixed(0)}` : `£${pounds.toFixed(2)}`;
}

/** "£3.50 UK delivery, free over £20" — used in several places verbatim. */
export const DELIVERY_SUMMARY =
  `${formatMoney(DELIVERY_FEE_PENCE)} UK delivery, free over ${formatMoney(FREE_DELIVERY_THRESHOLD_PENCE)}`;
