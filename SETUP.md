# Setup: what is done, and what still needs you

Live at **https://swizee.co.uk**. Technical reference is in [README.md](README.md);
the family's guide is [HOWTO.md](HOWTO.md).

Every instruction below names the service and gives a full URL, because several
of these dashboards have similarly-named screens.

---

## Done

| | |
|---|---|
| GitHub | `samuelswizee3dstudio-byte/website`, public, deploys on push |
| Hosting | **Cloudflare Pages** project `website`, free plan |
| Domain | `swizee.co.uk` live over HTTPS on Cloudflare |
| DNS | Cloudflare nameservers; IONOS is registrar only |
| Contact form | Web3Forms — tested, delivers, honeypot rejects bots |
| Rebuild | Stripe webhook -> KV -> scheduled worker -> deploy hook |
| Catalogue | 5 products with real photos and prices |
| Legal pages | Terms and privacy reviewed, no placeholders left |

### Why the hosting moved

Netlify's free plan allows **20 production deploys a month**. Small, frequent
pushes during the build exhausted a month in an afternoon, and manual builds cost
the same. Cloudflare Pages allows 500. The debounce in
`workers/rebuild-drain.js` means a burst of product edits now costs one build
rather than fifteen — see **Deploy budget** in the README.

### Why DNS stayed off IONOS

`swizee.co.uk` carries IONOS mail records (MX, SPF, DMARC, autodiscover). Those
came across with the zone. Two DKIM records did not, because DKIM selector names
cannot be discovered by a DNS scan — see **DNS and email** in the README. There
is no mailbox on the domain, so nothing is broken; it only matters if someone
adds email later.

---

## Still needs you

### 1. Go live: swap to the live Stripe key

The site currently builds from the **sandbox** catalogue. Test and live are
separate catalogues in Stripe — a product photo added in one does not appear in
the other.

**In Stripe** — <https://dashboard.stripe.com/apikeys>

Check the top-left says **Swizee 3D studio**, not "Swizee 3D studio sandbox". If
there is a Sandbox banner, click the account name and choose **Exit sandbox**.

On the **Secret key** row click **More options** (`...`) -> **Rotate key**, and
copy the new key immediately. Stripe shows a secret key once and never again,
which is why there is no "reveal" option on an existing one.

**In Cloudflare** —
<https://dash.cloudflare.com/?to=/:account/pages/view/website/settings>

Scroll to **Variables and secrets**, click the pencil on the
`STRIPE_SECRET_KEY` row, paste the new key, Save.

Then the **Deployments** tab -> `...` on the newest deployment -> **Retry
deployment**. Environment variables only apply to new builds.

You will know it worked when the purple "Test mode" banner disappears.

### 2. One real purchase

Buy something for a pound, check it reads correctly in
<https://dashboard.stripe.com/payments> — including the personalisation in the
**Metadata** panel — then refund it.

### 3. Cleanup

- Delete the Netlify project — it is unused and out of deploy credits.
- Revoke the Netlify API token (it expires 8 September regardless):
  <https://app.netlify.com/user/applications>
- Remove `pdrutter-alt` as a collaborator on the GitHub repo at handover.
- Revoke `CLOUDFLARE_API_TOKEN` when this work is finished:
  <https://dash.cloudflare.com/profile/api-tokens>
- `.env` holds credentials. It is gitignored and `chmod 600`; do not copy it.

---

## If a build fails

**Cloudflare** -> Pages project -> **Deployments** -> click the failed one and
read the log.

| Message | Fix |
|---|---|
| `STRIPE_SECRET_KEY is not set` | Add it in Variables and secrets, or set `ALLOW_SAMPLE_CATALOGUE=true` temporarily |
| `Stripe returned no sellable products` | A warning, not a failure. Products need to be Active with an active one-off GBP price |

Environment variable changes need a fresh deploy: **Deployments** -> `...` ->
**Retry deployment**.
