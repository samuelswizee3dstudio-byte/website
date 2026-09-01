// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static output. The only server-side code is in netlify/functions/, deployed
// by Netlify directly — no Astro adapter needed.
export default defineConfig({
  site: 'https://swizee.co.uk',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/checkout/') }),
  ],
});
