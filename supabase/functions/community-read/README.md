# Public community read

Local URL: `GET http://127.0.0.1:54321/functions/v1/community-read?chapter=1`.
No session, API key or Authorization header is required. Only this function has
`verify_jwt = false` in [the gateway configuration](../../config.toml).
CORS allows credential-free public reads from any origin; it is not authorization.
The privileged key is read only from the Edge Function environment, never from callers.

Parameters (unknown and repeated parameters are rejected):

- `chapter`: required positive PostgreSQL integer; chapter must exist and be enabled.
- `limit`: integer from 1 to 50, default 10 with `page`, otherwise 20; larger values return 400.
- `page`: optional integer from 1 to 2147483647 for direct numbered pagination. Cannot be combined with `cursor`.
- `cursor`: optional opaque continuation returned by the previous page, bound to the chapter.
- `order`: `asc` (default, oldest first) or `desc` (newest first). Unknown/empty/repeated values return 400.

Response: `{ chapter_number, comments: [{ id, pseudonym, body, created_at }],
clover_count, has_left_clover, next_cursor }`. `next_cursor` is null at the end.
Requests with `page` also return `{ page, limit, total_count, total_pages }`.
The count includes only published comments for this chapter. Empty chapters have
one empty page; requests beyond the last page are adjusted to the last valid page.
The chapter UI requests `page` with `limit=10` and replaces the displayed rows.
Comments are untrusted plain text: consumers must render them as text, never HTML.
The clover count covers the whole chapter, not only the current page.

Optional personalization (4C): send `Authorization: Bearer <user JWT>` to recover
`has_left_clover` from the database. The Edge validates the session with Auth and
uses only that verified user ID for an existence lookup. No identity is returned.
Without Authorization the field is false and reading remains public. An invalid
or expired JWT returns 401; an Auth infrastructure failure returns a generic 500.
No user ID query parameter is accepted. No new tables, grants or migrations.

Ordering uses `(created_at, id)` in the selected direction. Both keys use the same direction.
Numbered requests use a bounded `limit`/`offset` query with `Prefer: count=exact`,
obtaining the published total in the same read. Only an out-of-range page needs
a second bounded comments query. No comments are loaded just to count or skip them
in the browser. Requests without `page` keep the strict keyset boundary
(`>` for asc, `<` for desc) and their existing response shape.
Existing v1 ascending cursors remain valid. Descending v2 cursors include their
direction; crossing chapter or direction returns 400. Changing order must start
without a cursor. Pagination returns the selected order from the server, never
by reversing already loaded rows in the browser.
Timestamp microseconds are preserved. Cursors are validated, not signed: changing
a valid cursor may reposition a public listing but never grants access to other data.
This is a live listing, not a snapshot: moderation, edits to sort keys and backdated
inserts between requests can change visible results. Counts and comments are separate
reads for cursor requests; numbered requests count and read comments together.
Every request filters `published` again, and responses use `Cache-Control: no-store`.

Errors: 400 invalid parameters/cursor; 404 absent or disabled chapter;
405 non-GET method (`Allow: GET, OPTIONS`); 500 generic internal failure.
The handler returns 204 for OPTIONS; the local Kong gateway may intercept preflight
and return 200 empty with its own CORS headers (including a broader method list).
Actual non-GET operations still return 405 from the handler.
Database details and credentials are never included in errors.
The current migration allows only `published`, `hidden`, `removed`; `pending` and
`rejected` are rejected by the database, and this endpoint uses a positive published filter.

## Publishing the numbered contract

Publishing the frontend does not publish this Edge Function. The numbered UI
requires the current [handler](./index.ts) and [parameter validator](../_shared/validation.ts)
to be deployed together as `community-read`, including the imported
[CORS](../_shared/cors.ts) and [response](../_shared/response.ts) helpers.
The CLI bundles these imports; the shared validator is not a separate function.
Keep `verify_jwt = false` for this public read endpoint, as already configured in
[config.toml](../../config.toml). Optional session verification remains in the handler.

After explicit authorization, from the repository root with an authenticated CLI:

```sh
npx supabase functions deploy community-read --remote=PROJECT_REF --no-verify-jwt
```

With CLI 3, replace `PROJECT_REF` with the reference of the same project used by
the production frontend (see the [CLI reference](https://supabase.com/docs/reference/cli/supabase-functions-deploy)). This
requires no migrations, data changes, new secrets or deployment of `community-write`.
Confirm with a public GET (no Authorization or API key) using
`?chapter=1&order=desc&page=1&limit=10`: expect 200 and the `page`, `limit`,
`total_count`, `total_pages` fields. A 200 without `page` but a 400
`invalid_parameters` with `page` identifies an older parameter contract.
Do not fall back to loading all comments or walking cursors in the browser.

## Local validation

From the repository root, with the local stack already running:

```sh
npx supabase functions serve community-read
# In another terminal (Docker must be on PATH):
node --experimental-strip-types supabase/functions/tests/community-read.local.mjs
npm run build
git diff --check
```

The test runner uses only the hardcoded local HTTP URL and local Docker DB container.
It refuses existing fixture chapter numbers, creates synthetic rows for HTTP visibility,
and removes them in `finally`. If interrupted forcibly, inspect chapter numbers
2147483000 and 2147483001 before re-running. It never resets the database or changes grants.
