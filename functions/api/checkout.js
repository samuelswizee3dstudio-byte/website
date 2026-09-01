// Cloudflare Pages Function -> POST /api/checkout
// All the logic lives in src/lib/checkout-core.mjs, shared with the Netlify
// build, so the validation rules cannot drift between hosts.

import { handleCheckout } from '../../src/lib/checkout-core.mjs';

export const onRequestPost = ({ request, env }) => handleCheckout(request, env);

export const onRequest = ({ request, env }) =>
  request.method === 'POST'
    ? handleCheckout(request, env)
    : new Response(JSON.stringify({ message: 'Method not allowed.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
