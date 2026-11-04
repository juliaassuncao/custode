// Synthetic Auth and HTTP; no database, real accounts or remote mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

let session = { access_token: 'synthetic-admin-token' };
globalThis.__mutationAuth = { getSession: async () => ({ data: { session }, error: null }) };
const compiled = await build({
  stdin: { contents: `export * from './src/features/community-admin/adminMutate';
    export { parseAdminMutation } from './supabase/functions/_shared/community-admin-handler';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://local.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public' }) },
  plugins: [{ name: 'isolated-admin-auth', setup(builder) {
    builder.onResolve({ filter: /\/adminClient$|^\.\/adminClient$/ }, () => ({ path: 'auth', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const adminClient = { auth: globalThis.__mutationAuth };' }));
  } }],
});
const { createAdminMutation, adminMutate, parseAdminMutation } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const nativeFetch = globalThis.fetch;
const target = '00000000-0000-4000-8000-000000000112';
const statuses = { hide_comment: 'hidden', restore_comment: 'published', resolve_report: 'resolved', dismiss_report: 'dismissed' };
const success = (command, extra = {}) => ({ audit_id: '00000000-0000-4000-8000-000000000113', target_id: command.target_id,
  state: { status: statuses[command.operation], version: command.expected_version + 1 }, replayed: false, ...extra });

test('all four immutable commands match the real handler contract, with version and fresh request UUID', () => {
  const ids = new Set();
  for (const operation of Object.keys(statuses)) {
    const command = createAdminMutation(operation, target, 7, operation === 'hide_comment' ? '  Spam  ' : '');
    assert.deepEqual(parseAdminMutation(command), command);
    assert.equal(command.expected_version, 7);
    assert.ok(Object.isFrozen(command));
    ids.add(command.request_id);
  }
  assert.equal(ids.size, 4);
});

test('required reason, Unicode length and actionable version are validated before HTTP', () => {
  for (const note of ['', '  ', '😀'.repeat(2001), 'invalid\0']) assert.throws(() => createAdminMutation('hide_comment', target, 0, note));
  assert.doesNotThrow(() => createAdminMutation('hide_comment', target, 0, '😀'.repeat(2000)));
  for (const version of [-1, undefined, 0.5, 2147483647]) assert.throws(() => createAdminMutation('hide_comment', target, version, 'Spam'));
  assert.throws(() => createAdminMutation('remove_comment', target, 0, 'Spam'));
});

test('each operation sends only the exact POST payload and the administrative session', async () => {
  try {
    for (const operation of Object.keys(statuses)) {
      const command = createAdminMutation(operation, target, 3, 'Revisão');
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'http://local.invalid/functions/v1/community-admin');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, 'Bearer synthetic-admin-token');
        assert.equal(options.headers.apikey, 'synthetic-public');
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(options.body), command);
        assert.equal(JSON.parse(options.body).moderator_id, undefined);
        return Response.json(success(command));
      };
      await adminMutate(command);
    }
  } finally { globalThis.fetch = nativeFetch; }
});

test('uncertain retries preserve the exact body and UUID, and concurrent clicks share one HTTP request', async () => {
  const command = createAdminMutation('hide_comment', target, 4, 'Spam');
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(options.body);
    if (bodies.length === 1) throw new Error('Synthetic lost response after commit');
    return Response.json(success(command, { replayed: true }));
  };
  try {
    await assert.rejects(adminMutate(command), error => error.uncertain === true);
    await Promise.all([adminMutate(command), adminMutate(command), adminMutate(command)]);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(JSON.parse(bodies[1]).expected_version, 4);
  } finally { globalThis.fetch = nativeFetch; }
});

test('version and idempotency conflicts are explicit and never retry or change version automatically', async () => {
  let calls = 0;
  const command = createAdminMutation('restore_comment', target, 5, '');
  try {
    for (const code of ['state_conflict', 'idempotency_conflict']) {
      globalThis.fetch = async () => { calls++; return Response.json({ error: { code, message: 'private SQL details' } }, { status: 409 }); };
      await assert.rejects(adminMutate(command), error => error.code === code && !error.uncertain && !error.message.includes('private'));
      assert.equal(command.expected_version, 5);
    }
    assert.equal(calls, 2);
  } finally { globalThis.fetch = nativeFetch; }
});

test('authorization and expired-session errors deny writes; no session makes no HTTP request', async () => {
  const command = createAdminMutation('resolve_report', target, 0, '');
  try {
    for (const [status, reason] of [[401, 'unauthorized'], [403, 'forbidden']]) {
      globalThis.fetch = async () => Response.json({}, { status });
      await assert.rejects(adminMutate(command), error => error.reason === reason);
    }
    session = null;
    globalThis.fetch = async () => assert.fail('No HTTP without an administrative session');
    await assert.rejects(adminMutate(command), error => error.reason === 'unauthorized');
  } finally { session = { access_token: 'synthetic-admin-token' }; globalThis.fetch = nativeFetch; }
});

test('service failures, malformed success and a mismatched record never report confirmed success', async () => {
  const command = createAdminMutation('dismiss_report', target, 0, '');
  try {
    for (const response of [Response.json({ message: 'private backend details' }, { status: 503 }),
      Response.json({}), Response.json(success(command, { target_id: 'another-target' })),
      Response.json(success(command, { state: { status: 'dismissed', version: 8 } }))]) {
      globalThis.fetch = async () => response;
      await assert.rejects(adminMutate(command), error => error.uncertain === true && !error.message.includes('private'));
    }
  } finally { globalThis.fetch = nativeFetch; }
});

test('rejected data and missing records are definitive failures, without automatic resubmission', async () => {
  const command = createAdminMutation('hide_comment', target, 0, 'Spam');
  try {
    for (const [status, code] of [[400, 'invalid_parameters'], [413, 'invalid_parameters'], [415, 'invalid_parameters'], [404, 'not_found']]) {
      globalThis.fetch = async () => Response.json({}, { status });
      await assert.rejects(adminMutate(command), error => error.code === code && !error.uncertain);
    }
  } finally { globalThis.fetch = nativeFetch; }
});
