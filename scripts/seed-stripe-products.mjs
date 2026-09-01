// Stage 2 of the brief: create sample test products in Stripe covering every
// case the site has to handle, and set the metadata convention.
//
//   node scripts/seed-stripe-products.mjs          # create or update
//   node scripts/seed-stripe-products.mjs --dry    # show what it would do
//   node scripts/seed-stripe-products.mjs --clean  # archive everything it made
//
// Idempotent: each product carries metadata.seed_id, and a re-run updates that
// product rather than making a second one. Refuses to touch a live account.

import Stripe from 'stripe';
import { readFileSync } from 'node:fs';

// Load .env without a dependency — the file is a handful of KEY=value lines.
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env, use the real environment */ }

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Put it in .env (see .env.example) and try again.');
  process.exit(1);
}
if (key.startsWith('sk_live')) {
  console.error('That is a LIVE key. This script only ever runs against test/sandbox keys.');
  process.exit(1);
}

const dry = process.argv.includes('--dry');
const clean = process.argv.includes('--clean');
const stripe = new Stripe(key, { maxNetworkRetries: 3 });

// The four cases from the brief: a plain item, an item with price variants, a
// personalisable item with variants, and a personalisable item without.
const SEED = [
  {
    seed_id: 'axolotl-buddy',
    name: 'Axolotl Fidget Buddy',
    description: 'A wiggly articulated axolotl that actually moves. Printed in one piece — no glue, no batteries.',
    metadata: { category: 'axolotls', featured: 'true', sort: '10', slug: 'axolotl-buddy', image: '/images/samples/axolotl.svg' },
    prices: [{ amount: 600 }],
  },
  {
    seed_id: 'hex-spinner',
    name: 'Hex Fidget Spinner',
    description: 'Smooth six-sided spinner, quiet enough for the back of the classroom. Two sizes.',
    metadata: { category: 'fidgets', featured: 'true', sort: '20', slug: 'hex-spinner', image: '/images/samples/hex.svg' },
    prices: [
      { amount: 400, label: 'Small (50mm)', sort: '1' },
      { amount: 550, label: 'Large (70mm)', sort: '2' },
    ],
  },
  {
    seed_id: 'name-plate',
    name: 'Name Plate',
    description: 'Your name printed big and bold, standing up on a shelf or a desk.',
    metadata: {
      category: 'name-items', personalise: 'true', personalise_label: 'Name to print',
      featured: 'true', sort: '30', slug: 'name-plate', image: '/images/samples/nameplate.svg',
    },
    prices: [
      { amount: 500, label: 'Up to 4 letters', sort: '1' },
      { amount: 700, label: '5 to 7 letters', sort: '2' },
      { amount: 900, label: '8 to 10 letters', sort: '3' },
    ],
  },
  {
    seed_id: 'name-keyring',
    name: 'Personalised Keyring',
    description: 'A chunky keyring with your name on it. Comes with a split ring.',
    metadata: { category: 'name-items', personalise: 'true', sort: '40', slug: 'name-keyring', image: '/images/samples/keyring.svg' },
    prices: [{ amount: 350 }],
  },
];

async function findBySeedId(seedId) {
  // Stripe search is eventually consistent on new objects, so list and filter —
  // slower, but correct immediately after a create.
  for await (const p of stripe.products.list({ limit: 100 })) {
    if (p.metadata?.seed_id === seedId) return p;
  }
  return null;
}

async function run() {
  if (clean) {
    let n = 0;
    for (const spec of SEED) {
      const existing = await findBySeedId(spec.seed_id);
      if (!existing) continue;
      if (dry) { console.log(`would archive ${existing.name} (${existing.id})`); n++; continue; }
      for await (const price of stripe.prices.list({ product: existing.id, limit: 100 })) {
        if (price.active) await stripe.prices.update(price.id, { active: false });
      }
      await stripe.products.update(existing.id, { active: false });
      console.log(`archived ${existing.name} (${existing.id})`);
      n++;
    }
    console.log(`\n${n} product(s) archived.`);
    return;
  }

  for (const spec of SEED) {
    const existing = await findBySeedId(spec.seed_id);
    const body = {
      name: spec.name,
      description: spec.description,
      metadata: { ...spec.metadata, seed_id: spec.seed_id },
      active: true,
    };

    if (dry) {
      console.log(`${existing ? 'would update' : 'would create'}  ${spec.name}  ${spec.prices.map((p) => `£${(p.amount / 100).toFixed(2)}`).join(' / ')}`);
      continue;
    }

    const product = existing
      ? await stripe.products.update(existing.id, body)
      : await stripe.products.create(body);

    // Prices are immutable in Stripe, so reconcile by amount: keep the ones that
    // already match, create what is missing, archive what is no longer wanted.
    const wanted = new Map(spec.prices.map((p) => [p.amount, p]));
    for await (const price of stripe.prices.list({ product: product.id, limit: 100, active: true })) {
      const want = wanted.get(price.unit_amount);
      if (want && price.currency === 'gbp' && price.type === 'one_time') {
        await stripe.prices.update(price.id, {
          metadata: { ...(want.label ? { variant_label: want.label } : {}), ...(want.sort ? { sort: want.sort } : {}) },
        });
        wanted.delete(price.unit_amount);
      } else {
        await stripe.prices.update(price.id, { active: false });
      }
    }
    for (const [amount, want] of wanted) {
      await stripe.prices.create({
        product: product.id,
        currency: 'gbp',
        unit_amount: amount,
        metadata: { ...(want.label ? { variant_label: want.label } : {}), ...(want.sort ? { sort: want.sort } : {}) },
      });
    }

    console.log(`${existing ? 'updated' : 'created'}  ${product.name}  (${product.id})`);
  }

  console.log('\nDone. Run `npm run build` to pull them onto the site.');
}

run().catch((err) => {
  console.error('\nFailed:', err?.message ?? err);
  process.exit(1);
});
