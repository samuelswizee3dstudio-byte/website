// The one server-side endpoint. Takes the browser's basket, revalidates every
// line against Stripe, and returns a hosted Checkout Session URL.
//
// Nothing the browser sends is trusted: prices, product names and amounts all
// come back from the Stripe API here. The browser only ever names price IDs.

import Stripe from 'stripe';
import {
  validatePersonalisation,
  validateQuantity,
  MAX_LINES,
} from '../../src/lib/validation.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

const fail = (status, message) => new Response(JSON.stringify({ message }), { status, headers: JSON_HEADERS });

/** Stripe metadata: 50 keys max, 500 characters per value. */
const META_VALUE_MAX = 500;
const clip = (s) => (s.length <= META_VALUE_MAX ? s : `${s.slice(0, META_VALUE_MAX - 1)}…`);

export default async (request) => {
  if (request.method !== 'POST') return fail(405, 'Method not allowed.');

  const secretKey = process.env.STRIPE_SECRET_KEY;
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

    const key = `${priceId}::${text}`;
    const existing = merged.get(key);
    if (existing) existing.qty = Math.min(existing.qty + qty.value, 10);
    else merged.set(key, { priceId, text, qty: qty.value });
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

  for (const [i, price] of prices.entries()) {
    const line = lines[i];
    const product = price.product;

    if (!price.active || price.currency !== 'gbp' || price.type !== 'one_time') {
      return fail(400, 'Something in your basket is no longer available. Please empty your basket and try again.');
    }
    if (!product || typeof product === 'string' || product.deleted || !product.active) {
      return fail(400, 'Something in your basket is no longer available. Please empty your basket and try again.');
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

    lineItems.push({ price: price.id, quantity: line.qty });

    if (line.text) {
      const variant = price.metadata?.variant_label || price.nickname || '';
      const label = variant ? `${product.name} (${variant})` : product.name;
      const qtyNote = line.qty > 1 ? ` ×${line.qty}` : '';
      // One metadata key per personalised line. This is what the family reads in
      // the Stripe Dashboard payment view — see README "Reading orders".
      metadata[`item_${lineItems.length}`] = clip(`${label}${qtyNote}: ${line.text}`);
    }
  }

  if (lineItems.length === 0) return fail(400, 'Your basket is empty.');

  const personalisedCount = Object.keys(metadata).length;
  metadata.personalised_items = String(personalisedCount);

  // Prefer the deploy's own URL so branch/preview deploys redirect to themselves
  // rather than bouncing the tester to production.
  const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/cart`,
      customer_creation: 'always',
      billing_address_collection: 'auto',
      // Off by default: Stripe makes the phone field *required* once enabled,
      // and collection is arranged by email. Set COLLECT_PHONE=true in Netlify
      // if the family would rather have a number.
      phone_number_collection: { enabled: process.env.COLLECT_PHONE === 'true' },
      // Made to order, collection only — no addresses, no shipping rates.
      metadata,
      payment_intent_data: {
        // Surfaced on the payment itself, so the family sees it wherever they
        // look, not only on the session.
        metadata,
        description: personalisedCount
          ? `Swizee order — ${personalisedCount} personalised item(s)`
          : 'Swizee order',
      },
      custom_text: {
        submit: {
          message: 'Made to order — allow 7 days. We will email you to arrange collection from Great Sankey, Warrington.',
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
};

export const config = { path: '/api/checkout' };
