# Community — anonymous participation infrastructure (4B)

The reader integration (4C), its files, validation and manual checks are documented
in [INTEGRATION.md](./INTEGRATION.md). ChapterCommunity now mounts lazily after
chapter loading, below bottom navigation and the index link. Participation remains
explicit; no signup or Turnstile is triggered by reading alone.

Write operations and the isolated preview are documented in the
[community-write contract](../../../supabase/functions/community-write/README.md).
That document supersedes the historical auth-only notes below for mutations,
Edge secrets and current tests. Real write homologation remains pending.

## Historical auth-only stage notes

The notes below describe the earlier auth-only stage; the integration document
supersedes its statements about production mounting and writes.

No production screen mounted this infrastructure at that stage. Reading a chapter must not
call `ensureSession` or mount the challenge. No pseudonym or participation data is
written in this stage. An anonymous Auth identity is not a traditional account:
there is no email/password UI. It is still an Auth user; clearing browser storage
loses access to that identity. Do not automatically sign out or replace identities.

## Local configuration

The installed CLI was checked: **3.0.0**. Its shipped config template/parser and
Auth environment mapping support these exact fields in
[config.toml](../../../supabase/config.toml):

```toml
[auth]
enable_anonymous_sign_ins = true

[auth.captcha]
enabled = true
provider = "turnstile"
secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"
```

The CLI maps this section to `GOTRUE_SECURITY_CAPTCHA_ENABLED`,
`GOTRUE_SECURITY_CAPTCHA_PROVIDER`, `GOTRUE_SECURITY_CAPTCHA_SECRET` in the local
Auth container. Do not edit Docker-generated files or validate CAPTCHA inside
the frontend/Edge Function: Supabase Auth verifies the token with Cloudflare.

Frontend configuration: add `VITE_TURNSTILE_SITE_KEY` to your ignored root
`.env.local`, alongside the existing **local** Supabase public configuration.
Use the site key of a Turnstile widget that allows your local hostname. Public
keys are not secrets. Never put the Turnstile Secret Key in a `VITE_` variable.
See the [public template](../../../.env.example).

Private configuration: provide `SUPABASE_AUTH_CAPTCHA_SECRET` only to the CLI/Auth
environment. One option is a private `supabase/.env` created from the
[private template](../../../supabase/.env.example). Do not overwrite an existing
file; add the variable locally without displaying its contents. Both this file
and root `.env.local` are ignored by the existing [.gitignore](../../../.gitignore).
Alternatively, enter it in the CLI's process environment with secure input:

```powershell
$turnstileSecret = Read-Host 'Local Turnstile Secret Key' -AsSecureString
$turnstilePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($turnstileSecret)
try {
  $env:SUPABASE_AUTH_CAPTCHA_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($turnstilePointer)
  # Schedule this interruption of the LOCAL stack; no --no-backup and no db reset.
  npx supabase stop
  if ($LASTEXITCODE -ne 0) { throw 'Local stop failed' }
  npx supabase start
  if ($LASTEXITCODE -ne 0) { throw 'Local start failed' }
} finally {
  Remove-Item Env:SUPABASE_AUTH_CAPTCHA_SECRET -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($turnstilePointer)
  $turnstileSecret.Dispose()
}
```

Run from the repository root with Docker on PATH. Supply the private environment
variable for later CLI commands as well; the config intentionally fails closed
when its secret is missing. `stop` without `--no-backup` preserves local database
data. `start` can apply pending migrations: inspect them before restarting (4B
adds none). Restart any locally served Edge Functions and Vite after restarting
the stack. This procedure was **not run** during implementation: no real secret
was provided or read, and the existing Auth container still had anonymous sign-in
and CAPTCHA disabled. Changing TOML alone does not reconfigure a running container.

Confirm only non-secret flags after activation:

```sh
docker exec supabase_auth_custode-community printenv GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED GOTRUE_SECURITY_CAPTCHA_ENABLED GOTRUE_SECURITY_CAPTCHA_PROVIDER
```

Expected: `true`, `true`, `turnstile`. Never print the secret environment variable,
dump the container environment or paste `supabase status` credentials into logs.

## Consumption contract

