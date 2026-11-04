// Contract tests with synthetic HTTP only. No backend, database or account writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

let session = { access_token: 'synthetic-admin-token' };
globalThis.__readAdminAuth = { getSession: async () => ({ data: { session }, error: null }) };
const compiled = await build({
  stdin: { contents: `export * from './src/features/community-admin/adminRead';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://local.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public' }) },
  plugins: [{ name: 'isolated-admin-client', setup(builder) {
    builder.onResolve({ filter: /\/adminClient$|^\.\/adminClient$/ }, () => ({ path: 'auth', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const adminClient = { auth: globalThis.__readAdminAuth };' }));
  } }],
});
const { adminRead } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const nativeFetch = globalThis.fetch;
const query = { resource: 'comments', chapter: '', status: '', cursor: null };
const signal = () => new AbortController().signal;
const comment = { id: 'comment-id', chapter_number: 28, pseudonym: 'Leitora', body: '<script>untrusted text</script>',
  status: 'hidden', moderation_version: 7, created_at: '2026-11-04T12:00:00.123456Z', moderated_at: null, moderation_reason: null };

test('GET uses only the Edge endpoint, admin headers, optional filters and opaque cursor', async () => {
  const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(new URL(url));
    assert.equal(options.method, 'GET');
    assert.equal(url.pathname, '/functions/v1/community-admin');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-admin-token');
    assert.equal(options.headers.apikey, 'synthetic-public');
    assert.equal(options.body, undefined);
    return Response.json({ items: [], next_cursor: 'opaque-next' });
  };
  try {
    await adminRead(query, signal());
    assert.equal(urls[0].searchParams.has('chapter'), false);
    assert.equal(urls[0].searchParams.has('status'), false);
    assert.equal(urls[0].searchParams.get('limit'), '20');
    const page = await adminRead({ ...query, chapter: '28', status: 'hidden', cursor: 'opaque_123-microseconds' }, signal());
    assert.equal(urls[1].searchParams.get('chapter'), '28');
    assert.equal(urls[1].searchParams.get('status'), 'hidden');
    assert.equal(urls[1].searchParams.get('cursor'), 'opaque_123-microseconds');
    assert.equal(page.next_cursor, 'opaque-next');
    await adminRead({ ...query, resource: 'history', chapter: '28', status: 'hidden' }, signal());
    assert.equal(urls[2].searchParams.has('status'), false, 'history forbids status in the real contract');
  } finally { globalThis.fetch = nativeFetch; }
});

test('comment projections strip private and unknown fields without interpreting content as HTML', async () => {
  globalThis.fetch = async () => Response.json({ items: [{ ...comment, author_id: 'private-reader', client_request_id: 'private-request' }], next_cursor: null });
  try {
    const page = await adminRead(query, signal());
    assert.equal(page.items[0].body, comment.body);
    assert.equal(page.items[0].status, 'hidden');
    assert.equal(page.items[0].moderation_version, 7);
    assert.ok(!JSON.stringify(page).includes('private-'));
  } finally { globalThis.fetch = nativeFetch; }
});

test('reports and historical snapshots match the real nested projections', async () => {
  try {
    globalThis.fetch = async () => Response.json({ items: [{ id: 'report-id', reason_code: 'inappropriate_content', details: null,
      status: 'resolved', moderation_version: 2, created_at: comment.created_at, resolved_at: comment.created_at, resolution_note: 'Revisada',
      reporter_id: 'private-reporter', comment: { ...comment, author_id: 'private-author' } }], next_cursor: null });
    const reports = await adminRead({ ...query, resource: 'reports' }, signal());
    assert.equal(reports.items[0].comment.chapter_number, 28);
    assert.equal(reports.items[0].status, 'resolved');
    assert.equal(reports.items[0].moderation_version, 2);
    assert.ok(!JSON.stringify(reports).includes('private-'));
    globalThis.fetch = async () => Response.json({ items: [{ id: 'audit-id', action: 'comment_hidden', reason: 'Spam', created_at: comment.created_at,
      moderator_id: 'moderator-uuid', metadata: { before: { status: 'published', author_id: 'private-author' }, after: { status: 'hidden' }, request: 'private-request' } }], next_cursor: null });
    const history = await adminRead({ ...query, resource: 'history' }, signal());
    assert.equal(history.items[0].before, 'published');
    assert.equal(history.items[0].after, 'hidden');
    assert.ok(!JSON.stringify(history).includes('private-'));
    assert.ok(!JSON.stringify(history).includes('moderator-uuid'));
  } finally { globalThis.fetch = nativeFetch; }
});

test('expired sessions and denied membership fail closed, other failures are sanitized', async () => {
  try {
    for (const [status, reason] of [[401, 'unauthorized'], [403, 'forbidden'], [400, 'unavailable'], [503, 'unavailable']]) {
      globalThis.fetch = async () => Response.json({ message: 'private backend details' }, { status });
      await assert.rejects(adminRead(query, signal()), error => error.reason === reason && !error.message.includes('private'));
    }
    session = null;
    globalThis.fetch = async () => { assert.fail('No HTTP allowed without session'); };
    await assert.rejects(adminRead(query, signal()), error => error.reason === 'unauthorized');
  } finally { session = { access_token: 'synthetic-admin-token' }; globalThis.fetch = nativeFetch; }
});

test('malformed pages, dates and states return controlled errors', async () => {
  try {
    for (const body of [{ items: [], next_cursor: {} }, { items: [{ ...comment, status: 'unknown' }], next_cursor: null },
      { items: [{ ...comment, moderated_at: 'invalid-date' }], next_cursor: null }, { items: {}, next_cursor: null }]) {
      globalThis.fetch = async () => Response.json(body);
      await assert.rejects(adminRead(query, signal()), error => error.reason === 'unavailable');
    }
  } finally { globalThis.fetch = nativeFetch; }
});
