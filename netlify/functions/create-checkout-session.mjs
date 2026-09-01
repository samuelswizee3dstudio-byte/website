// Netlify wrapper. The logic is in src/lib/checkout-core.mjs, shared with the
// Cloudflare Pages Function at functions/api/checkout.js.

import { handleCheckout } from '../../src/lib/checkout-core.mjs';

export default (request) => handleCheckout(request, process.env);

export const config = { path: '/api/checkout' };
