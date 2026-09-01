// Cloudflare Pages Function -> POST /api/stripe-rebuild
// Stripe calls this; it verifies the signature and pings the deploy hook.

import { handleRebuild } from '../../src/lib/rebuild-core.mjs';

export const onRequest = ({ request, env }) => handleRebuild(request, env);
