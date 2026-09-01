# Swizee 3D Studio

The shop at [swizee.co.uk](https://swizee.co.uk). Astro (static) on Cloudflare
Pages, with Stripe Checkout for payments and Stripe as the product catalogue.

- **Adding a product or changing some words?** → [HOWTO.md](HOWTO.md)
- **Setting up hosting, Stripe or the domain?** → [SETUP.md](SETUP.md)
- **Working on the code?** → you are in the right place.

---

## How it fits together

```
Stripe Dashboard ──(build-time fetch)──> Astro build ──> Cloudflare Pages
      ▲                                                          │
      │                                                   basket in the browser
      │                                                          │
      └──── Checkout Session <──────── functions/api/checkout.js
```

Product edits in Stripe fire a webhook at `functions/api/stripe-rebuild.js`,
which records that a rebuild is due in KV. A scheduled worker
(`workers/rebuild-drain.js`) spends one deploy once edits have been quiet for
three minutes — see **Deploy budget** below.

- **No product data is hard-coded.** Everything on the shop and product pages
  comes from the Stripe API at build time (`src/lib/catalogue.mjs`).
- **No card data touches this site.** Payment happens on Stripe's own page.
- **The basket lives in the visitor's browser** (`localStorage`) and stores only
  `{ priceId, text, qty }`. Names and prices are looked up from a build-time
  snapshot baked into `/cart`, so a stale basket can never show a wrong price.
- **Every basket line is revalidated server side** before a Checkout Session is
  created. The browser is never trusted about price, product or amount.

## Local development

```bash
npm install
npm run dev
```

Without `STRIPE_SECRET_KEY` the build uses the sample catalogue in
`src/lib/fixtures.mjs` so you can work on the site with no Stripe account. A
hosted build refuses to start without the key, so placeholder
products can never reach the live site.

To work against real Stripe test data:

```bash
cp .env.example .env    # then paste your sk_test_... key
npm run dev
```

Pages Functions do not run under `astro dev`. To exercise checkout locally:

```bash
npm run build && npx wrangler pages dev dist
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Placeholder check, then a production build into `dist/` |
| `npm test` | Unit tests for catalogue normalisation and input validation |
| `npm run check` | TypeScript / Astro diagnostics |
| `npm run check:placeholders` | Lists unreviewed `[[REPLACE: ...]]` legal wording |

## Design

The look comes from the Claude Design project `Swizee Design.dc.html` and its
`design_handoff_swizee/README.md`. That handoff is the authority; this codebase
recreates it in Astro rather than copying its markup, which is what the handoff
asks for.

- **Tokens** live in `src/styles/tokens.css`, copied verbatim from the design's
  `:root` block. Nothing else in the repo holds a raw hex value.
- **Fonts** are Anton (display, always uppercase) and Nunito (body), from Google
  Fonts.
- **One breakpoint**, 900px, between the mobile and desktop layouts. Product
  grids flex 2 -> 3 -> 4 columns in between.
- The shop deliberately has **no filters and no search**, per the handoff.
- Photo **placeholders** (the diagonal-striped blocks) appear only where a
  product has no photo in Stripe. The handoff is explicit that these must not
  ship — upload real photos to Stripe before go-live.

### Generated illustrations

Three decorative images were generated (Nano Banana) and composited locally:

| File | Where | Notes |
|---|---|---|
| `public/og-image.jpg` | Social share card | Illustration generated; the type is real Anton/Nunito composited over it in a browser, not drawn by the model |
| `public/images/lost-lizard.png` | 404 page | Cream background keyed to transparent so it sits on any surface |
| `public/images/empty-basket.png` | Empty basket state | Same treatment |

**No product photography is generated, and none should be.** Every image on a
shop or product page is a promise about what arrives in the bag — those come
from real photos in Stripe. The same goes for the "maker photo" on the home
page's Our Story tile: that needs a real photograph, not a generated person.

Still needed from the client: axolotl, name sign, bag tag, rainbow slider,
pencil topper, flexi dragon and maker photos, plus the "how it's made" video.

## DNS and email

DNS is on Cloudflare. `swizee.co.uk` has no mailbox, but IONOS's mail records
(MX, SPF, DMARC, autodiscover) came across with the zone and are left in place.

**The two DKIM records were deliberately not migrated**:
`s1-ionos._domainkey -> s1.dkim.ionos.com` and `s2-ionos._domainkey ->
s2.dkim.ionos.com`. They were in the IONOS zone but Cloudflare's scan could not
find them — DKIM selector names are not discoverable, you have to know them.
With no mailbox they do nothing, so recreating them was not worth the effort.

**If anyone ever sets up email on this domain**, add those two CNAMEs back as
*DNS only* (grey cloud) or outgoing mail will fail DKIM and tend to land in
spam. That failure is silent and shows up weeks later, so it is worth knowing
about in advance.

## Delivery and collection

UK only. Both options are offered at Stripe Checkout as shipping rates:

| Option | Price | Quoted time |
|---|---|---|
| Collect from Great Sankey, Warrington | free | up to 7 working days |
| UK delivery (Royal Mail 2nd Class) | £3.50, free over £20 | 7 days to make, then 2–3 in the post |

Every number lives in `src/lib/shipping.mjs`. The site's copy and the checkout
function both read from it, so changing the price is a one-line edit and the two
cannot disagree. The free-delivery threshold is worked out server-side from
Stripe's own prices, never from anything the browser sent.

Stripe will not show shipping options without an address, so collection
customers are asked for one too. `custom_text.shipping_address` explains why.

> This replaced the original brief's "collection only, no delivery". The Claude
> Design handoff still says nothing may imply delivery — that instruction is
> superseded, and the footer copy has changed accordingly.

## Stripe metadata conventions

Set these in the Stripe Dashboard on the **Product** (Product → Edit → Metadata).
Anything not listed is ignored. Values are case-insensitive; a flag counts as on
only when it is exactly `true`.

| Key | Example | What it does |
|---|---|---|
| `personalise` | `true` | Shows the "type a name" box on the product page and requires it at checkout |
| `personalise_label` | `Name to print` | Label above that box. Defaults to "Name or word to print" |
| `category` | `name-items` | Groups the product under a filter chip on `/shop`. New values create new chips automatically |
| `featured` | `true` | Shows the product in "Popular right now" on the home page |
| `sort` | `10` | Lower numbers come first. Products without it go last, alphabetically |
| `hidden` | `true` | Keeps the product out of the site without archiving it in Stripe |
| `slug` | `axolotl` | Fixes the URL at `/products/axolotl`. Without it the URL comes from the product name — **set this before sharing a link, or renaming the product will break it** |
| `image` | `/images/axolotl.jpg` | Uses a photo from `public/` instead of the Stripe photo |

On the **Price** (for products with more than one option):

| Key | Example | What it does |
|---|---|---|
| `variant_label` | `4 letters` | The text in the option selector. Falls back to the price nickname, then to the amount |
| `max_chars` | `4` | Letters allowed in the personalisation box for this option. If unset, it is read from `variant_label` — "4 letters" gives 4, "8 to 10 letters" gives 10. Enforced in the browser **and** on the server |
| `sort` | `1` | Order of the options. Otherwise cheapest first |

**A product only appears on the site if** it is Active, not `hidden`, and has at
least one active **one-off GBP** price. Recurring and non-GBP prices are ignored
rather than guessed at.

## Reading orders

Personalisation text is written into **session metadata and payment metadata**,
one key per personalised line:

```
item_1              Name Plate (5 to 7 letters) ×2: JAKE
item_2              Personalised Keyring: EVIE
personalised_items  2
```

Open the payment in the Stripe Dashboard → **Metadata** panel. No extra tooling.

Stripe Checkout's `custom_fields` were not used: they are per-session and capped
at three, which does not work for a multi-item basket.

> If the family finds the Metadata panel awkward in practice, the fallback in the
> brief is a Stripe webhook that emails an order summary. The webhook plumbing in
> `functions/api/stripe-rebuild.js` is the pattern to copy.

## Environment variables

See [.env.example](.env.example). On Cloudflare: **Pages project → Settings → Variables and secrets**
(<https://dash.cloudflare.com/?to=/:account/pages/view/website/settings>).

| Variable | Needed for |
|---|---|
| `STRIPE_SECRET_KEY` | Everything. Build-time catalogue and checkout |
| `DEPLOY_HOOK_URL` | Set as a **worker secret**, not a Pages variable. Lets the drain worker trigger a build |
| `STRIPE_WEBHOOK_SECRET` | Verifying those Stripe webhook calls |
| `COLLECT_PHONE` | Set to `false` to stop asking for a phone number at checkout. On by default, and required once on — Stripe has no optional setting |
| `PUBLIC_WEB3FORMS_KEY` | Optional. Overrides the committed contact-form key |
| `ALLOW_SAMPLE_CATALOGUE` | Temporary. Lets a production build ship the sample catalogue while there is no Stripe key yet. **Delete this before go-live** |

## Automatic rebuilds

Product edits in Stripe go live via a rebuild. Preferred setup:

1. Cloudflare → Pages project → **Settings** → scroll to **Deploy Hooks** → the
   small **`+`** at the right of that row. Name it `stripe-product-change`,
   branch `main`. Copy the URL.
2. Stripe → Developers → **Webhooks** → Add endpoint:
   `https://swizee.co.uk/api/stripe-rebuild`
3. Select events: `product.created`, `product.updated`, `product.deleted`,
   `price.created`, `price.updated`, `price.deleted`.
4. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` (Pages
   variable), and the deploy hook URL into the worker:
   `npx wrangler secret put DEPLOY_HOOK_URL --config workers/wrangler.toml`

Other event types are acknowledged and ignored, so they do not burn build
minutes. Cloudflare's free tier allows 500 builds a month, and the debounce
below keeps a burst of edits to one.

Fallback if the webhook is not wanted: the deploy hook URL can be bookmarked and
opened to trigger a rebuild by hand. See HOWTO.md.

## Deploy budget

This matters more than it sounds. **Netlify's free plan allows 20 production
deploys a month, and small frequent pushes exhausted a whole month in an
afternoon**, which is why the site moved to Cloudflare Pages (500 builds/month).

The webhook therefore does **not** deploy on every Stripe edit. It records that a
rebuild is due; `workers/rebuild-drain.js` runs every two minutes and spends one
deploy once edits have been quiet for three. Fifteen product edits cost one
build, not fifteen.

It is a *trailing* debounce on purpose. A leading throttle would build on the
first edit and drop the rest, so the family would watch one product appear and
the others not. `tests/rebuild.test.mjs` covers that case explicitly.

## Deploying

Cloudflare Pages builds and deploys on every push to `main`. `public/_redirects`
holds the `www` → apex redirect and `public/_headers` the security headers;
`wrangler.toml` sets `nodejs_compat`, which the Stripe SDK needs.

The rebuild worker is deployed separately:

```bash
npx wrangler deploy --config workers/wrangler.toml
```

## Go-live checklist

- [ ] Paul has reviewed and replaced the `[[REPLACE: ...]]` wording in
      `src/content/copy/terms.md` and `privacy.md`, and deleted the DRAFT notes
- [ ] Logo assets checked against the Claude Design export (`public/logo.png`, `favicon.png`, `apple-touch-icon.png` are the supplied circle mark)
- [ ] Real product photos uploaded in Stripe
- [ ] `swizee.co.uk` and `www` active on Cloudflare Pages, HTTPS live
- [ ] Stripe email receipts turned on (Stripe → Settings → Customer emails)
- [ ] Stripe branding and public business name set (shown on the Checkout page)
- [ ] Contact form delivering (Web3Forms) — send a test message
- [ ] `STRIPE_SECRET_KEY` swapped to the live key, site rebuilt
- [ ] One real £1 purchase, checked in the Dashboard, then refunded

## Project layout

```
src/lib/catalogue.mjs   Stripe -> site data. The only place product shape is decided
src/lib/cart.mjs        Browser basket
src/lib/validation.mjs  Personalisation + quantity rules, shared by browser AND server
src/content/copy/       Site text as markdown, edited on GitHub by the family
src/styles/tokens.css   Every colour, font and spacing value, verbatim from the design handoff
functions/api/          Cloudflare Pages Functions (thin wrappers)
workers/                Scheduled worker that debounces rebuilds
tests/                  node --test, no framework
```