- `useAnonymousSession()` recovers storage and listens for auth changes, without
  signup on mount. States: `idle`, `loading`, `authenticated`, `error`; errors have
  safe `code` and `message`. No Session/User object, user ID or bearer token is exposed.
- On an explicit participation action, first call `ensureSession()` to reuse a
  valid session. If `captcha_required`, mount `TurnstileChallenge`. Its `onToken`
  supplies a short-lived token or null; keep it only in a ref, not storage/URLs/logs.
- On explicit confirmation, pass that token to `ensureSession(token)`. The service
  rechecks the existing session before consuming the token, then calls exactly
  `auth.signInAnonymously({ options: { captchaToken } })`. Catch the promise rejection;
  render the safe hook error. Do not automatically resubmit on token delivery.
- `TurnstileChallenge` exposes `reset()` through a ref and includes a retry button.
  Tokens expire within five minutes, on provider expiry/error or unmount, and are
  marked consumed before signup even if the network fails. A new attempt requires
  a fresh challenge. Validating the local token registry is only a lifecycle guard;
  server-side CAPTCHA verification is the security boundary.
- One module-level store/promise serializes hook instances and StrictMode remounts.
  Web Locks also serialize tabs on the same origin where supported. Without Web
  Locks the deduplication guarantee is within one JavaScript context, not all tabs.
- The existing client already has `persistSession` and `autoRefreshToken` enabled.
  Recovery/refresh failures do not create replacement identities. Non-anonymous
  sessions are preserved and reported as `non_anonymous_session`.

## Tests and limits

Automated service tests (mock Auth plus the real SDK with mocked HTTP/storage):

```sh
node --test src/features/community/tests/anonymousSession.test.mjs
npm run build
git diff --check
```

Browser harness: start Vite with only synthetic public test values, using a spare
local port. Do not use this process for real Auth integration:

```powershell
$env:VITE_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY = 'local-browser-test-placeholder'
$env:VITE_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'
npx vite --host 127.0.0.1 --port 5174 --strictPort
```

Open that local URL and run in browser DevTools (the harness creates/removes its
own temporary root, never modifies application components):

```js
const harness = await import('/src/features/community/tests/turnstile.browser.tsx');
await harness.runCommunityBrowserTests();
```

The browser harness mocks Cloudflare and injects an isolated Auth store. It checks
lazy/single script loading, failure/retry, token delivery/expiry/consumption, widget
errors, reset, late callbacks, widget removal, and hook cleanup/no signup under
React StrictMode. Service tests cover persistence across new SDK client instances,
strict `is_anonymous`, concurrent calls, restoration races, refresh and network errors.
These tests do not prove real Cloudflare or real local Auth acceptance.

**Manual integration pending**, after provisioning matching site/secret keys and
restarting Auth: mount the standalone challenge in an isolated local test harness,
use the real `anonymousSession` service, and verify the following without printing
tokens or IDs:

1. Opening/navigating chapters or merely mounting the hook sends no signup request.
2. A user-initiated request with a fresh successful challenge creates one identity;
   the service status becomes `authenticated` and `user.is_anonymous` is true when
   inspected internally in a debugger. Two simultaneous actions still send one signup.
3. Reload with storage preserved, or request another action: recover the same
   identity without a new signup/challenge. The SDK tests simulate this already.
4. In a separate disposable browser profile with no session, try missing, invalid,
   expired and already submitted CAPTCHA proofs. Both the service lifecycle guard
   and direct requests to the **local** Auth endpoint must reject inappropriate
   signup attempts; failed network attempts require a fresh proof.
5. Block Cloudflare/script loading and then local Auth requests, verifying safe
   retry states. Reload/unmount in StrictMode must leave no widget/auth listener.

Do not infer CAPTCHA protection from a frontend success alone. The direct Auth
request without a valid CAPTCHA must fail after activation. Cloudflare's published
dummy keys can test plumbing, but always-pass keys do not establish real expiry,
single-use or bot protection; perform those checks with a real locally allowed widget.
No new session, CAPTCHA provider call, secret provisioning or local Auth restart
was performed as part of the mocked tests.

References: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous),
[local config](https://supabase.com/docs/guides/local-development/cli/config),
[Turnstile explicit rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/),
[token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
