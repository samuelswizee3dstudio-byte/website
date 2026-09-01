// Cloudflare Pages Function -> POST /api/checkout
// All the logic lives in src/lib/checkout-core.mjs so it can be unit tested
// without a host, and so a future hosting move does not touch it.

import { handleCheckout } from '../../src/lib/checkout-core.mjs';

export const onRequestPost = ({ request, env }) => handleCheckout(request, env);

export const onRequest = ({ request, env }) =>
  request.method === 'POST'
    ? handleCheckout(request, env)
    : new Response(JSON.stringify({ message: 'Method not allowed.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
