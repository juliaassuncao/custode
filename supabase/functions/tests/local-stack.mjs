import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

export function docker(args, input) {
  const result = spawnSync(process.env.LOCAL_DOCKER_BIN || 'docker', args, { input, encoding: 'utf8' });
  // Never include inspect output or input SQL in errors: both may contain secrets.
  assert.equal(result.status, 0, 'Local Docker command failed');
  return result.stdout.trim();
}
export function sql(query) {
  return docker(['exec','-i','supabase_db_custode-community','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'], query);
}
function environment(container) {
  const config = JSON.parse(docker(['inspect',container]));
  return Object.fromEntries(config[0].Config.Env.map((entry) => {
    const i = entry.indexOf('='); return [entry.slice(0,i),entry.slice(i+1)];
  }));
}
export const base = 'http://127.0.0.1:54321';
const runtime = environment('supabase_edge_runtime_custode-community');
const auth = environment('supabase_auth_custode-community');
export const publicKey = runtime.SUPABASE_ANON_KEY;
export const serviceKey = runtime.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(publicKey && serviceKey && auth.GOTRUE_JWT_SECRET, 'Local legacy test credentials required');
export function fixtureJwt(id, expiration = 600) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const raw = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,role:'authenticated',aud:'authenticated',
    is_anonymous:true,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+expiration})}`;
  return `${raw}.${createHmac('sha256',auth.GOTRUE_JWT_SECRET).update(raw).digest('base64url')}`;
}
