// Astro/Vite only exposes VITE_-prefixed variables to application code, so a
// plain STRIPE_SECRET_KEY in .env never reaches process.env during `astro dev`.
// Without this, local development silently falls back to the sample catalogue
// even when a real key is sitting in .env — which looks like the key not
// working rather than not being read.
//
// No-ops on Cloudflare Pages and in CI, where there is no .env file and the
// real environment is already populated.

import { readFileSync } from 'node:fs';

let loaded = false;

export function loadEnv() {
  if (loaded) return;
  loaded = true;
  try {
    const text = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      // Never override a real environment variable with a local file.
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env — expected on Cloudflare Pages and in CI.
  }
}
