# Swizee 3D Studio

The shop at [swizee.co.uk](https://swizee.co.uk). Astro (static) on Netlify, with
Stripe Checkout for payments and Stripe as the product catalogue.

- **Adding a product or changing some words?** → [HOWTO.md](HOWTO.md)
- **Setting up Netlify, Stripe or the domain?** → [SETUP.md](SETUP.md)
- **Working on the code?** → you are in the right place.

---

## How it fits together

```
Stripe Dashboard ──(build-time fetch)──> Astro build ──> static site on Netlify
      ▲                                                          │
      │                                                   basket in the browser
      │                                                          │
      └──── Checkout Session <── netlify/functions/create-checkout-session.mjs
```

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
Netlify **production** build refuses to start without the key, so placeholder
products can never reach the live site.

To work against real Stripe test data:

```bash
cp .env.example .env    # then paste your sk_test_... key
npm run dev
```

Netlify Functions do not run under `astro dev`. To exercise checkout locally:

```bash
npx netlify dev
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Placeholder check, then a production build into `dist/` |
| `npm test` | Unit tests for catalogue normalisation and input validation |
| `npm run check` | TypeScript / Astro diagnostics |
| `npm run check:placeholders` | Lists unreviewed `[[REPLACE: ...]]` legal wording |

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
| `variant_label` | `Up to 4 letters` | The text in the option selector. Falls back to the price nickname, then to the amount |
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
> `netlify/functions/stripe-rebuild.mjs` is the pattern to copy.

## Environment variables

See [.env.example](.env.example). On Netlify: **Site configuration → Environment
variables**.

| Variable | Needed for |
|---|---|
| `STRIPE_SECRET_KEY` | Everything. Build-time catalogue and checkout |
| `NETLIFY_BUILD_HOOK_URL` | Automatic rebuilds when Stripe changes |
| `STRIPE_WEBHOOK_SECRET` | Verifying those Stripe webhook calls |
| `COLLECT_PHONE` | Set to `false` to stop asking for a phone number at checkout. On by default, and required once on — Stripe has no optional setting |
| `ALLOW_PLACEHOLDERS` | Temporary. Lets a production build succeed while the legal wording is still a draft. **Delete this before go-live** |
| `ALLOW_SAMPLE_CATALOGUE` | Temporary. Lets a production build ship the sample catalogue while there is no Stripe key yet. **Delete this before go-live** |

## Automatic rebuilds

Product edits in Stripe go live via a rebuild. Preferred setup:

1. Netlify → Site configuration → Build & deploy → **Build hooks** → Add build
   hook. Copy the URL into `NETLIFY_BUILD_HOOK_URL`.
2. Stripe → Developers → **Webhooks** → Add endpoint:
   `https://swizee.co.uk/api/stripe-rebuild`
3. Select events: `product.created`, `product.updated`, `product.deleted`,
   `price.created`, `price.updated`, `price.deleted`.
4. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

Other event types are acknowledged and ignored, so they do not burn build
minutes. A build takes well under a minute; Netlify's free tier includes 300
build minutes a month, which is hundreds of product edits.

Fallback if the webhook is not wanted: the build hook URL can be bookmarked and
opened to trigger a rebuild by hand. See HOWTO.md.

## Deploying

Netlify builds and deploys on every push to `main`. `netlify.toml` holds the
build command, the `www` → apex redirect and the security headers.

## Go-live checklist

- [ ] Paul has reviewed and replaced the `[[REPLACE: ...]]` wording in
      `src/content/copy/terms.md` and `privacy.md`, and deleted the DRAFT notes
- [ ] `ALLOW_PLACEHOLDERS` deleted from Netlify
- [ ] Real logo at `public/logo.svg` and `public/favicon.svg`
- [ ] Real product photos uploaded in Stripe
- [ ] `swizee.co.uk` added in Netlify, DNS pointed at it from IONOS, HTTPS live,
      `www` redirecting
- [ ] Stripe email receipts turned on (Stripe → Settings → Customer emails)
- [ ] Stripe branding and public business name set (shown on the Checkout page)
- [ ] Netlify form notification for `contact` set to p.d.rutter@gmail.com
- [ ] `STRIPE_SECRET_KEY` swapped to the live key, site rebuilt
- [ ] One real £1 purchase, checked in the Dashboard, then refunded

## Project layout

```
src/lib/catalogue.mjs   Stripe -> site data. The only place product shape is decided
src/lib/cart.mjs        Browser basket
src/lib/validation.mjs  Personalisation + quantity rules, shared by browser AND server
src/content/copy/       Site text as markdown, edited on GitHub by the family
src/styles/tokens.css   Every colour, font and spacing value. Replace this to reskin
netlify/functions/      The only server-side code
tests/                  node --test, no framework
```
