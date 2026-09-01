// Netlify wrapper. Logic in src/lib/rebuild-core.mjs.

import { handleRebuild } from '../../src/lib/rebuild-core.mjs';

export default (request) => handleRebuild(request, process.env);

export const config = { path: '/api/stripe-rebuild' };
