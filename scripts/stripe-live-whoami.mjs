// Sanity check for the restricted LIVE key used to edit the live catalogue:
//
//   node scripts/stripe-live-whoami.mjs
//
// Prints which Stripe account STRIPE_LIVE_SECRET_KEY reaches and lists the
// active products there. Read-only. Refuses test/sandbox keys so nobody
// mistakes the sandbox catalogue for the live one again.

import Stripe from 'stripe';
import { loadEnv } from '../src/lib/load-env.mjs';

loadEnv();
const key = process.env.STRIPE_LIVE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_LIVE_SECRET_KEY is not set. See .env.example for how to create one.');
  process.exit(1);
}
if (!/^[a-z]{2}_live_/.test(key)) {
  console.error('That is not a live key (expected rk_live_... or sk_live_...).');
  process.exit(1);
}

const stripe = new Stripe(key, { maxNetworkRetries: 3 });
// A restricted key without Accounts: Read cannot call /v1/account, but Stripe's
// permission error still names the account it belongs to — good enough here.
try {
  const acct = await stripe.accounts.retrieve();
  console.log(`Account: ${acct.id} — ${acct.settings?.dashboard?.display_name ?? '(no display name)'}`);
} catch (e) {
  const id = String(e.message).match(/acct_[A-Za-z0-9]+/)?.[0];
  if (!id) throw e;
  console.log(`Account: ${id} (restricted key; name not readable)`);
}
const products = await stripe.products.list({ limit: 100, active: true });
console.log(`${products.data.length} active product(s):`);
for (const p of products.data) console.log(`  ${p.id}  ${p.name}`);
