// Shared by the browser (cart UI), the Astro build, and the Netlify Function.
// Plain .mjs so all three can import the *same* source — the brief requires the
// personalisation rule to be enforced client side and again server side, and a
// second copy of the regex is a bug waiting to happen.

export const PERSONALISATION_PATTERN = '^[A-Za-z0-9]{1,10}$';
export const PERSONALISATION_RE = /^[A-Za-z0-9]{1,10}$/;
export const PERSONALISATION_MAX = 10;

export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 20;

/**
 * @param {unknown} value
 * @param {number} [max] Variant-specific limit, e.g. 3 for the "3 letters"
 *   price. Falls back to the overall cap. Enforced on the server too — a
 *   customer must not be able to pay the 3-letter price for an 8-letter word.
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
export function validatePersonalisation(value, max = PERSONALISATION_MAX) {
  if (typeof value !== 'string') {
    return { ok: false, message: 'Please type the name or word you want.' };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'Please type the name or word you want.' };
  }
  const limit = Number.isInteger(max) && max > 0 && max <= PERSONALISATION_MAX ? max : PERSONALISATION_MAX;
  if (trimmed.length > limit) {
    return {
      ok: false,
      message: `That is too long — ${limit} ${limit === 1 ? 'character' : 'characters'} at most for this option.`,
    };
  }
  if (!PERSONALISATION_RE.test(trimmed)) {
    return { ok: false, message: 'Letters and numbers only please — no spaces, punctuation or emoji.' };
  }
  return { ok: true, value: trimmed };
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: number } | { ok: false, message: string }}
 */
export function validateQuantity(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, message: 'Quantity must be a whole number, at least 1.' };
  }
  if (n > MAX_QTY_PER_LINE) {
    return { ok: false, message: `Please order at most ${MAX_QTY_PER_LINE} of one item. Get in touch for bigger orders.` };
  }
  return { ok: true, value: n };
}

/**
 * Characters allowed for a given price. Explicit `max_chars` metadata wins;
 * otherwise read it off a variant label like "4 letters". Returns the overall
 * cap when neither applies.
 * @param {{ metadata?: Record<string,string>, nickname?: string|null }} price
 */
export function maxCharsForPrice(price) {
  const explicit = Number.parseInt(String(price?.metadata?.max_chars ?? ''), 10);
  if (Number.isInteger(explicit) && explicit > 0) return Math.min(explicit, PERSONALISATION_MAX);
  const label = price?.metadata?.variant_label || price?.nickname || '';
  const m = String(label).match(/(\d+)\s*(?:letters?|characters?|chars?)/i);
  if (m) return Math.min(Number.parseInt(m[1], 10), PERSONALISATION_MAX);
  return PERSONALISATION_MAX;
}
