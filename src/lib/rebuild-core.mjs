// Stripe calls this when a product or price changes; it pings the host's deploy
// hook so the site rebuilds itself. That is what lets the family add a product
// in the Stripe Dashboard and see it appear on the site without touching code.
//
// Set up in README.md > "Automatic rebuilds". If the webhook is not configured
// this endpoint simply refuses everything, which is safe.
//
// Deploys are metered. Every product edit costs one, so this endpoint is the
// main consumer of the hosting budget — see README > "Deploy budget".

import Stripe from 'stripe';

const REBUILD_EVENTS = new Set([
  'product.created', 'product.updated', 'product.deleted',
  'price.created', 'price.updated', 'price.deleted',
]);

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Host-agnostic rebuild webhook. `env` is Cloudflare's binding object or
 * process.env, depending on who is hosting.
 * @param {Request} request
 * @param {Record<string, string|undefined>} env
 */
export async function handleRebuild(request, env) {
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' });

  const signingSecret = env.STRIPE_WEBHOOK_SECRET;
  const buildHook = env.DEPLOY_HOOK_URL || env.NETLIFY_BUILD_HOOK_URL;
  if (!signingSecret || !buildHook) {
    console.error('Rebuild webhook is not configured (STRIPE_WEBHOOK_SECRET / DEPLOY_HOOK_URL).');
    return json(500, { message: 'Not configured.' });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return json(400, { message: 'Missing signature.' });

  // Signature verification needs the exact bytes Stripe sent, so read the raw
  // body — not request.json().
  const payload = await request.text();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_unused', { maxNetworkRetries: 1 });

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, signingSecret);
  } catch (err) {
    console.error('Stripe webhook signature check failed:', err?.message);
    return json(400, { message: 'Invalid signature.' });
  }

  if (!REBUILD_EVENTS.has(event.type)) {
    // Acknowledge so Stripe stops retrying, but do not spend a build minute.
    return json(200, { ignored: event.type });
  }

  const res = await fetch(buildHook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger_title: `Stripe: ${event.type}` }),
  });

  if (!res.ok) {
    console.error('Netlify build hook returned', res.status);
    return json(502, { message: 'Build hook failed.' });
  }

  console.log(`Rebuild triggered by ${event.type}`);
  return json(200, { rebuilding: true, event: event.type });
}
