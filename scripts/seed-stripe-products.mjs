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
import { readFileSync, existsSync } from 'node:fs';

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
// Modelled on the real product lines, with the family's own photos. Prices are
// indicative except the two the design handoff confirms (Name Clicker Keyring
// from £3.50, Infinity Cube £5.00) — the family sets the rest in the Dashboard.
// Photos are uploaded to Stripe from PHOTO_DIR so the family can swap them there.
const SEED = [
  {
    seed_id: 'name-keyring',
    name: 'Name Clicker Keyring',
    description: 'Chunky letter tiles that click as you flip them. Clips onto a bag or a set of keys. Printed one letter at a time.',
    metadata: { category: 'name-items', personalise: 'true', personalise_label: 'Name to print', featured: 'true', sort: '10', slug: 'name-clicker-keyring' },
    photos: ['jacob-samuel-name-clickers.jpg'],
    // Prices read off the handwritten signs in the family's own promo video:
    // 50p per letter from a three-letter minimum.
    prices: [
      { amount: 350, label: '3 letters', sort: '1', maxChars: '3' },
      { amount: 400, label: '4 letters', sort: '2', maxChars: '4' },
      { amount: 450, label: '5 letters', sort: '3', maxChars: '5' },
      { amount: 500, label: '6 letters', sort: '4', maxChars: '6' },
      { amount: 550, label: '7 letters', sort: '5', maxChars: '7' },
      { amount: 600, label: '8 letters', sort: '6', maxChars: '8' },
    ],
  },
  {
    seed_id: 'axolotl',
    name: 'Mini Axolotl',
    description: 'A tiny articulated axolotl that wiggles from nose to tail. Fits in a pocket. Printed in one piece.',
    // No photo yet — the only picture is a video frame with a thumb in it.
    metadata: { category: 'flexis', featured: 'true', sort: '15', slug: 'mini-axolotl' },
    prices: [{ amount: 150 }],
  },
  {
    seed_id: 'infinity-cube',
    name: 'Infinity Cube',
    description: 'Folds over and over, forever. Quiet enough for the back of the classroom and small enough for a pocket.',
    metadata: { category: 'fidgets', featured: 'true', sort: '20', slug: 'infinity-cube' },
    photos: ['infinity-cubes.jpg', 'infinity-cubes-at-the-beach.jpg'],
    // £2.50, confirmed by Paul against the stall sign in the promo video. The
    // design handoff's "from £5.00" was out of date.
    prices: [{ amount: 250 }],
  },
  {
    seed_id: 'flexi-lizard',
    name: 'Flexi Lizard',
    description: 'An articulated lizard that wriggles along your hand. Printed in one piece — no glue, no batteries, no assembly.',
    metadata: { category: 'flexis', sort: '30', slug: 'flexi-lizard' },
    photos: ['lizard.jpg', 'lizard-in-hands.jpg'],
    prices: [{ amount: 800 }],
  },
  {
    seed_id: 'name-block',
    name: 'Name Block',
    description: 'Your name printed big and bold, standing up on a shelf or a desk.',
    metadata: { category: 'name-items', personalise: 'true', personalise_label: 'Name to print', sort: '40', slug: 'name-block' },
    photos: ['name-block-swizee.jpg'],
    prices: [
      { amount: 600, label: 'Up to 4 letters', sort: '1', maxChars: '4' },
      { amount: 800, label: '5 to 7 letters', sort: '2', maxChars: '7' },
      { amount: 1000, label: '8 to 10 letters', sort: '3', maxChars: '10' },
    ],
  },
];

// Every metadata key this project understands — see README. Listed so a re-seed
// can clear stale values rather than leaving them merged in.
const KNOWN_METADATA_KEYS = [
  'category', 'personalise', 'personalise_label', 'featured', 'sort',
  'hidden', 'slug', 'image',
];

const PHOTO_DIR = process.env.PHOTO_DIR
  || `${process.env.HOME}/Desktop/swizee-for-stripe`;

/**
 * Upload a local photo to Stripe and return a public URL for it. Stripe's
 * `images` field takes URLs, not uploads, so every file needs a file link.
 * Cached per run so re-seeding does not re-upload the same picture.
 */
const uploadedPhotos = new Map();
async function photoUrl(filename) {
  if (uploadedPhotos.has(filename)) return uploadedPhotos.get(filename);
  const path = `${PHOTO_DIR}/${filename}`;
  if (!existsSync(path)) {
    console.warn(`  ! photo not found, skipping: ${path}`);
    return null;
  }
  const file = await stripe.files.create({
    purpose: 'product_image',
    file: { data: readFileSync(path), name: filename, type: 'image/jpeg' },
  });
  const link = await stripe.fileLinks.create({ file: file.id });
  uploadedPhotos.set(filename, link.url);
  return link.url;
}

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
    const images = [];
    for (const photo of spec.photos ?? []) {
      const url = dry ? null : await photoUrl(photo);
      if (url) images.push(url);
    }

    const body = {
      name: spec.name,
      description: spec.description,
      // Stripe MERGES metadata on update, so a key this seed no longer sets would
      // survive from a previous run and quietly keep winning. Blank every key we
      // know about, then apply the ones we actually want.
      metadata: { ...Object.fromEntries(KNOWN_METADATA_KEYS.map((k) => [k, ''])), ...spec.metadata, seed_id: spec.seed_id },
      active: true,
      ...(images.length ? { images } : {}),
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
          metadata: { ...(want.label ? { variant_label: want.label } : {}), ...(want.sort ? { sort: want.sort } : {}), ...(want.maxChars ? { max_chars: want.maxChars } : {}) },
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
        metadata: { ...(want.label ? { variant_label: want.label } : {}), ...(want.sort ? { sort: want.sort } : {}), ...(want.maxChars ? { max_chars: want.maxChars } : {}) },
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
