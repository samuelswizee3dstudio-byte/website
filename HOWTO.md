# How to look after the Swizee website

This is for the family. You do **not** need to know how to code. There are only
three things you will ever need to do, and they are all in here.

- [Add or change a product](#add-or-change-a-product) — done in Stripe
- [Change the words on the website](#change-the-words-on-the-website) — done on GitHub
- [Add a video to the About page](#add-a-video-to-the-about-page)

At the bottom there is [Reading your orders](#reading-your-orders) and
[If something looks wrong](#if-something-looks-wrong).

---

## Add or change a product

Everything about a product — its name, its photo, its description and its price —
lives in **Stripe**. The website copies it from there. You never touch the
website itself.

### To add a new product

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign in.
2. Click **Product catalogue** in the left menu, then **+ Add product**.
3. Fill in:
   - **Name** — this is what shows on the website. Keep it short.
   - **Description** — a sentence or two. This shows under the name.
   - **Image** — click the upload box and add your photo. Square photos look
     best. You can add more than one and people can click through them.
   - **Amount** — the price in pounds, e.g. `6.00`. Make sure the currency says
     **GBP**, and that it is a **one-off** payment, not a subscription.
4. Scroll down, open **Additional options** → **Metadata**, and add any of the
   settings from the [Settings list](#settings-list) below. Most products need
   none at all.
5. Click **Add product**.
6. Wait about a minute and refresh the website. It should be there.

> **If it does not appear**, see [If something looks wrong](#if-something-looks-wrong).

### To change a product

Open it in Stripe, click **Edit product**, change what you need, save. Same
one-minute wait.

To change the **price**: Stripe will not let you edit an existing price. Instead,
add a new price, then archive the old one using the "..." menu next to it. The
website only ever shows active prices.

### To take a product off the website

Two ways:

- **For now** — add the metadata `hidden` = `true`. It stays in Stripe with all
  its history, but disappears from the site. Delete the metadata to bring it back.
- **For good** — click **Archive product**.

### Products with options (like different name lengths)

If a product has options that cost different amounts — say a name plate that
costs £5 for up to 4 letters and £7 for 5 to 7 letters — you do **not** make two
products. You make **one product with two prices**.

1. Make the product as normal with the first price.
2. Open it and click **+ Add another price**. Set the second amount.
3. On each price, open its "..." menu → **Edit metadata** and add
   `variant_label` with the words you want people to see, e.g. `Up to 4 letters`
   and `5 to 7 letters`.

The website then shows a set of choices, and the price updates as they pick.

### Products where the customer types a name

Add the metadata `personalise` = `true` to the product. That is all. The website
adds a box for them to type in, checks it is letters and numbers only, and puts
what they typed on your order.

### Settings list

These go in the product's **Metadata** section in Stripe. All optional.

| Type this | ...and this | What happens |
|---|---|---|
| `personalise` | `true` | Customer gets a box to type a name or word |
| `personalise_label` | `Name to print` | Changes the words above that box |
| `category` | `axolotls` | Groups it under a button on the Shop page. Use the same word for things that belong together |
| `featured` | `true` | Also shows it on the front page |
| `sort` | `10` | Controls the order. Lower numbers come first |
| `hidden` | `true` | Temporarily removes it from the website |
| `slug` | `axolotl` | Sets the web address to `swizee.co.uk/products/axolotl` |

On a **price** (only needed when a product has more than one):

| Type this | ...and this | What happens |
|---|---|---|
| `variant_label` | `4 letters` | The wording of that choice |
| `max_chars` | `4` | How many letters that choice allows. You usually do not need this — if the wording says "4 letters" the website works it out |
| `sort` | `1` | Which choice appears first |

> **A note on web addresses.** If you do not set `slug`, the address comes from
> the product's name. So renaming "Axolotl" to "Axolotl Buddy" changes its
> address and any link you already shared stops working. If you are going to post
> a link on Instagram, set a `slug` first and never change it.

---

## Change the words on the website

The About page, the front page blurb, the Contact page, the Terms and the Privacy
notice are all normal text files you can edit in a web browser.

**Click the link for the page you want to change.** Each one opens the file
straight into GitHub's editor — you do not need to find any folders.

| Page on the website | Click this |
|---|---|
| Front page heading and blurb | [edit home](https://github.com/samuelswizee3dstudio-byte/website/edit/main/src/content/copy/home.md) |
| About page | [edit about](https://github.com/samuelswizee3dstudio-byte/website/edit/main/src/content/copy/about.md) |
| Words above the contact form | [edit contact](https://github.com/samuelswizee3dstudio-byte/website/edit/main/src/content/copy/contact.md) |
| Terms of sale | [edit terms](https://github.com/samuelswizee3dstudio-byte/website/edit/main/src/content/copy/terms.md) |
| Privacy notice | [edit privacy](https://github.com/samuelswizee3dstudio-byte/website/edit/main/src/content/copy/privacy.md) |

1. Sign in to GitHub if it asks you to.
2. The file opens ready to type in. If it does not, click the **pencil** icon at
   the top right.
3. Change the words. Leave the bit at the very top between the two `---` lines
   alone unless you mean to change the page's title.
4. Click the green **Commit changes...** button at the top right.
5. A box appears. Type a short note about what you changed (e.g. "fix typo on
   about page") and click the green **Commit changes** button in the box.
6. Wait about a minute, then refresh the website.

> **Nothing can be broken permanently.** Every change is saved separately, and
> Paul can put any file back the way it was.

Formatting, if you want it:

```
## A heading

Normal writing. Leave a blank line between paragraphs.

**Bold text** and *italic text*.

- a list
- another thing

[words people click](https://example.com)
```

---

## Add a video to the About page

Videos are not stored on the website — they live on YouTube.

1. Upload the video to YouTube. Set it to **Unlisted** if you do not want it
   findable on YouTube itself. Unlisted videos still play fine on the website.
2. Copy the video's ID. It is the jumble of letters after `v=` in the address:
   `https://www.youtube.com/watch?v=`**`dQw4w9WgXcQ`**
3. Open the About page in the editor: [edit about](https://github.com/samuelswizee3dstudio-byte/website/edit/main/src/content/copy/about.md)
4. Near the top you will see:

   ```
   videos:
     - id: SptHTpVKGew
       title: "A look around the studio"
   ```

   Add another video by copying those two lines and changing them. Keep the
   spacing exactly as it is — the dashes and indents matter:

   ```
   videos:
     - id: SptHTpVKGew
       title: "A look around the studio"
     - id: dQw4w9WgXcQ
       title: "Printing a dragon"
   ```

   The title is the caption under the video. You can leave it out if you do not
   want one.

5. Commit the change. The videos appear at the bottom of the About page.

---

## Reading your orders

Everything is in Stripe. Go to **Payments** in the left menu and click an order.

You will see the customer's **name, email and phone number**, what they bought,
and what they paid.

If they ordered anything personalised, scroll down that page to the **Metadata**
box. It looks like this:

```
item_1              Name Plate (5 to 7 letters) ×2: JAKE
item_2              Personalised Keyring: EVIE
personalised_items  2
```

That is exactly what to print. `×2` means they ordered two of that one.

Stripe emails the customer a receipt automatically.

**Check how they want it.** On the same page, under the payment amount, Stripe
shows which option they picked — *Collect from Great Sankey, Warrington* or
*UK delivery*. If they chose delivery, their address is shown there too. If they
chose collection, email them to arrange a time when it is ready.

**To refund someone**, open the payment and click **Refund** at the top right.

---

## If something looks wrong

### "I added a product but it is not on the website"

Work down this list:

1. **Wait five minutes and refresh.** The website rebuilds itself after a change
   in Stripe, but it waits until you have stopped editing before it does — so a
   batch of changes becomes one update rather than twenty. It is not instant,
   and that is on purpose.
2. **Is the product Active?** Archived products do not show.
3. **Does it have a price, in GBP, as a one-off payment?** A product with no
   price, or a price in dollars, or a subscription price, will not show.
4. **Did you add `hidden` = `true` by mistake?**
5. **Are you looking at the right Stripe?** Stripe has a separate practice mode
   called a **sandbox**. A product added there never appears on the real website.
   Look at the top-left of the Stripe page: it should say **Swizee 3D studio**.
   If it says *sandbox*, click it and choose **Exit sandbox**, then add the
   product again.
6. **Force a rebuild.** Open the bookmark Paul set up called *Rebuild Swizee
   site* and wait a minute. (If you do not have it, ask Paul — it is a link that
   makes the site rebuild on demand.)

### "The website is showing the wrong price"

Prices come straight from Stripe. Check that the old price has been **archived**,
not just that a new one was added. If both are active, the site shows both as
options.

### "Someone typed something rude in the name box"

You do not have to print it. Refund them in Stripe and tell them why. The terms
of sale already say you can do this.

### Anything else

Ask Paul.
