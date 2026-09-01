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
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
export function validatePersonalisation(value) {
  if (typeof value !== 'string') {
    return { ok: false, message: 'Please type the name or word you want.' };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'Please type the name or word you want.' };
  }
  if (trimmed.length > PERSONALISATION_MAX) {
    return { ok: false, message: `That is too long — ${PERSONALISATION_MAX} letters or numbers at most.` };
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
