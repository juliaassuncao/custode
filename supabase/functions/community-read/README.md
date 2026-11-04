# Public community read

Local URL: `GET http://127.0.0.1:54321/functions/v1/community-read?chapter=1`.
No session, API key or Authorization header is required. Only this function has
`verify_jwt = false` in [the gateway configuration](../../config.toml).
CORS allows credential-free public reads from any origin; it is not authorization.
The privileged key is read only from the Edge Function environment, never from callers.

Parameters (unknown and repeated parameters are rejected):

- `chapter`: required positive PostgreSQL integer; chapter must exist and be enabled.
- `limit`: integer from 1 to 50, default 20; larger values return 400.
- `cursor`: optional opaque continuation returned by the previous page, bound to the chapter.
- `order`: `asc` (default, oldest first) or `desc` (newest first). Unknown/empty/repeated values return 400.

Response: `{ chapter_number, comments: [{ id, pseudonym, body, created_at }],
clover_count, has_left_clover, next_cursor }`. `next_cursor` is null at the end.
Comments are untrusted plain text: consumers must render them as text, never HTML.
The clover count covers the whole chapter, not only the current page.

Optional personalization (4C): send `Authorization: Bearer <user JWT>` to recover
`has_left_clover` from the database. The Edge validates the session with Auth and
uses only that verified user ID for an existence lookup. No identity is returned.
Without Authorization the field is false and reading remains public. An invalid
or expired JWT returns 401; an Auth infrastructure failure returns a generic 500.
No user ID query parameter is accepted. No new tables, grants or migrations.

Ordering uses `(created_at, id)` in the selected direction with a strict keyset
boundary (`>` for asc, `<` for desc), not offset. Both keys use the same direction.
Existing v1 ascending cursors remain valid. Descending v2 cursors include their
direction; crossing chapter or direction returns 400. Changing order must start
without a cursor. Pagination returns the selected order from the server, never
by reversing already loaded rows in the browser.
Timestamp microseconds are preserved. Cursors are validated, not signed: changing
a valid cursor may reposition a public listing but never grants access to other data.
This is a live listing, not a snapshot: moderation, edits to sort keys and backdated
inserts between requests can change visible results. Counts and comments are separate
reads. Every request filters `published` again, and responses use `Cache-Control: no-store`.

Errors: 400 invalid parameters/cursor; 404 absent or disabled chapter;
405 non-GET method (`Allow: GET, OPTIONS`); 500 generic internal failure.
The handler returns 204 for OPTIONS; the local Kong gateway may intercept preflight
and return 200 empty with its own CORS headers (including a broader method list).
Actual non-GET operations still return 405 from the handler.
Database details and credentials are never included in errors.
The current migration allows only `published`, `hidden`, `removed`; `pending` and
`rejected` are rejected by the database, and this endpoint uses a positive published filter.

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
