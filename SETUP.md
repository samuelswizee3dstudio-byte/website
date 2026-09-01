# Setting up hosting, payments and the domain

One-time setup, for Paul. Work top to bottom — each part assumes the one above is
done. Roughly 45 minutes end to end, most of it waiting for DNS.

Everything the site needs is already in the repo. Nothing here requires editing
code.

---

## Part 0 — Hand me the Stripe key (2 min)

**Do not paste the key into the chat.** Put it in a file I can read but git
cannot commit. In a terminal:

```bash
cp .env.example .env && open -e .env
```

Replace `sk_test_replace_me` with your sandbox secret key from
**Stripe → Developers → API keys → Secret key**, save, close.

`.env` is in `.gitignore`, so it can never reach GitHub. Tell me when it is
saved and I will build the real catalogue and create the sample products.

> Stripe's Claude plugin (`/plugin install stripe@claude-plugins-official`) is
> optional. The site uses the official Stripe SDK directly and does not need it.

---

## Part 1 — Netlify account and first deploy (10 min)

### 1.1 Create the account

Go to [app.netlify.com/signup](https://app.netlify.com/signup) and sign up.
**Choose "Sign up with GitHub"** and authorise the Swizee GitHub account — that
way Netlify can see the repo without any extra steps.

Stay on the **Free** plan. Skip any team/upgrade prompts.

### 1.2 Import the site

1. **Add new project** → **Import an existing project** → **GitHub**.
2. Authorise Netlify if asked. If `swizee-site` is not in the list, click
   **Configure the Netlify app on GitHub** and give it access to that repo.
3. Pick `swizee-site`.
4. **Accept every default.** `netlify.toml` in the repo already sets:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Before clicking Deploy, open **Add environment variables** and add these two:

   | Key | Value |
   |---|---|
   | `ALLOW_SAMPLE_CATALOGUE` | `true` |
   | `ALLOW_PLACEHOLDERS` | `true` |

   These are **temporary**. They let the very first deploy succeed while there is
   no Stripe key and the legal wording is still a draft. Without them the build
   deliberately fails rather than shipping fake products or unreviewed terms.
   Part 5 removes them.

6. **Deploy**.

The build takes under a minute. You will get a URL like
`https://superb-marzipan-a1b2c3.netlify.app`. **Send it to me** — I need it for
the Stripe redirect settings.

### 1.3 Give the site a sensible name

**Project configuration → General → Project details → Change project name** →
`swizee`. The URL becomes `swizee.netlify.app`, which is easier to check on your
phone while we build.

### 1.4 Confirm deploy-on-push works

Make any trivial edit on GitHub (a typo fix in `src/content/copy/home.md` is
ideal) and commit it. Netlify should start a new build within seconds. That is
stage 1 of the brief done.

---

## Part 2 — Contact form notifications (3 min)

The contact form is already wired up in the code. Netlify needs telling to look
for it, and then telling where submissions go.

1. **Forms** (in the project's own left-hand nav, not the configuration
   sidebar) → **Enable form detection**. This is off by default and nothing
   works until it is on.
2. **Trigger a redeploy** — Deploys → Trigger deploy → Deploy site. Netlify only
   parses forms at build time, so the form is invisible until a build runs
   *after* detection is enabled.
3. **Project configuration → Notifications → Emails and webhooks**.
   (Netlify renamed "Site configuration" to **Project configuration** — it is the
   left-hand sidebar item once you have opened the project.)
4. Under **Form submission notifications**, click **Add notification** →
   **Email notification**.

   > If there is no *Form submission notifications* section at all, step 1 or 2
   > has not happened yet. The section only appears once Netlify has seen a form.
5. Email to notify: **Paul's email address**. Form: **contact**. Save.

   > Deliberately not written down here — this repo is public, and published
   > addresses get scraped. The address lives only in Netlify's own settings.


Test it: open the site's `/contact` page, send yourself a message, and check it
arrives. Then check **Forms** in Netlify — the submission should be listed.

> The form has a hidden honeypot field called `fax-number`. Bots fill it in,
> humans never see it, and Netlify silently bins those submissions. No captcha.
> Free tier allows 100 submissions a month.

---

## Part 2.5 — Make the site publicly visible (1 min)

New Netlify projects can default to **private**, which makes every page return
`401` and bounce visitors to a Netlify login screen. If you open your
`.netlify.app` URL and are asked to log in, that is this setting and not a broken
build.

**Project configuration → General → Visitor access → Project visibility** → set
to **Public** → save.

Check it worked from a terminal — this should print `200`, not `401`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://swizee.netlify.app
```

## Part 3 — Stripe settings (10 min)

Do these in your **sandbox** first. You will repeat 3.1–3.3 in live mode at
go-live, because the two are entirely separate.

### 3.1 Business details

**Settings → Business → Public details**

- **Public business name**: `Swizee 3D Studio` — this is what customers see at
  the top of the payment page and on their receipt.
- **Support email** and **support website**: set these; they appear on receipts.
- Upload the logo under **Branding** when you have it, and set the brand colour
  to match the site.

### 3.2 Email receipts

**Settings → Business → Customer emails** → turn on **Successful payments**.

This is what sends the buyer their receipt. The brief requires it.

### 3.3 Automatic rebuilds when a product changes

This is what lets the family add a product in Stripe and see it on the site
without touching code.

**First, get a build hook from Netlify:**

1. Netlify → **Project configuration → Build & deploy → Build hooks** → **Add
   build hook**.
2. Name it `Stripe product change`. Branch: `main`. Save.
3. Copy the URL. It looks like
   `https://api.netlify.com/build_hooks/6512ab...`.
4. Add it as a Netlify environment variable named `NETLIFY_BUILD_HOOK_URL`.

> Keep a copy of this URL. Pasting it into a browser triggers a rebuild on
> demand — that is the "Rebuild Swizee site" bookmark referenced in HOWTO.md.
> Make that bookmark for the family.

**Then, point Stripe at the site:**

1. Stripe → **Developers → Webhooks** → **Add destination**.
2. Endpoint URL: `https://swizee.netlify.app/api/stripe-rebuild`
   (swap in the real domain after Part 4).
3. Events — select exactly these six:
   `product.created`, `product.updated`, `product.deleted`,
   `price.created`, `price.updated`, `price.deleted`
4. Save, then click into the endpoint and **reveal the signing secret**
   (`whsec_...`).
5. Add it as a Netlify environment variable named `STRIPE_WEBHOOK_SECRET`.
6. **Trigger a redeploy** in Netlify so the function picks up the new variables
   (environment variable changes do not apply to already-built functions).

Test it: change a product's description in Stripe. Netlify should start a build
within a few seconds.

> **Build minutes.** Netlify's free tier gives 300 minutes a month. This site
> builds in well under a minute, so that is 300+ product edits a month. Not a
> concern. Events other than the six above are ignored without starting a build.

---

## Part 4 — The domain (15 min, plus up to 24h waiting)

Do this only once the `.netlify.app` site works properly.

### 4.1 Add the domain in Netlify

1. **Domain management → Add a domain** → `swizee.co.uk` → **Verify**.
2. Netlify will say the domain is registered elsewhere. Choose
   **Set up Netlify DNS** (this is Netlify's own recommendation for an apex
   domain — it is faster than A records and handles HTTPS renewal cleanly).
3. Netlify shows you **four nameservers** like:

   ```
   dns1.p03.nsone.net
   dns2.p03.nsone.net
   dns3.p03.nsone.net
   dns4.p03.nsone.net
   ```

   **Use the ones your own screen shows.** The `p03` part differs per site —
   copying someone else's from a forum post is the single most common way this
   step goes wrong.

### 4.2 Point IONOS at them

1. Sign in at [ionos.co.uk](https://www.ionos.co.uk) → **Domains & SSL** →
   click `swizee.co.uk`.
2. Find **Nameservers** (sometimes under a **DNS** tab) → **Change** /
   **Use custom nameservers**.
3. Replace all of IONOS's nameservers with Netlify's four. Save.

> **Before you do this**: if `swizee.co.uk` currently has email on it (an MX
> record) or any other live record, note them down first. Changing nameservers
> moves *all* DNS to Netlify, and anything you do not recreate there stops
> working. For a brand-new domain with nothing on it, there is nothing to lose.

### 4.3 Wait, then check

Nameserver changes usually take 1–4 hours and can take up to 24. You can watch
progress from a terminal:

```bash
dig +short NS swizee.co.uk
```

When that returns the `nsone.net` names, you are through.

Then in Netlify: **Domain management → HTTPS → Verify DNS configuration**, and
once it is happy, **Provision certificate**. Let's Encrypt issues it free and
renews it automatically.

### 4.4 Confirm both of these work

- `https://swizee.co.uk` loads with a padlock
- `https://www.swizee.co.uk` redirects to `https://swizee.co.uk`

The `www` redirect is already in `netlify.toml` — you do not need to configure
it. Set `swizee.co.uk` as the **primary domain** in Netlify so `www` is treated
as the alias.

### 4.5 Tell Stripe the new address

Go back and update the webhook endpoint URL from Part 3.3 to
`https://swizee.co.uk/api/stripe-rebuild`.

---

## Part 5 — Before going live

Work through the **Go-live checklist** in [README.md](README.md). The two that
are easy to forget:

1. **Delete `ALLOW_SAMPLE_CATALOGUE` and `ALLOW_PLACEHOLDERS`** from Netlify's
   environment variables. Once they are gone, the build refuses to run without a
   real Stripe key and refuses to ship legal wording that still has
   `[[REPLACE: ...]]` in it. That is the point of them.
2. **Swap `STRIPE_SECRET_KEY` to the live key**, then trigger a rebuild.

Then do the real £1 purchase, check it reads correctly in the Dashboard, and
refund it.

---

## If a build fails

**Deploys → click the failed deploy → the log tells you which check stopped it.**

| Message in the log | What to do |
|---|---|
| `STRIPE_SECRET_KEY is not set` | Add the key, or set `ALLOW_SAMPLE_CATALOGUE=true` while you are still setting up |
| `BUILD BLOCKED — draft wording still contains placeholders` | Finish reviewing `terms.md` / `privacy.md`, or set `ALLOW_PLACEHOLDERS=true` |
| `Stripe returned no sellable products` | Not a failure — a warning. Products need to be Active with an active one-off GBP price |

Environment variable changes do not affect an existing build. After changing
one, always **Trigger deploy → Deploy site**.
