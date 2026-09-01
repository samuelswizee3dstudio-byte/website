import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drainPendingRebuild, PENDING_KEY, QUIET_PERIOD_MS } from '../src/lib/rebuild-core.mjs';

/** Minimal stand-in for a Cloudflare KV namespace. */
const fakeKV = (initial = null) => {
  let value = initial;
  return {
    get: async () => value,
    put: async (_k, v) => { value = v; },
    delete: async () => { value = null; },
    peek: () => value,
  };
};

const withFetch = async (fn) => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init?.body });
    return { ok: true, status: 200 };
  };
  try { await fn(calls); } finally { globalThis.fetch = real; }
};

test('nothing pending means no deploy is spent', async () => {
  await withFetch(async (calls) => {
    const env = { REBUILD_STATE: fakeKV(null), DEPLOY_HOOK_URL: 'https://hook' };
    assert.deepEqual(await drainPendingRebuild(env), { skipped: 'nothing pending' });
    assert.equal(calls.length, 0);
  });
});

test('a recent edit waits rather than deploying immediately', async () => {
  await withFetch(async (calls) => {
    const now = 1_000_000;
    const kv = fakeKV(JSON.stringify({ at: now - 1000, reason: 'product.updated' }));
    const env = { REBUILD_STATE: kv, DEPLOY_HOOK_URL: 'https://hook' };
    const r = await drainPendingRebuild(env, now);
    assert.equal(r.waiting, true);
    assert.equal(calls.length, 0, 'must not deploy while edits are still arriving');
    assert.ok(kv.peek(), 'flag stays set so a later drain picks it up');
  });
});

test('once edits go quiet, exactly one deploy is spent and the flag clears', async () => {
  await withFetch(async (calls) => {
    const now = 1_000_000;
    const kv = fakeKV(JSON.stringify({ at: now - QUIET_PERIOD_MS - 1, reason: 'price.updated' }));
    const env = { REBUILD_STATE: kv, DEPLOY_HOOK_URL: 'https://hook' };
    const r = await drainPendingRebuild(env, now);
    assert.equal(r.deployed, true);
    assert.equal(calls.length, 1);
    assert.equal(kv.peek(), null, 'flag cleared so the next drain is a no-op');
    // A second drain must not spend another deploy.
    await drainPendingRebuild(env, now);
    assert.equal(calls.length, 1);
  });
});

test('a burst of fifteen edits costs one deploy, not fifteen', async () => {
  await withFetch(async (calls) => {
    const kv = fakeKV(null);
    const env = { REBUILD_STATE: kv, DEPLOY_HOOK_URL: 'https://hook' };
    let now = 1_000_000;
    // The family edits fifteen products over four minutes.
    for (let i = 0; i < 15; i++) {
      await kv.put(PENDING_KEY, JSON.stringify({ at: now, reason: 'product.updated' }));
      now += 16_000;
      await drainPendingRebuild(env, now); // the schedule keeps checking throughout
    }
    assert.equal(calls.length, 0, 'no deploy while they are still editing');
    now += QUIET_PERIOD_MS + 1;
    await drainPendingRebuild(env, now);
    assert.equal(calls.length, 1, 'one deploy once they stop');
  });
});

test('unreadable state is cleared rather than looping forever', async () => {
  await withFetch(async (calls) => {
    const kv = fakeKV('not json');
    const env = { REBUILD_STATE: kv, DEPLOY_HOOK_URL: 'https://hook' };
    const r = await drainPendingRebuild(env, 1_000_000);
    assert.equal(r.skipped, 'unreadable, cleared');
    assert.equal(kv.peek(), null);
    assert.equal(calls.length, 0);
  });
});

test('missing configuration is a no-op, not a crash', async () => {
  assert.deepEqual(await drainPendingRebuild({}), { skipped: 'not configured' });
  assert.deepEqual(await drainPendingRebuild({ REBUILD_STATE: fakeKV('x') }), { skipped: 'not configured' });
});
