// Scheduled worker: spends a deploy only once product edits have gone quiet.
//
// The Pages Function at functions/api/stripe-rebuild.js records that a rebuild
// is due; this drains it. Split in two because Cloudflare Pages cannot run on a
// schedule, only Workers can.
//
// Deploy:  npx wrangler deploy --config workers/wrangler.toml
// Needs:   KV namespace REBUILD_STATE (same one the Pages project binds)
//          secret DEPLOY_HOOK_URL

import { drainPendingRebuild } from '../src/lib/rebuild-core.mjs';

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      drainPendingRebuild(env).then((r) => console.log('drain:', JSON.stringify(r))),
    );
  },

  // Same logic on demand, so the family's "rebuild the site" bookmark and any
  // manual check hit exactly the code the schedule runs.
  async fetch(_request, env) {
    const result = await drainPendingRebuild(env);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
