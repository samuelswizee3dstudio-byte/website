// Checkout: takes the browser's basket, revalidates every line against Stripe,
// and returns a hosted Checkout Session URL.
//
// Nothing the browser sends is trusted: prices, product names and amounts all
// come back from the Stripe API here. The browser only ever names price IDs.

import Stripe from 'stripe';
import {
  validatePersonalisation,
  validateQuantity,
  validateColour,
  maxCharsForPrice,
  validateColourNote,
  MAX_LINES,
} from './validation.mjs';
import { colourChoicesFrom, isCustomColour } from './catalogue.mjs';
import {
  deliveryFeeFor,
  LOCAL_LABEL,
  LOCAL_DAYS_MAX,
  LOCAL_POSTCODE_AREA,
  DELIVERY_LABEL,
  MAKE_DAYS,
  POST_DAYS_MAX,
  FAMILY_DISCOUNT_PERCENT,
  FAMILY_DISCOUNT_MIN_ITEMS,
  FAMILY_DISCOUNT_NAME,
  isFamilyDiscountItem,
  qualifiesForFamilyDiscount,
} from './shipping.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

const fail = (status, message) => new Response(JSON.stringify({ message }), { status, headers: JSON_HEADERS });

/** Stripe metadata: 50 keys max, 500 characters per value. */
const META_VALUE_MAX = 500;
const clip = (s) => (s.length <= META_VALUE_MAX ? s : `${s.slice(0, META_VALUE_MAX - 1)}…`);

/**
 * Host-agnostic checkout handler.
 *
 * Cloudflare Pages passes configuration in an `env` object. Keeping the logic
 * here rather than in the Pages Function means the validation rules — the part
 * that actually protects the family from mispriced orders — stay portable and
 * unit-testable, and survived one hosting move already.
 *
 * @param {Request} request
 * @param {Record<string, string|undefined>} env
 */
/**
 * The active price that replaced an archived one: same product, same option
 * label (`variant_label` metadata). A product with one active price and a
 * stale price with no label is the simple case of a single-price product.
 * Returns null when there is no honest match.
 *
 * @param {{ metadata?: Record<string,string> }} stale
 * @param {Array<{ id: string, active: boolean, currency: string, type: string, metadata?: Record<string,string> }>} candidates
 */
export function pickReplacementPrice(stale, candidates) {
  const label = (stale.metadata?.variant_label ?? '').trim().toLowerCase();
  const live = (candidates ?? []).filter((p) => p.active && p.currency === 'gbp' && p.type === 'one_time');
  const same = live.filter((p) => (p.metadata?.variant_label ?? '').trim().toLowerCase() === label);
  if (same.length === 1) return same[0];
  if (!label && live.length === 1) return live[0];
  return null;
}

/** Stripe truncates a long description in the Payments list; keep it scannable. */
const DESCRIPTION_MAX = 300;

/**
 * The one-line order summary that goes on the payment itself.
 *
 * This is what the family sees in the Stripe app and in the Payments list, so
 * it is effectively the order alert. A generic "Swizee order" meant opening
 * every payment to find out what it was. Names and quantities only; the colours
 * and personalisation detail stay in Metadata, which is the panel they print
 * from.
 *
 * @param {Array<{ name: string, variant?: string, text?: string, qty: number }>} lines
 */
export function orderDescription(lines) {
  const parts = (lines ?? []).map(({ name, variant, text, qty }) => {
    let part = variant ? `${name} (${variant})` : name;
    if (text) part += ` "${text}"`;
    if (qty > 1) part += ` ×${qty}`;
    return part;
  });
  if (parts.length === 0) return 'Swizee order';
  const full = parts.join(', ');
  return full.length <= DESCRIPTION_MAX ? full : `${full.slice(0, DESCRIPTION_MAX - 1)}…`;
}

