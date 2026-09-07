# Setup: what is done, and what is left

Live at **https://swizee.co.uk**. Technical reference is in [README.md](README.md);
the family's guide is [HOWTO.md](HOWTO.md), and the printed handover for Rebecca
is `HANDOVER.pdf`, built from `handover/` and deliberately not committed (personal details, public repo).

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
| Rebuild | Stripe webhook -> KV -> scheduled worker -> deploy hook, live account (6 Sept 2026) |
| Catalogue | Live Stripe catalogue with real photos and prices; site builds from the live key |
| Legal pages | Terms and privacy reviewed, no placeholders left |
| Go-live | Live key in Cloudflare; £2.50 test purchase made and refunded 1 Sept 2026 |

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

## Who owns what

Every service is registered to **samuel.swizee.3d.studio@gmail.com**, except the
domain, which Paul registered and pays for.

| Service | Owner | Rebecca hands-on? |
|---|---|---|
| Stripe live `acct_1UAnyN2WfwtXYi2f` | Rebecca (account owner) | Yes — daily |
| Google account | Family | Yes — it owns everything below |
| Instagram `@swizee3dstudio` | Family | Yes |
| YouTube | Family, same Gmail | Yes — videos embed on the About page |
| GitHub `samuelswizee3dstudio-byte/website` | Family; Paul collaborator | Only for wording changes |
| Cloudflare (Pages, DNS, KV, worker) | Family | No |
| IONOS (domain registration only) | **Paul** — renews August 2027 | No, but see below |
| Web3Forms (contact form relay) | Family | No |

Paul does not hold a Stripe team seat; he signs in as Rebecca when asked to.

**Domain renewal.** Paul's card pays IONOS. Before August 2027 either move the
registration to Rebecca (IONOS -> Domains -> transfer of ownership) or make sure
Paul renews it. A lapsed domain takes the shop and the contact form down.

---

## Handover checklist

Do these when the handover is complete, not before.

- [ ] Give Rebecca `HANDOVER.pdf` and the Gmail password
      **in person, not in the PDF**. Check the Google recovery phone is hers:
      <https://myaccount.google.com/security>
- [ ] Revoke the Stripe restricted key "Claude catalogue edits":
      <https://dashboard.stripe.com/apikeys> (live account, not sandbox)
- [ ] Revoke `CLOUDFLARE_API_TOKEN`:
      <https://dash.cloudflare.com/profile/api-tokens>
- [ ] Delete the Netlify project; its token expired 8 September 2026 regardless:
      <https://app.netlify.com/user/applications>
- [ ] Remove `pdrutter-alt` from the GitHub repo. Paul's main account stays as a
      collaborator: <https://github.com/samuelswizee3dstudio-byte/website/settings/access>
- [ ] `.env` holds credentials. It is gitignored and `chmod 600`; do not copy it.
      Delete the revoked keys from it.
- [ ] Put the domain renewal (August 2027) in Paul's calendar.

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
