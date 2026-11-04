// Run from the repository root after `supabase functions serve community-read`:
// node --experimental-strip-types supabase/functions/tests/community-read.local.mjs
// Synthetic local fixtures are committed for HTTP visibility, then removed in finally.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { parseReadParameters, encodeCursor } from '../_shared/validation.ts';

const docker = process.env.LOCAL_DOCKER_BIN || 'docker';
function sql(query) {
  const result = spawnSync(docker, ['exec', '-i', 'supabase_db_custode-community',
    'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'Local SQL failed');
  return result.stdout.trim();
}
const endpoint = 'http://127.0.0.1:54321/functions/v1/community-read';
let assertions = 0;
async function request(query, status = 200, options) {
  const response = await fetch(`${endpoint}?${query}`, options);
  assert.equal(response.status, status);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assertions++;
  return response.status === 204 ? null : response.json();
}

// Invalid cursors cannot inject PostgREST expressions or cross chapters.
const validCursor = encodeCursor(1, { id: randomUUID(), created_at: '2026-11-03T00:00:00.123456+00:00' });
assert.equal(parseReadParameters(new URL(`http://local/?chapter=1&cursor=${validCursor}`)).cursor.created_at,
  '2026-11-03T00:00:00.123456+00:00');
for (const query of ['chapter=2&cursor=' + validCursor, 'chapter=1&cursor=invalid',
  'chapter=1&cursor=' + encodeCursor(1, { id: randomUUID(), created_at: '2026-02-30T00:00:00Z' }),
  'chapter=1&cursor=' + encodeCursor(1, { id: randomUUID(), created_at: '0000-01-01T00:00:00Z' }),
  'chapter=1&cursor=' + encodeCursor(1, { id: 'x),status.eq.hidden', created_at: '2026-11-03T00:00:00Z' })]) {
  assert.throws(() => parseReadParameters(new URL(`http://local/?${query}`)));
}

// Inject failures without breaking or reconfiguring the real local stack.
const nativeFetch = globalThis.fetch;
globalThis.Deno = { env: { get: () => undefined }, serve: () => {} };
const { handleRequest } = await import('../community-read/index.ts');
const directPreflight = await handleRequest(new Request('http://local/', { method: 'OPTIONS' }));
assert.equal(directPreflight.status, 204);
assert.equal(directPreflight.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
let failure = await handleRequest(new Request('http://local/?chapter=1'));
assert.equal(failure.status, 500);
globalThis.Deno.env.get = (name) => name === 'SUPABASE_URL' ? 'http://local' : 'synthetic-test-secret';
globalThis.fetch = async () => { throw new Error('private postgres error synthetic-test-secret'); };
failure = await handleRequest(new Request('http://local/?chapter=1'));
assert.equal(failure.status, 500);
assert.deepEqual(await failure.json(), {
  error: { code: 'internal_error', message: 'Não foi possível carregar a comunidade.' },
});
globalThis.fetch = nativeFetch;

const chapter = 2147483000;
const user = randomUUID();
const ids = Array.from({ length: 57 }, () => randomUUID());
// Refuse to touch existing data at the reserved fixture chapter numbers.
assert.equal(sql(`select count(*) from public.community_chapters where chapter_number in (${chapter},${chapter + 1})`), '0');
try {
  sql(`begin;
    insert into public.community_chapters(chapter_number,enabled) values (${chapter},true),(${chapter + 1},false);
    insert into auth.users(id) values ('${user}');
    ${ids.map((id, i) => `insert into public.comments
      (id,chapter_number,author_id,pseudonym,body,client_request_id,status,created_at,moderation_reason)
      values ('${id}',${chapter},'${user}','Fixture','Comment ${i}','${randomUUID()}',
      '${i < 55 ? 'published' : i === 55 ? 'hidden' : 'removed'}',
      '2026-11-03T00:00:00.${i < 30 ? '123456' : '123457'}+00:00','private fixture metadata');`).join('\n')}
    insert into public.chapter_clovers(chapter_number,user_id) values (${chapter},'${user}');
    commit;`);

  const existing = await request('chapter=1');
  assert.equal(existing.chapter_number, 1);
  console.log('Existing chapter public endpoint checked (content omitted).');
  assert.deepEqual(await request('chapter=2147483647', 404),
    { error: { code: 'chapter_not_found', message: 'Capítulo indisponível.' } });
  await request(`chapter=${chapter + 1}`, 404);
  for (const query of ['', 'chapter=0', 'chapter=-1', 'chapter=1.5', 'chapter=2147483648',
    'chapter=01', 'chapter=1&chapter=2', 'chapter=1&limit=0', 'chapter=1&limit=51',
    'chapter=1&limit=2.5', 'chapter=1&limit=', 'chapter=1&cursor=', 'chapter=1&cursor=abc',
    'chapter=1&unknown=x', `chapter=${chapter}&cursor=${validCursor}`]) {
    await request(query, 400);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const response = await fetch(`${endpoint}?chapter=${chapter}`, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, OPTIONS');
    assertions++;
  }
  const preflight = await fetch(endpoint, { method: 'OPTIONS', headers: {
    Origin: 'https://example.test', 'Access-Control-Request-Method': 'GET',
  } });
  assert.ok([200, 204].includes(preflight.status));
  assert.equal(await preflight.text(), '');
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.ok(preflight.headers.get('access-control-allow-methods').includes('GET'));
  assertions++;
  const first = await request(`chapter=${chapter}`);
  assert.equal(first.comments.length, 20);
  assert.equal(first.clover_count, 1);
  assert.ok(first.next_cursor);
  assert.equal((await request(`chapter=${chapter}&limit=50`)).comments.length, 50);
  const all = [];
  let cursor;
  do {
    const page = await request(`chapter=${chapter}&limit=7${cursor ? '&cursor=' + cursor : ''}`);
    assert.equal(page.clover_count, 1);
    assert.deepEqual(Object.keys(page).sort(), ['chapter_number', 'clover_count', 'comments', 'has_left_clover', 'next_cursor']);
    assert.equal(page.has_left_clover, false);
    for (const comment of page.comments) {
      assert.deepEqual(Object.keys(comment).sort(), ['body', 'created_at', 'id', 'pseudonym']);
      assert.ok(!JSON.stringify(comment).includes(user));
    }
    all.push(...page.comments);
    cursor = page.next_cursor;
  } while (cursor);
  const expected = [...ids.slice(0, 30).sort(), ...ids.slice(30, 55).sort()];
  assert.deepEqual(all.map((row) => row.id), expected);
  assert.equal(new Set(all.map((row) => row.id)).size, 55);
  assert.ok(!all.some((row) => ids.slice(55).includes(row.id)));
  const descending = [];
  let descendingCursor;
  do {
    const page = await request(`chapter=${chapter}&order=desc&limit=7${descendingCursor ? '&cursor=' + descendingCursor : ''}`);
    descending.push(...page.comments);
    if (!descendingCursor && page.next_cursor) {
      await request(`chapter=${chapter}&cursor=${page.next_cursor}`, 400);
      await request(`chapter=${chapter}&order=asc&cursor=${page.next_cursor}`, 400);
    }
    descendingCursor = page.next_cursor;
  } while (descendingCursor);
  assert.deepEqual(descending.map(row => row.id), [...expected].reverse());
  assert.equal(new Set(descending.map(row => row.id)).size, 55);
  await request(`chapter=${chapter}&order=desc&cursor=${first.next_cursor}`, 400);
  for (const suffix of ['order=','order=invalid','order=asc&order=desc']) await request(`chapter=${chapter}&${suffix}`,400);
  console.log('PASS: validation, sanitized failures, public GET/OPTIONS, methods, disabled/missing chapters,');
  console.log('default/max limits, tied microsecond cursors, 55 published rows without gaps/duplicates,');
  console.log(`both directions, cross-order cursor rejection, hidden/removed exclusion, exact clover count, public field allowlist; ${assertions} HTTP checks.`);
} finally {
  sql(`begin;
    delete from public.chapter_clovers where chapter_number=${chapter} and user_id='${user}';
    delete from public.comments where chapter_number=${chapter} and author_id='${user}';
    delete from auth.users where id='${user}';
    delete from public.community_chapters where chapter_number in (${chapter},${chapter + 1});
    commit;`);
  console.log('Local synthetic fixtures removed.');
}
