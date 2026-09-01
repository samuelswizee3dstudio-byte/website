# Running the Swizee shop

Everything you need to do — adding things to sell, reading orders, giving refunds
— happens in **one place: Stripe**. You never need to touch the website itself.

Sign in at **https://dashboard.stripe.com**

---

## First, the one thing that catches everybody

Stripe has a **practice mode** called a **sandbox**. It looks almost identical to
the real thing, but nothing in it is real and **nothing you add there will ever
appear on the website**.

**Before you do anything, look at the top-left corner of the Stripe page.**

- It should say **Swizee 3D studio**
- If it says **Swizee 3D studio sandbox**, or there is a coloured bar across the
  top saying *"You're testing in a sandbox"*, you are in the wrong place

To get out: click the name in the top-left, then click **Exit sandbox**.

This has already caught Paul twice. If something you added is not showing up on
the website, check this first.

---

## Adding something new to sell

1. Click **Product catalogue** in the left-hand menu
2. Click **+ Add product** (top right)
3. Fill in:

   | Field | What to put |
   |---|---|
   | **Name** | What it is called on the website. Keep it short — "Flexi Lizard", not "Articulated 3D Printed Flexi Lizard Toy" |
   | **Description** | A sentence or two. This shows under the name on the product page |
   | **Image** | Your photo. Square photos look best. You can add several and people can click through them |
   | **Amount** | The price, like `4.50`. Check the currency says **GBP** |

4. Make sure it says **One-off**, not *Recurring*. Recurring means a subscription
   and the website will ignore it.
5. Click **Add product**
6. Wait about five minutes, then look at the website

That is it for a simple item. Everything below is only needed for special cases.

---

## Things where the customer types a name

Like the name clicker keyrings.

When you add the product, scroll down to **Additional options** → **Metadata**,
and add:

| Left box | Right box |
|---|---|
| `personalise` | `true` |

That is all. The website adds a box for the customer to type in, checks it is
letters and numbers only, and puts what they typed on your order.

If you want the box to say something other than "Name or word to print", add:

| Left box | Right box |
|---|---|
| `personalise_label` | `Name to print` |

---

## Things with options that cost different amounts

Like a keyring where 3 letters costs £3.50 and 4 letters costs £4.00.

**Do not make two products.** Make **one product with several prices**.

1. Add the product as normal, with the first price
2. Open it and click **+ Add another price**. Set the next amount
3. Repeat for each option
4. On each price, click its **"..."** menu → **Edit metadata**, and add:

   | Left box | Right box |
   |---|---|
   | `variant_label` | `3 letters` |

Use wording that says the number, like `3 letters` or `Up to 4 letters`. The
website reads the number out of it and stops customers typing a longer name than
they have paid for.

The website then shows the options as buttons, and the price changes as they pick.

---

## Changing a price

Stripe will not let you edit a price once it exists. Instead:

1. Open the product
2. Click **+ Add another price** and set the new amount
3. Find the old price, click its **"..."** menu, and choose **Archive price**

**Both steps matter.** If you forget to archive the old one, the website shows
both prices as options and customers can pick the cheaper.

---

## Taking something off the website

**Just for now** — open the product, go to **Metadata**, and add:

| Left box | Right box |
|---|---|
| `hidden` | `true` |

It stays in Stripe with all its history but disappears from the website. Delete
that metadata line to bring it back.

**For good** — open the product and click **Archive product**.

---

## Reading an order

Click **Payments** in the left-hand menu, then click an order.

You will see:

- The customer's **name, email and phone number**
- **What they bought** and what they paid
- **How they want it** — either *Collect from Great Sankey, Warrington* or
  *UK delivery*. If they chose delivery, their address is shown here too

**If they ordered anything personalised**, scroll down that page to the box
labelled **Metadata**. It looks like this:

```
item_1              Name Clicker Keyring (5 letters) ×2: JAKE
item_2              Name Block (Up to 4 letters): EVIE
personalised_items  2
```

That is exactly what to print. `×2` means they ordered two of that one.

Stripe emails the customer a receipt automatically. When the order is ready:

- **Collection** — email them to arrange a time
- **Delivery** — post it

---

## Giving a refund

Open the payment in **Payments** and click **Refund** at the top right. You can
refund all of it or part of it.

You do not have to print something rude. Refund it and say why — the terms of
sale already allow this.

---

## How long until changes show on the website?

**About five minutes.**

The website deliberately waits until you have *stopped* making changes before it
updates. If you add ten products one after another, it updates once at the end
rather than ten times. So it is not instant, and that is on purpose.

---

## If something is not showing up

Work down this list:

1. **Are you in the sandbox?** Check the top-left says **Swizee 3D studio** with
   no coloured bar. This is the most common cause by a long way.
2. **Wait five more minutes** and refresh the page.
3. **Is the product Active?** Archived products do not show.
4. **Does it have a price, in GBP, as a one-off payment?** No price, or a price
   in dollars, or a subscription price, and it will not appear.
5. **Did you add `hidden` = `true` by mistake?**
6. **Still stuck?** Ask Paul.

---

## The extra settings, all in one place

These go in a product's **Metadata** box. All optional — most products need none.

| Left box | Right box | What it does |
|---|---|---|
| `personalise` | `true` | Customer gets a box to type a name or word |
| `personalise_label` | `Name to print` | Changes the wording above that box |
| `category` | `fidgets` | Groups it with similar things. Use the same word for things that belong together |
| `featured` | `true` | Also shows it on the front page |
| `sort` | `10` | Controls the order. Lower numbers come first |
| `hidden` | `true` | Temporarily removes it from the website |
| `slug` | `flexi-lizard` | Sets the web address to `swizee.co.uk/products/flexi-lizard` |

On a **price** (only when a product has more than one option):

| Left box | Right box | What it does |
|---|---|---|
| `variant_label` | `3 letters` | The wording of that choice |
| `sort` | `1` | Which choice appears first |

**A note on web addresses.** If you do not set `slug`, the address comes from the
product's name — so renaming "Axolotl" to "Axolotl Buddy" changes its address and
any link you already posted stops working. If you are going to share a link on
Instagram, set a `slug` first and never change it.

---

## What is not in Stripe

Changing the words on the website — the About page, the front page, the terms —
is not done in Stripe. **Ask Paul.**
