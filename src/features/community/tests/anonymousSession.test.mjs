// node --test src/features/community/tests/anonymousSession.test.mjs
// Uses the project's existing esbuild; does not read .env or contact any service.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const output = await build({
  stdin: {
    contents: `export * from './src/features/community/services/anonymousSessionStore';
      export * from './src/features/community/services/captchaTokens';`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { createAnonymousSessionStore, registerCaptchaToken, invalidateCaptchaToken, consumeCaptchaToken } =
  await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));

const session = (anonymous = true, expires = Date.now() / 1000 + 3600) => ({
  user: { id: 'internal-user', is_anonymous: anonymous }, expires_at: expires,
  access_token: 'private-access', refresh_token: 'private-refresh',
});
function mockAuth(initial = null) {
  let saved = initial;
  const callbacks = new Set();
  const calls = { signup: 0, refresh: 0, read: 0, subscribed: 0 };
  const auth = {
    getSession: async () => { calls.read++; return { data: { session: saved }, error: null }; },
    refreshSession: async () => { calls.refresh++; saved = session(); return { data: { session: saved }, error: null }; },
    signInAnonymously: async ({ options }) => {
      calls.signup++;
      assert.ok(options.captchaToken);
      saved = session();
      callbacks.forEach((cb) => cb('SIGNED_IN', saved));
      return { data: { session: saved }, error: null };
    },
    onAuthStateChange: (cb) => {
      callbacks.add(cb); calls.subscribed++;
      return { data: { subscription: { unsubscribe: () => { callbacks.delete(cb); calls.subscribed--; } } } };
    },
  };
  return { auth, calls, emit: (next) => { saved = next; callbacks.forEach((cb) => cb('TOKEN_REFRESHED', next)); } };
}
const proof = () => { const token = randomUUID(); assert.ok(registerCaptchaToken(token, () => {})); return token; };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('creates on explicit action only and exposes no session, tokens or internal IDs', async () => {
  const { auth, calls } = mockAuth();
  const store = createAnonymousSessionStore(auth);
  assert.equal(calls.read, 0);
  const stop = store.subscribe(() => {});
  await flush();
  assert.equal(calls.signup, 0);
  assert.equal(store.getSnapshot().status, 'idle');
  await store.ensureSession(proof());
  assert.equal(calls.signup, 1);
  assert.deepEqual(store.getSnapshot(), { status: 'authenticated', error: null });
  assert.ok(!JSON.stringify(store.getSnapshot()).includes('private'));
  stop();
});

test('reuses existing anonymous session without CAPTCHA and recovers persistence after reload', async () => {
  const { auth, calls } = mockAuth(session());
  const first = createAnonymousSessionStore(auth);
  await first.ensureSession();
  const reloaded = createAnonymousSessionStore(auth);
  const stop = reloaded.subscribe(() => {});
  await flush();
  assert.equal(reloaded.getSnapshot().status, 'authenticated');
  assert.equal(calls.signup, 0);
  stop();
});

test('deduplicates concurrent creation and StrictMode subscribe-cleanup-subscribe', async () => {
  const { auth, calls } = mockAuth();
  const store = createAnonymousSessionStore(auth);
  store.subscribe(() => {})();
  const stop = store.subscribe(() => {});
  await flush();
  const token = proof();
  const a = store.ensureSession(token);
  const b = store.ensureSession(token);
  assert.equal(a, b);
  await Promise.all([a, b]);
  assert.equal(calls.signup, 1);
  assert.equal(calls.subscribed, 1);
  stop();
  assert.equal(calls.subscribed, 0);
});

test('missing, unknown, expired, invalidated and already spent proofs never sign up', async () => {
  const { auth, calls } = mockAuth();
  const store = createAnonymousSessionStore(auth);
  for (const token of [undefined, '', 'unknown']) await assert.rejects(store.ensureSession(token));
  const invalid = proof(); invalidateCaptchaToken(invalid);
  await assert.rejects(store.ensureSession(invalid));
  const spent = proof(); assert.ok(consumeCaptchaToken(spent));
  await assert.rejects(store.ensureSession(spent));
  const expired = proof();
  const now = Date.now;
  try {
    Date.now = () => now() + 300001;
    await assert.rejects(store.ensureSession(expired));
  } finally { Date.now = now; }
  assert.equal(store.getSnapshot().error.code, 'captcha_required');
  assert.equal(calls.signup, 0);
});

test('Auth-rejected CAPTCHA is sanitized and spent even on failed signup', async () => {
  const { auth, calls } = mockAuth();
  auth.signInAnonymously = async () => { calls.signup++; return { data: { session: null }, error: new Error('private details') }; };
  const store = createAnonymousSessionStore(auth);
  const token = proof();
  await assert.rejects(store.ensureSession(token), /Não foi possível/);
  assert.equal(store.getSnapshot().error.code, 'session_failed');
  assert.ok(!JSON.stringify(store.getSnapshot()).includes('private'));
  await assert.rejects(store.ensureSession(token));
  assert.equal(calls.signup, 1);
});