export async function handleCheckout(request, env) {
  if (request.method !== 'POST') return fail(405, 'Method not allowed.');

  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY is not set on this deploy.');
    return fail(500, 'The shop is not set up for payments yet. Please try again later.');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'We could not read your basket. Please refresh and try again.');
  }

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) return fail(400, 'Your basket is empty.');
  if (items.length > MAX_LINES) return fail(400, 'That is too many different items for one order.');

  // De-duplicate first: the same price + same personalisation is one line with a
  // larger quantity, and Stripe rejects a session with a repeated price.
  const merged = new Map();
  for (const raw of items) {
    const priceId = typeof raw?.priceId === 'string' ? raw.priceId.trim() : '';
    if (!/^price_[A-Za-z0-9]+$/.test(priceId)) return fail(400, 'One of the items in your basket is not valid. Please empty your basket and try again.');

    const qty = validateQuantity(raw?.qty ?? 1);
    if (!qty.ok) return fail(400, qty.message);

    let text = '';
    if (raw?.text !== undefined && raw?.text !== null && String(raw.text) !== '') {
      const check = validatePersonalisation(raw.text);
      if (!check.ok) return fail(400, check.message);
      text = check.value;
    }

    // Colours are validated later, once Stripe has told us what this product
    // actually offers. Only the shape is checked here.
    const colour = typeof raw?.colour === 'string' ? raw.colour.trim().slice(0, 40) : '';
    const colour2 = typeof raw?.colour2 === 'string' ? raw.colour2.trim().slice(0, 40) : '';
    // Only meaningful when a colour choice is "Custom"; checked once Stripe has
    // said which options this product actually offers.
    const colourCustom = typeof raw?.colourCustom === 'string' ? raw.colourCustom.trim().slice(0, 80) : '';

    const key = `${priceId}::${text}::${colour}::${colour2}::${colourCustom}`;
    const existing = merged.get(key);
    if (existing) existing.qty = Math.min(existing.qty + qty.value, 10);
    else merged.set(key, { priceId, text, colour, colour2, colourCustom, qty: qty.value });
  }

  const lines = [...merged.values()];
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2 });

  // Look every price up. This is the authority on whether an item is real,
  // active, priced in GBP, and whether its product wants personalisation.
  let prices;
  try {
    prices = await Promise.all(
      lines.map((l) => stripe.prices.retrieve(l.priceId, { expand: ['product'] }))
    );
  } catch (err) {
    if (err?.type === 'StripeInvalidRequestError') {
      return fail(400, 'Something in your basket is no longer available. Please empty your basket and try again.');
    }
    console.error('Stripe price lookup failed:', err);
    return fail(502, 'We could not reach the payment system. Please try again in a moment.');
  }

  const lineItems = [];
  const metadata = {};
  let subtotal = 0;
  // Counted from Stripe's own product metadata, never from the basket.
  let familyUnits = 0;
  /** @type {Array<{ name: string, variant: string, text: string, qty: number }>} */
  const summaryLines = [];

  for (const [i, stale] of prices.entries()) {
    const line = lines[i];
    const product = stale.product;
    if (!product || typeof product === 'string' || product.deleted || !product.active) {
      return fail(400, 'Something in your basket is no longer available. Please empty your basket and try again.');
    }

    // Stripe prices are immutable, so a price change archives one and creates
    // another. A basket opened before the change still names the old id: charge
    // today's price for the same option rather than failing the sale.
    let price = stale;
    if (!stale.active) {
      let candidates;
      try {
        candidates = (await stripe.prices.list({ product: product.id, active: true, limit: 100 })).data;
      } catch (err) {
        console.error('Stripe price list failed:', err);
        return fail(502, 'We could not reach the payment system. Please try again in a moment.');
      }
      price = pickReplacementPrice(stale, candidates);
      if (!price) {
        return fail(400, 'Something in your basket is no longer available. Please empty your basket and try again.');
      }
    }
    if (price.currency !== 'gbp' || price.type !== 'one_time') {
      return fail(400, 'Something in your basket is no longer available. Please empty your basket and try again.');
    }

    // Re-validate against this specific price's letter limit. The earlier pass
    // only knew the global cap, so without this a customer could select the
    // 3-letter price and submit an 8-letter word.
    if (line.text) {
      const check = validatePersonalisation(line.text, maxCharsForPrice(price));
      if (!check.ok) return fail(400, `${product.name}: ${check.message}`);
    }

    const wantsText = String(product.metadata?.personalise ?? '').toLowerCase() === 'true';
    if (wantsText && !line.text) {
      return fail(400, `Please type the name or word for "${product.name}".`);
    }
    // Reject text on a product that is not personalisable rather than silently
    // dropping it — otherwise the customer thinks they ordered something we
    // never see.
    if (!wantsText && line.text) {
      return fail(400, `"${product.name}" cannot be personalised. Please remove it and add it again.`);
    }

    // Colour choices must be ones this product offers. The browser is not
    // trusted about which colours exist any more than about prices.
    const choices = colourChoicesFrom(product.metadata);
    /** @type {string[]} */
    const chosenColours = [];
    let wantsCustom = false;
    for (const choice of choices) {
      const supplied = choice.key === 'colour' ? line.colour : line.colour2;
      const check = validateColour(supplied, choice.values);
      if (!check.ok) return fail(400, `${product.name} — ${choice.label}: ${check.message}`);
      // "Custom" means the customer described their own combination. Their
      // words are required, and go into the order beside the choice so the
      // family sees what to print.
      if (choice.custom && isCustomColour(check.value)) {
        wantsCustom = true;
        const note = validateColourNote(line.colourCustom);
        if (!note.ok) return fail(400, `${product.name} — ${choice.label}: ${note.message}`);
        chosenColours.push(`${choice.label}: ${check.value} — ${note.value}`);
      } else {
        chosenColours.push(`${choice.label}: ${check.value}`);
      }
    }
    // Wording with no Custom choice behind it would never be read. Refuse
    // rather than drop it, as with a colour on a product that has none.
    if (!wantsCustom && line.colourCustom) {
      return fail(400, `"${product.name}": that colour does not take its own description. Please remove it and add it again.`);
    }
    // Reject colours on a product that has none, rather than dropping them: the
    // customer would think they had ordered something we never see.
    if (choices.length === 0 && (line.colour || line.colour2)) {
      return fail(400, `"${product.name}" does not come in different colours. Please remove it and add it again.`);
    }
    if (choices.length < 2 && line.colour2) {
      return fail(400, `"${product.name}" only has one colour choice. Please remove it and add it again.`);
    }

    lineItems.push({ price: price.id, quantity: line.qty });
    subtotal += price.unit_amount * line.qty;
    if (isFamilyDiscountItem(product.metadata)) familyUnits += line.qty;

    const variant = price.metadata?.variant_label || price.nickname || '';
    // Every line, personalised or not: the description is the order at a glance.
    summaryLines.push({ name: product.name, variant, text: line.text, qty: line.qty });

    if (line.text || chosenColours.length) {
      const label = variant ? `${product.name} (${variant})` : product.name;
      const qtyNote = line.qty > 1 ? ` ×${line.qty}` : '';
      const parts = [];
      if (line.text) parts.push(line.text);
      if (chosenColours.length) parts.push(chosenColours.join(', '));
      // One metadata key per line that needs making to order. This is what the
      // family reads in the Stripe Dashboard — see README "Reading orders".
      metadata[`item_${lineItems.length}`] = clip(`${label}${qtyNote}: ${parts.join(' — ')}`);
    }
  }

  if (lineItems.length === 0) return fail(400, 'Your basket is empty.');

  // The family discount. Stripe coupons can express a minimum spend but not
  // "three or more units", so the count happens here and a one-shot coupon is
  // attached to this session only. Created per session rather than reused, so
  // the percentage can be changed in shipping.mjs without anyone having to
  // remember to edit a coupon in the Dashboard.
  let discounts;
  if (qualifiesForFamilyDiscount(familyUnits)) {
    try {
      const coupon = await stripe.coupons.create({
        percent_off: FAMILY_DISCOUNT_PERCENT,
        duration: 'once',
        name: FAMILY_DISCOUNT_NAME,
        max_redemptions: 1,
        // An hour is the session's own lifetime; an unused coupon then expires
        // rather than accumulating in the Dashboard.
        redeem_by: Math.floor(Date.now() / 1000) + 60 * 60,
      });
      discounts = [{ coupon: coupon.id }];
      metadata.family_discount = `${FAMILY_DISCOUNT_PERCENT}% off, ${familyUnits} name clickers`;
    } catch (err) {
      // A discount that cannot be created must not stop the sale. The customer
      // pays full price and the order records that it should not have.
      console.error('Family discount coupon failed:', err);
      metadata.family_discount = `NOT APPLIED (${familyUnits} name clickers) — check with the customer`;
    }
  }

  const personalisedCount = Object.keys(metadata).length;
  metadata.items_to_personalise = String(personalisedCount);

  // Prefer the deploy's own URL so branch/preview deploys redirect to themselves
  // rather than bouncing the tester to production.
  const origin = env.SITE_URL || env.URL || env.DEPLOY_PRIME_URL || new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/cart`,
      customer_creation: 'always',
      billing_address_collection: 'auto',
      // On by design: Stripe makes the phone field required once enabled, and
      // the family would rather have a number for chasing uncollected orders.
      // Set COLLECT_PHONE=false in the hosting env vars to drop it.
      phone_number_collection: { enabled: env.COLLECT_PHONE !== 'false' },
      // UK only.
      shipping_address_collection: { allowed_countries: ['GB'] },
      ...(discounts ? { discounts } : {}),
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: LOCAL_LABEL,
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 1 },
              maximum: { unit: 'business_day', value: MAKE_DAYS + LOCAL_DAYS_MAX },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            // Free over the threshold. Worked out from Stripe's prices, not
            // from anything the basket claimed.
            fixed_amount: { amount: deliveryFeeFor(subtotal), currency: 'gbp' },
            display_name: DELIVERY_LABEL,
            delivery_estimate: {
              minimum: { unit: 'business_day', value: MAKE_DAYS },
              maximum: { unit: 'business_day', value: MAKE_DAYS + POST_DAYS_MAX },
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        // Surfaced on the payment itself, so the family sees it wherever they
        // look, not only on the session.
        metadata,
        description: orderDescription(summaryLines),
      },
      custom_text: {
        shipping_address: {
          message: `Free local delivery is for ${LOCAL_POSTCODE_AREA} postcodes only. Anywhere else in the UK, please choose Royal Mail.`,
        },
        submit: {
          message: 'Custom and personalised orders are made to order. Allow 7 days to make, then 2 to 3 days in the post.',
        },
      },
      locale: 'en-GB',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('Stripe checkout session creation failed:', err);
    return fail(502, 'We could not start checkout. Please try again in a moment.');
  }
}
