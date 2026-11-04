// Synthetic Auth and HTTP only; no .env, Supabase instance or real accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const session = { access_token: 'admin-test-token', user: { id: 'moderator', is_anonymous: false } };
let currentSession = session;
let configuration;
let signIn;
let signOut;
let recoveryRequest;
let exchangeCount = 0;
let updates = 0;
globalThis.__createAdminClient = (url, key, options) => {
  configuration = { url, key, options };
  return { auth: {
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    signInWithPassword: async input => { signIn = input; return { error: null }; },
    signOut: async input => { signOut = input; return { error: null }; },
    resetPasswordForEmail: async (...input) => { recoveryRequest = input; return { error: null }; },
    exchangeCodeForSession: async code => { assert.equal(code, 'synthetic-code'); exchangeCount++; return { error: null }; },
    updateUser: async () => { updates++; return { error: null }; },
  } };
};
const compiled = await build({
  stdin: { contents: `export * from './src/features/community-admin/adminAuth'; export * from './src/features/community-admin/adminClient';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://local.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public' }) },
  plugins: [{ name: 'synthetic-sdk', setup(builder) {
    builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'sdk', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = globalThis.__createAdminClient;' }));
  } }],
});
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('administrative client has its own persistent storage and explicit PKCE callback', () => {
  assert.equal(configuration.options.auth.storageKey, 'custode-community-admin-auth-v1');
  assert.equal(configuration.options.auth.detectSessionInUrl, false);
  assert.equal(configuration.options.auth.flowType, 'pkce');
  assert.equal(configuration.options.auth.persistSession, true);
});

test('no session or anonymous identity never reaches the administrative backend', async () => {
  currentSession = null;
  assert.equal(await api.getAdminAccess(), null);
  currentSession = { ...session, user: { is_anonymous: true } };
  await assert.rejects(api.getAdminAccess(), error => error.reason === 'forbidden');
  currentSession = session;
});

test('membership requires a valid backend response and only sends the administrative token in headers', async () => {
  await api.verifyModerator(session.access_token, async (url, options) => {
    assert.equal(url, 'http://local.invalid/functions/v1/community-admin?resource=comments&limit=1');
    assert.equal(options.headers.Authorization, 'Bearer admin-test-token');
    assert.equal(options.headers.apikey, 'synthetic-public');
    return Response.json({ items: [], next_cursor: null });
  });
});

test('inactive accounts, expired sessions, missing function and malformed responses fail closed', async () => {
  for (const [status, body, reason] of [
    [403, {}, 'forbidden'], [401, {}, 'unauthorized'], [404, {}, 'unavailable'],
    [503, { message: 'private details' }, 'unavailable'], [200, {}, 'unavailable'],
  ]) {
    await assert.rejects(api.verifyModerator('token', async () => Response.json(body, { status })), error =>
      error.reason === reason && !error.message.includes('private details'));
  }
  await assert.rejects(api.verifyModerator('token', async () => { throw new Error('offline'); }), error => error.reason === 'unavailable');
});

test('password login and logout use only the administrative SDK', async () => {
  await api.signInAdmin(' moderator@example.invalid ', 'synthetic-password', null);
  assert.equal(signIn.email, 'moderator@example.invalid');
  assert.equal(signIn.password, 'synthetic-password');
  await api.signOutAdmin();
  assert.deepEqual(signOut, { scope: 'local' });
});

test('recovery redirects to the administrative route and exchanges its code only once', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: 'http://local.invalid', pathname: '/admin/login' } };
  try {
    await api.requestAdminPassword(' moderator@example.invalid ', null);
    assert.equal(recoveryRequest[0], 'moderator@example.invalid');
    assert.equal(recoveryRequest[1].redirectTo, 'http://local.invalid/admin/reset');
    await api.completeAdminRecovery();
    globalThis.window.location = { pathname: '/admin/reset', href: 'http://local.invalid/admin/reset?code=synthetic-code' };
    globalThis.window.history = { replaceState: (_state, _title, path) => assert.equal(path, '/admin/reset') };
    await Promise.all([api.completeAdminRecovery(), api.completeAdminRecovery()]);
    assert.equal(exchangeCount, 1);
  } finally { globalThis.window = originalWindow; }
});

test('password update is denied before calling Auth when backend membership is revoked', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({}, { status: 403 });
  try {
    await assert.rejects(api.updateAdminPassword('new-password'), error => error.reason === 'forbidden');
    assert.equal(updates, 0);
  } finally { globalThis.fetch = originalFetch; }
});
