// Build-time catalogue. Stripe is the single source of truth for products,
// prices, photos and descriptions — nothing about a product is hard-coded here
// or anywhere else in the repo.
//
// Metadata conventions are documented in README.md. Keep the two in sync.

import Stripe from 'stripe';
import { FIXTURE_PRODUCTS } from './fixtures.mjs';
import { loadEnv } from './load-env.mjs';
import { maxCharsForPrice } from './validation.mjs';

const GBP = 'gbp';

/** @typedef {{ id: string, label: string, unitAmount: number, sort: number, maxChars: number }} Variant */
/** @typedef {{ id: string, slug: string, name: string, description: string, images: string[],
 *              category: string | null, personalise: boolean, personaliseLabel: string,
 *              featured: boolean, sort: number, variants: Variant[],
 *              priceFrom: number, priceTo: number }} Product */

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'product';
}

export function formatPrice(pence) {
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds.toFixed(0)}` : `£${pounds.toFixed(2)}`;
}

/** Range label for a product card: "£6" or "£6 – £8". */
export function formatPriceRange(product) {
  return product.priceFrom === product.priceTo
    ? formatPrice(product.priceFrom)
    : `${formatPrice(product.priceFrom)} – ${formatPrice(product.priceTo)}`;
}

/**
 * Card price, per the design handoff: "from £3.50" when the product has
 * variants, plain "£3.50" when it does not.
 */
export function formatCardPrice(product) {
  return product.variants.length > 1
    ? `from ${formatPrice(product.priceFrom)}`
    : formatPrice(product.priceFrom);
}

const truthy = (v) => String(v ?? '').trim().toLowerCase() === 'true';
const intOr = (v, fallback) => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

async function listAll(fn) {
  /** @type {any[]} */
  const out = [];
  let startingAfter;
  for (let page = 0; page < 50; page++) {
    const res = await fn(startingAfter);
    out.push(...res.data);
    if (!res.has_more) return out;
    startingAfter = res.data[res.data.length - 1].id;
  }
  throw new Error('Stripe catalogue pagination did not terminate after 50 pages.');
}

/**
 * Turn raw Stripe products + prices into the shape the site renders.
 * Exported separately from the fetch so it can be unit tested without network.
 * @returns {Product[]}
 */
export function normalise(stripeProducts, stripePrices) {
  /** @type {Map<string, any[]>} */
  const pricesByProduct = new Map();
  for (const price of stripePrices) {
    if (!price.active) continue;
    if (price.currency !== GBP) continue;
    // One-off pricing only. Recurring or tiered pricing is out of scope and
    // would silently mis-charge, so skip rather than guess.
    if (price.type !== 'one_time') continue;
    if (typeof price.unit_amount !== 'number') continue;
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;
    if (!productId) continue;
    const list = pricesByProduct.get(productId) ?? [];
    list.push(price);
    pricesByProduct.set(productId, list);
  }

  /** @type {Product[]} */
  const products = [];
  const seenSlugs = new Map();

  for (const p of stripeProducts) {
    if (!p.active) continue;
    if (truthy(p.metadata?.hidden)) continue;

    const rawPrices = pricesByProduct.get(p.id) ?? [];
    if (rawPrices.length === 0) continue;

    /** @type {Variant[]} */
    const variants = rawPrices
      .map((price) => ({
        id: price.id,
        label: price.metadata?.variant_label?.trim() || price.nickname?.trim() || '',
        unitAmount: price.unit_amount,
        sort: intOr(price.metadata?.sort, Number.MAX_SAFE_INTEGER),
        maxChars: maxCharsForPrice(price),
      }))
      .sort((a, b) => a.sort - b.sort || a.unitAmount - b.unitAmount || a.id.localeCompare(b.id));

    // A single unlabelled price needs no selector; multiple prices must be
    // distinguishable, so fall back to the amount as the label.
    if (variants.length > 1) {
      for (const v of variants) if (!v.label) v.label = formatPrice(v.unitAmount);
    }

    let slug = (p.metadata?.slug?.trim() || slugify(p.name));
    if (seenSlugs.has(slug)) {
      // Two products with the same name. Deterministic, and flagged at build time.
      const n = seenSlugs.get(slug) + 1;
      seenSlugs.set(slug, n);
      console.warn(`[catalogue] duplicate slug "${slug}" — "${p.name}" (${p.id}) becomes "${slug}-${n}". Set a unique metadata "slug" in Stripe to fix.`);
      slug = `${slug}-${n}`;
    } else {
      seenSlugs.set(slug, 1);
    }

    const metaImage = p.metadata?.image?.trim();
    const images = metaImage ? [metaImage] : (p.images ?? []).filter(Boolean);

    products.push({
      id: p.id,
      slug,
      name: p.name,
      description: (p.description ?? '').trim(),
      images,
      category: p.metadata?.category?.trim() || null,
      personalise: truthy(p.metadata?.personalise),
      personaliseLabel: p.metadata?.personalise_label?.trim() || 'Name or word to print',
      featured: truthy(p.metadata?.featured),
      sort: intOr(p.metadata?.sort, Number.MAX_SAFE_INTEGER),
      variants,
      priceFrom: Math.min(...variants.map((v) => v.unitAmount)),
      priceTo: Math.max(...variants.map((v) => v.unitAmount)),
    });
  }

  return products.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

/**
 * True on any hosted build. `CI` covers Cloudflare Pages and GitHub Actions;
 * the rest are belt and braces in case a provider stops setting it, and because
 * this guard once did nothing on a host it had not heard of.
 */
function isHostedBuild() {
  const e = process.env;
  return Boolean(e.CI || e.CF_PAGES || e.NETLIFY || e.VERCEL || e.GITHUB_ACTIONS || e.CONTEXT);
}

let cached = null;

/**
 * Fetch and normalise the catalogue. Memoised: Astro renders many pages per
 * build and they should all see one consistent snapshot from one API round trip.
 * @returns {Promise<Product[]>}
 */
export async function getCatalogue() {
  if (cached) return cached;

  loadEnv();
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    // A hosted build must never ship placeholder products. This originally
    // keyed off one host's CONTEXT variable, which meant it did nothing at all
    // on Cloudflare Pages — the first Pages deploy silently published four
    // invented products. Detect any hosted build instead of one host's.
    if (isHostedBuild() && process.env.ALLOW_SAMPLE_CATALOGUE !== 'true') {
      throw new Error(
        'STRIPE_SECRET_KEY is not set. Add it to the hosting environment variables before ' +
        'deploying, or set ALLOW_SAMPLE_CATALOGUE=true to deploy the sample catalogue ' +
        'deliberately while the Stripe account is still being set up.'
      );
    }
    if (isHostedBuild()) {
      console.warn('[catalogue] ALLOW_SAMPLE_CATALOGUE is on — this deploy is shipping SAMPLE products. Remove it once STRIPE_SECRET_KEY is set.');
    }
    console.warn(
      '\n[catalogue] STRIPE_SECRET_KEY is not set — building with SAMPLE products from src/lib/fixtures.mjs.\n' +
      '[catalogue] Nothing here is real. Set the key to build the real catalogue.\n'
    );
    cached = normalise(FIXTURE_PRODUCTS.products, FIXTURE_PRODUCTS.prices);
    return cached;
  }

  const stripe = new Stripe(key, { maxNetworkRetries: 3 });

  const [products, prices] = await Promise.all([
    listAll((starting_after) => stripe.products.list({ active: true, limit: 100, starting_after })),
    listAll((starting_after) => stripe.prices.list({ active: true, limit: 100, starting_after })),
  ]);

  cached = normalise(products, prices);

  if (cached.length === 0) {
    console.warn('[catalogue] Stripe returned no sellable products. Check products are Active and have an active one-off GBP price.');
  } else {
    console.log(`[catalogue] ${cached.length} products from Stripe (${/^[a-z]{2}_live_/.test(key) ? 'LIVE' : 'test'} mode).`);
  }
  return cached;
}

/**
 * Live keys come in more than one shape: `sk_live_...` for a standard secret key
 * and `rk_live_...` for a restricted one. Matching only `sk_live` meant a site
 * running on a restricted live key would show the purple "test mode, payments
 * are not real" banner to real customers.
 */
export function isTestMode() {
  return !/^[a-z]{2}_live_/.test(String(process.env.STRIPE_SECRET_KEY ?? ''));
}
