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

  // --- Debounce -----------------------------------------------------------
  // Deploys are metered, and editing fifteen products fires fifteen events. If
  // a KV namespace is bound we only record that a rebuild is due; a scheduled
  // worker drains it once edits have stopped, so a burst costs one deploy.
  //
  // This has to be a TRAILING debounce. A leading throttle would build on the
  // first edit and silently drop the next fourteen, so the family would watch
  // one product appear and the rest not.
  if (env.REBUILD_STATE) {
    await env.REBUILD_STATE.put(
      PENDING_KEY,
      JSON.stringify({ at: Date.now(), reason: event.type }),
    );
    console.log(`Rebuild queued by ${event.type}`);
    return json(200, { queued: true, event: event.type });
  }

  // No KV bound (e.g. the Netlify deploy): fall back to building immediately.
  return triggerDeploy(buildHook, `Stripe: ${event.type}`);
}

export const PENDING_KEY = 'rebuild:pending';

/** How long edits must be quiet before we spend a deploy on them. */
export const QUIET_PERIOD_MS = 3 * 60 * 1000;

/** @param {string} hookUrl @param {string} title */
export async function triggerDeploy(hookUrl, title) {
  const res = await fetch(hookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger_title: title }),
  });
  if (!res.ok) {
    console.error('Deploy hook returned', res.status);
    return json(502, { message: 'Deploy hook failed.' });
  }
  console.log(`Deploy triggered: ${title}`);
  return json(200, { rebuilding: true });
}

/**
 * Drain the pending flag if edits have gone quiet. Called on a schedule.
 * @param {{ REBUILD_STATE?: any, DEPLOY_HOOK_URL?: string }} env
 * @param {number} now injectable so the behaviour can be tested
 */
export async function drainPendingRebuild(env, now = Date.now()) {
  if (!env.REBUILD_STATE || !env.DEPLOY_HOOK_URL) return { skipped: 'not configured' };

  const raw = await env.REBUILD_STATE.get(PENDING_KEY);
  if (!raw) return { skipped: 'nothing pending' };

  let pending;
  try {
    pending = JSON.parse(raw);
  } catch {
    await env.REBUILD_STATE.delete(PENDING_KEY);
    return { skipped: 'unreadable, cleared' };
  }

  const quietFor = now - Number(pending.at ?? 0);
  if (quietFor < QUIET_PERIOD_MS) {
    return { waiting: true, quietForMs: quietFor };
  }

  // Clear before triggering. If the deploy hook fails we would rather miss a
  // rebuild than loop on a stuck flag; the next edit or the manual rebuild
  // link recovers it.
  await env.REBUILD_STATE.delete(PENDING_KEY);
  await triggerDeploy(env.DEPLOY_HOOK_URL, `Stripe: ${pending.reason ?? 'changes'} (debounced)`);
  return { deployed: true, reason: pending.reason };
}