test('unavailable client and network failures do not create identities', async () => {
  const unavailable = createAnonymousSessionStore(null);
  await assert.rejects(unavailable.ensureSession(proof()));
  assert.equal(unavailable.getSnapshot().error.code, 'unavailable');
  const { auth, calls } = mockAuth();
  auth.getSession = async () => { throw new Error('network failure with private data'); };
  const store = createAnonymousSessionStore(auth);
  await assert.rejects(store.ensureSession(proof()));
  assert.equal(store.getSnapshot().error.code, 'session_failed');
  assert.equal(calls.signup, 0);
});

test('recognizes is_anonymous strictly and preserves other sessions', async () => {
  for (const flag of [false, undefined]) {
    const existing = session(); existing.user.is_anonymous = flag;
    const { auth, calls } = mockAuth(existing);
    const store = createAnonymousSessionStore(auth);
    await assert.rejects(store.ensureSession(proof()));
    assert.equal(store.getSnapshot().error.code, 'non_anonymous_session');
    assert.equal(calls.signup, 0);
  }
});

test('refreshes expired anonymous sessions instead of creating another user', async () => {
  const { auth, calls } = mockAuth(session(true, 1));
  const store = createAnonymousSessionStore(auth);
  await store.ensureSession();
  assert.equal(calls.refresh, 1);
  assert.equal(calls.signup, 0);
  assert.equal(store.getSnapshot().status, 'authenticated');
});

test('auth changes update subscribers and cleanup stops notifications', async () => {
  const { auth, emit, calls } = mockAuth();
  const store = createAnonymousSessionStore(auth);
  const stop = store.subscribe(() => {});
  await flush();
  emit(session()); assert.equal(store.getSnapshot().status, 'authenticated');
  emit(null); assert.equal(store.getSnapshot().status, 'idle');
  emit(session(false)); assert.equal(store.getSnapshot().error.code, 'non_anonymous_session');
  stop();
  emit(null); assert.equal(store.getSnapshot().status, 'error');
  assert.equal(calls.subscribed, 0);
});

test('late restoration cannot overwrite a more recent auth event', async () => {
  const { auth, emit } = mockAuth();
  let resolve;
  auth.getSession = () => new Promise((done) => { resolve = done; });
  const store = createAnonymousSessionStore(auth);
  const stop = store.subscribe(() => {});
  emit(session());
  resolve({ data: { session: null }, error: null });
  await flush();
  assert.equal(store.getSnapshot().status, 'authenticated');
  stop();
});

test('refresh failure preserves identity instead of falling back to anonymous signup', async () => {
  const { auth, calls } = mockAuth(session(true, 1));
  auth.refreshSession = async () => ({ data: { session: null }, error: new Error('refresh unavailable') });
  const store = createAnonymousSessionStore(auth);
  await assert.rejects(store.ensureSession(proof()));
  assert.equal(store.getSnapshot().error.code, 'session_failed');
  assert.equal(calls.signup, 0);
});

test('real SDK persists and restores anonymous identity across client instances with mocked HTTP', async () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); },
    removeItem: (key) => { memory.delete(key); },
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = { id: randomUUID(), aud: 'authenticated', role: 'authenticated',
    app_metadata: { provider: 'anonymous', providers: [] }, user_metadata: {},
    is_anonymous: true, created_at: new Date().toISOString() };
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, is_anonymous: true,
  })}.synthetic-signature`;
  let signups = 0;
  const makeClient = () => createClient('http://127.0.0.1:54321', 'synthetic-public-test-key', {
    auth: { storage, storageKey: 'custode-unit-test', persistSession: true,
      autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      assert.equal(new URL(url).hostname, '127.0.0.1');
      assert.equal(new URL(url).pathname, '/auth/v1/signup');
      assert.ok(JSON.parse(init.body).gotrue_meta_security.captcha_token);
      signups++;
      return new Response(JSON.stringify({ access_token: accessToken, refresh_token: 'synthetic-refresh',
        token_type: 'bearer', expires_in: 3600, user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const first = makeClient();
  const firstStore = createAnonymousSessionStore(first.auth);
  await firstStore.ensureSession(proof());
  assert.equal(firstStore.getSnapshot().status, 'authenticated');
  const second = makeClient();
  const reloadedStore = createAnonymousSessionStore(second.auth);
  await reloadedStore.ensureSession();
  const recovered = await second.auth.getSession();
  assert.equal(recovered.data.session.user.id, user.id);
  assert.equal(recovered.data.session.user.is_anonymous, true);
  assert.equal(reloadedStore.getSnapshot().status, 'authenticated');
  assert.equal(signups, 1);
});
