# Setup: what is done, and what still needs you

Live at **https://swizee.co.uk**. This file tracks the remaining human steps.
Technical reference is in [README.md](README.md); the family's guide is
[HOWTO.md](HOWTO.md).

---

## Done

| | |
|---|---|
| GitHub | `samuelswizee3dstudio-byte/website`, public, deploys on push |
| Netlify | project `swizee`, free tier, public, building from GitHub |
| Domain | `swizee.co.uk` live over HTTPS, `www` redirects to the apex |
| DNS | A `@` → `75.2.60.5`, CNAME `www` → `swizee.netlify.app`, at IONOS |
| Contact form | detected, notifications emailing Paul, honeypot verified against a real spam submission |
| Build hook | "Stripe product change" |
| Stripe webhook | `product.*` and `price.*` → the build hook, so Dashboard edits go live on their own |
| Env vars | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NETLIFY_BUILD_HOOK_URL`, `ALLOW_PLACEHOLDERS` |
| Catalogue | 5 products in Stripe **test mode** with real photos and real prices |

### Why DNS stayed at IONOS

The original plan was to move nameservers to Netlify, which is Netlify's own
recommendation. `swizee.co.uk` turned out to carry a full IONOS mail setup —
MX, SPF, DMARC, autodiscover and **two DKIM records** (`s1-ionos._domainkey`,
`s2-ionos._domainkey`) whose selector names cannot be discovered from outside
the account. Recreating that by hand and missing one would have left mail
sending but failing authentication, which surfaces weeks later as spam
foldering. External DNS avoids the whole class of problem. Two records changed,
everything else untouched.

---

## Still needs you

### 1. Review the terms and privacy notice — blocks go-live

`src/content/copy/terms.md` and `privacy.md` are my drafts and still contain
`[[REPLACE: ...]]` markers. Search for that string and fill in:

- the seller's full name (the nephew's mother — she is the seller of record)
- a trading name, if different
- how long you keep uncollected orders (I suggested 30 days)
- how long Netlify keeps contact form submissions (I suggested 90 days)
- the "last updated" dates

Then delete the `> **DRAFT — for Paul's review.**` block at the top of each.

**Read them properly rather than skim.** Adding delivery changed the legal
position: the 14-day cooling-off period now runs from when the customer
*receives* the item, the seller carries the risk until the parcel arrives, and
return postage has to be apportioned. I have written that as plainly as I can,
but I am not a lawyer and this is a real business selling to the public.

Run `npm run check:placeholders` to see what is left.

### 2. Stripe business details — Dashboard only, no API

**Settings → Business → Public details**

- **Public business name**: `Swizee 3D Studio` — currently unset, so the payment
  page shows nothing. This is the single most visible gap.
- Support email and website.
- **Branding**: upload the logo and set the brand colour to `#EF6122`.

**Settings → Business → Customer emails** → turn on **Successful payments**.
Without this, buyers get no receipt.

### 3. An axolotl photo

`Mini Axolotl` is live at £1.50 with a striped placeholder. The only picture I
have is a frame from the promo video with a thumb across the corner. Any decent
square photo, uploaded to the product in Stripe, and it appears within a minute.

### 4. The rest of the catalogue

Five products are loaded. The brief says about fifteen. The family adds the rest
in Stripe following [HOWTO.md](HOWTO.md) — no code involved.

### 5. Go live

In this order:

1. Do steps 1 and 2 above.
2. Delete `ALLOW_PLACEHOLDERS` from Netlify env vars.
3. Recreate the products in **live** mode (test and live are separate catalogues).
4. Repeat step 2's Dashboard settings in live mode — they do not carry over.
5. Create a **live** webhook at `https://swizee.co.uk/api/stripe-rebuild` for the
   same six events, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
6. Swap `STRIPE_SECRET_KEY` to the live key. **Type it straight into Netlify** —
   it should never touch this machine or a chat window.
7. Trigger a deploy. The test-mode banner disappears on its own.
8. One real £1 purchase. Check it reads correctly in the Dashboard, then refund.

### 6. Housekeeping

- The Netlify personal access token in `.env` **expires 8 September 2026**. Revoke
  it sooner at Netlify → User settings → Applications if you would rather.
- Remove `pdrutter-alt` as a collaborator on the repo when the build is finished,
  so the family owns it outright.
- `.env` holds live-ish credentials. It is gitignored and `chmod 600`; do not
  copy it anywhere.

---

## If a build fails

**Deploys → the failed deploy → read the log.**

| Message | Fix |
|---|---|
| `STRIPE_SECRET_KEY is not set` | Add it, or set `ALLOW_SAMPLE_CATALOGUE=true` temporarily |
| `BUILD BLOCKED — draft wording still contains placeholders` | Step 1 above |
| `Stripe returned no sellable products` | A warning, not a failure. Products need to be Active with an active one-off GBP price |

Environment variable changes need a fresh deploy: **Deploys → Trigger deploy**.
