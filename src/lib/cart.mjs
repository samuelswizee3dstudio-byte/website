// Client-side basket. Browser storage only — nothing reaches a server until
// the customer presses Checkout.
//
// A stored line is deliberately minimal: { priceId, text, qty }. Names, prices
// and photos are looked up from the build-time catalogue snapshot on the page,
// so a basket left open for a week can never show a stale price, and a line
// whose Stripe price has gone is dropped rather than silently mispriced.

import { validatePersonalisation, validateQuantity, MAX_LINES } from './validation.mjs';

const KEY = 'swizee.cart.v1';
const EVENT = 'swizee:cart';

const hasStorage = () => {
  try {
    const k = '__swizee_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
};

// Private-mode Safari and blocked-storage browsers fall back to memory: the
// basket works for the session instead of throwing on every click.
let memory = [];
const storageOk = typeof window !== 'undefined' && hasStorage();

export function lineKey(line) {
  return `${line.priceId}::${line.text ?? ''}`;
}

export function readCart() {
  if (typeof window === 'undefined') return [];
  if (!storageOk) return memory.slice();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.priceId === 'string' && l.priceId.startsWith('price_'))
      .map((l) => ({
        priceId: l.priceId,
        text: typeof l.text === 'string' ? l.text : '',
        qty: Number.isInteger(l.qty) && l.qty > 0 ? Math.min(l.qty, 10) : 1,
      }))
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

function writeCart(lines) {
  if (storageOk) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      memory = lines;
    }
  } else {
    memory = lines;
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { lines } }));
}

/**
 * @returns {{ ok: true, lines: object[] } | { ok: false, message: string }}
 */
export function addLine({ priceId, text = '', qty = 1 }) {
  if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
    return { ok: false, message: 'Please choose an option first.' };
  }
  const q = validateQuantity(qty);
  if (!q.ok) return q;

  let cleanText = '';
  if (text) {
    const t = validatePersonalisation(text);
    if (!t.ok) return t;
    cleanText = t.value;
  }

  const lines = readCart();
  const key = lineKey({ priceId, text: cleanText });
  const existing = lines.find((l) => lineKey(l) === key);

  if (existing) {
    // Same product, same option, same word — bump the quantity rather than
    // adding a second identical row.
    existing.qty = Math.min(existing.qty + q.value, 10);
  } else {
    if (lines.length >= MAX_LINES) {
      return { ok: false, message: 'Your basket is full. Please check out, then start another order.' };
    }
    lines.push({ priceId, text: cleanText, qty: q.value });
  }
  writeCart(lines);
  return { ok: true, lines };
}

/** @returns {{ ok: true, lines: object[] } | { ok: false, message: string }} */
export function setQty(key, qty) {
  const q = validateQuantity(qty);
  if (!q.ok) return q;
  const lines = readCart();
  const line = lines.find((l) => lineKey(l) === key);
  if (!line) return { ok: false, message: 'That item is no longer in your basket.' };
  line.qty = q.value;
  writeCart(lines);
  return { ok: true, lines };
}

/** @param {string} key */
export function removeLine(key) {
  writeCart(readCart().filter((l) => lineKey(l) !== key));
}

export function clearCart() {
  writeCart([]);
}

export function cartCount() {
  return readCart().reduce((n, l) => n + l.qty, 0);
}

export function onCartChange(fn) {
  if (typeof window === 'undefined') return () => {};
  const local = () => fn(readCart());
  // 'storage' fires when the basket changes in another tab.
  const cross = (e) => { if (e.key === KEY) fn(readCart()); };
  window.addEventListener(EVENT, local);
  window.addEventListener('storage', cross);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener('storage', cross);
  };
}
