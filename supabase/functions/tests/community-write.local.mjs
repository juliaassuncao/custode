// LOCAL ONLY. Real Auth/PostgREST/PostgreSQL; isolated HTTP server stubs Siteverify.
// The production Edge has no flag that enables this stub. Real CAPTCHA success is manual.
// node --experimental-transform-types supabase/functions/tests/community-write.local.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createCommunityWriteHandler } from '../_shared/community-write-handler.ts';
import { base, publicKey, serviceKey, fixtureJwt, sql } from './local-stack.mjs';

const actor = randomUUID();
const other = randomUUID();
const chapter = 2147483200;
let checks = 0;
let verifications = 0;
let rpcCalls = 0;
let dropRpcResponse = false;
const proofs = new Set();
const handler = createCommunityWriteHandler({
  env: (name) => ({ SUPABASE_URL:base, SUPABASE_SERVICE_ROLE_KEY:serviceKey,
    TURNSTILE_SECRET_KEY:'isolated-synthetic-secret' })[name],
  fetch: async (url, options) => {
    if (String(url) === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      verifications++;
      const params = options.body;
      assert.equal(params.get('remoteip'), null);
      assert.equal(params.get('secret'),'isolated-synthetic-secret');
      const token = params.get('response');
      const success = token.startsWith('fixture-') && !proofs.has(token);
      proofs.add(token);
      return Response.json(success ? {success:true} : {success:false,'error-codes':[
        token === 'invalid' ? 'invalid-input-response' : 'timeout-or-duplicate']});
    }
    const response = await fetch(url,options);
    if (String(url).includes('/rpc/')) {
      rpcCalls++;
      if (dropRpcResponse) { dropRpcResponse = false; throw new Error('Synthetic timeout after commit'); }
    }
    return response;
  },
});
const server = createServer(async (req,res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const response = await handler(new Request('http://local'+req.url, {
    method:req.method, headers:req.headers,
    ...(!['GET','HEAD'].includes(req.method) ? {body:Buffer.concat(chunks)} : {}),
  }));
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const endpoint = `http://127.0.0.1:${server.address().port}`;
const token = fixtureJwt(actor);
const fresh = () => 'fixture-'+randomUUID();
const comment = (extra={}) => ({ operation:'comment',chapter_number:chapter,pseudonym:' Guest ',
  body:' Text ',client_request_id:randomUUID(),...extra });
async function post(command,status=200,options={}) {
  const { jwt=token, proof=fresh(), target=endpoint } = options;
  const response = await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',
    apikey:publicKey,...(jwt ? {Authorization:`Bearer ${jwt}`} : {})},body:JSON.stringify({...command,captcha_token:proof})});
  const data = await response.json();
  assert.equal(response.status,status,`Expected HTTP ${status}; received ${response.status} (${data.error?.code ?? 'success'})`);
  assert.ok(!JSON.stringify(data).includes(actor),'identity must stay private');
  assert.ok(!JSON.stringify(data).includes(serviceKey),'key must stay private');
  checks++;
  return {data,response};
}
assert.equal(sql(`select count(*) from community_chapters where chapter_number in (${chapter},${chapter+1})`),'0');
const originalUsers = sql('select count(*) from auth.users');
try {
  sql(`begin; insert into auth.users(id,instance_id,is_anonymous,role,aud) values
    ('${actor}','00000000-0000-0000-0000-000000000000',true,'authenticated','authenticated'),
    ('${other}','00000000-0000-0000-0000-000000000000',true,'authenticated','authenticated');
    update auth.users set email=id::text||'@fixture.invalid',encrypted_password='',confirmation_token='',recovery_token='',
      email_change_token_new='',email_change='',raw_app_meta_data='{}',raw_user_meta_data='{}',
      created_at=now(),updated_at=now() where id in ('${actor}','${other}');
    insert into community_chapters(chapter_number,enabled) values (${chapter},true),(${chapter+1},false); commit;`);
  // Actual deployed local gateway + actual Auth + official Siteverify failure.
  const real = `${base}/functions/v1/community-write`;
  await post(comment(),401,{target:real,jwt:null});
  await post(comment(),401,{target:real,jwt:'invalid.jwt.token'});
  const realProof = await fetch(real,{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,
    Authorization:`Bearer ${token}`},body:JSON.stringify({...comment(),captcha_token:'invalid-real-turnstile-proof'})});
  assert.ok([403,503].includes(realProof.status),'real runtime must fail closed');
  const realProofError = (await realProof.json()).error?.code;
  assert.equal(realProofError, realProof.status===403 ? 'captcha_failed' : 'service_unavailable');
  const realCaptchaChecked = realProof.status===403;
  assert.equal(sql(`select count(*) from comments where author_id='${actor}'`),'0');
  const userResponse = await fetch(`${base}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:`Bearer ${token}`}});
  const verifiedUser = await userResponse.json();
  assert.equal(userResponse.status,200, `Local Auth fixture: ${verifiedUser.code ?? verifiedUser.error_code ?? 'unknown'} / ${verifiedUser.msg ?? 'no message'}`);
  assert.equal(verifiedUser.is_anonymous,true);

  await post(comment(),401,{jwt:null});
  await post(comment(),401,{jwt:'invalid.jwt.token'});
  await post(comment(),401,{jwt:fixtureJwt(actor,-60)});
  await post(comment(),401,{jwt:fixtureJwt(randomUUID())});
  assert.equal(verifications,0,'invalid sessions must never reach Siteverify');
  const malformed = [comment({body:''}),comment({body:' \n\t '}),comment({body:'x'.repeat(5001)}),
    comment({pseudonym:'x'}),comment({pseudonym:'x'.repeat(41)}),comment({pseudonym:'   '}),
    comment({author_id:other}),comment({status:'hidden'}),comment({client_request_id:'invalid'}),
    {operation:'clover',chapter_number:chapter,user_id:other},
    {operation:'report',comment_id:randomUUID(),reason_code:'invalid'},
    {operation:'report',comment_id:randomUUID(),reason_code:'spam',details:'x'.repeat(2001)}];
  for (const command of malformed) await post(command,400);
  assert.equal(verifications,0,'invalid payloads do not consume CAPTCHA');
  for (const proof of ['invalid','expired','already-used']) await post(comment(),403,{proof});
  assert.equal(rpcCalls,0,'failed CAPTCHA must never reach RPC');
  await post(comment({chapter_number:2147483647}),404);
  await post(comment({chapter_number:chapter+1}),404);
  await post({operation:'clover',chapter_number:chapter+1},404);

  // Timeout after a committed insert: retry must acknowledge exactly the same row.
  const first = comment({body:' <img src=x onerror=alert(1)> '});
  dropRpcResponse = true;
  await post(first,503);
  const retryProof = fresh();
  const retry = (await post(first,200,{proof:retryProof})).data;
  assert.equal(retry.replayed,true);
  await post(first,403,{proof:retryProof});
  assert.deepEqual(Object.keys(retry).sort(),['comment_id','created_at','operation','replayed']);
  assert.equal(sql(`select status||':'||body from comments where id='${retry.comment_id}'`),
    'published:<img src=x onerror=alert(1)>');
  assert.equal(sql(`select count(*) from comments where author_id='${actor}'`),'1');
  await post({...first,body:'changed'},409);
  const limited = await post(comment(),429);
  assert.ok(Number(limited.response.headers.get('retry-after'))>0);
  assert.equal(limited.response.headers.get('access-control-expose-headers'),'Retry-After');
  const read = await (await fetch(`${base}/functions/v1/community-read?chapter=${chapter}`)).json();
  assert.equal(read.comments[0].id,retry.comment_id);
  assert.equal(read.comments[0].body,'<img src=x onerror=alert(1)>');

  const clover = {operation:'clover',chapter_number:chapter};
  const leaves = await Promise.all(Array.from({length:8},()=>post(clover)));
  assert.equal(leaves.filter(({data})=>!data.already_left).length,1);
  for (const {data} of leaves) assert.equal(data.clover_count,1);
  const report = {operation:'report',comment_id:retry.comment_id,reason_code:'spam',details:'optional'};
  const reports = await Promise.all(Array.from({length:8},()=>post(report)));
  assert.equal(reports.filter(({data})=>!data.already_reported).length,1);
  for (const {data} of reports) assert.deepEqual(Object.keys(data).sort(),['already_reported','operation','reported']);
  assert.equal(sql(`select status from comments where id='${retry.comment_id}'`),'published');
  await post({...report,comment_id:randomUUID()},404);
  // Reserve fixtures only; never change real users' timestamps or quotas.
  sql(`update community_private.rate_events set occurred_at=clock_timestamp()-interval '31 seconds' where actor_id='${actor}' and kind='comment'`);
  const simultaneous = comment();
  const publications = await Promise.all(Array.from({length:8},()=>post(simultaneous)));
  assert.equal(new Set(publications.map(({data})=>data.comment_id)).size,1);
  assert.equal(publications.filter(({data})=>!data.replayed).length,1);
  sql(`delete from community_private.rate_events where actor_id='${actor}' and kind='comment';
    insert into community_private.rate_events(actor_id,kind,occurred_at)
    select '${actor}','comment',clock_timestamp()-make_interval(secs=>60*i) from generate_series(1,9) i;`);
  const atLimit = await Promise.all(Array.from({length:8},async()=> {
    const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({...comment(),captcha_token:fresh()})});
    return response.status;
  }));
  assert.equal(atLimit.filter((s)=>s===200).length,1);
  assert.equal(atLimit.filter((s)=>s===429).length,7);
  sql(`update community_private.rate_events set occurred_at=occurred_at-interval '31 seconds' where actor_id='${actor}' and kind='comment'`);
  await post(comment(),429); // hourly cap, beyond cooldown
  sql(`delete from community_private.rate_events where actor_id='${actor}' and kind='report';
    insert into community_private.rate_events(actor_id,kind,occurred_at)
    select '${actor}','report',clock_timestamp()-interval '1 minute' from generate_series(1,4);`);
  const targets = Array.from({length:6},()=>randomUUID());
  sql(targets.map((id)=>`insert into comments(id,chapter_number,author_id,pseudonym,body,client_request_id)
    values('${id}',${chapter},'${other}','Fixture','Target','${randomUUID()}');`).join('\n'));
  const reportLimit = await Promise.all(targets.map(async(id)=> {
    const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({...report,comment_id:id,captcha_token:fresh()})}); return response.status;
  }));
  assert.equal(reportLimit.filter((s)=>s===200).length,1);
  assert.equal(reportLimit.filter((s)=>s===429).length,5);
  await post(report); // duplicate acknowledged even at limit

  for (const jwt of [publicKey,token]) {
    for (const table of ['comments','chapter_clovers','comment_reports']) {
      const response = await fetch(`${base}/rest/v1/${table}`,{method:'POST',headers:{apikey:publicKey,
        Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:'{}'});
      assert.ok([401,403].includes(response.status),'direct table writes forbidden'); checks++;
    }
    const response = await fetch(`${base}/rest/v1/rpc/community_mutate`,{method:'POST',headers:{apikey:publicKey,
      Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_actor:actor,p_operation:'clover',p_input:{chapter_number:chapter}})});
    assert.ok([401,403,404].includes(response.status),'direct privileged RPC forbidden'); checks++;
  }
  const privateResponse = await fetch(`${base}/rest/v1/rate_events`,{headers:{apikey:publicKey,Authorization:`Bearer ${token}`,'Accept-Profile':'community_private'}});
  assert.equal(privateResponse.status,406);
  const preflight = await fetch(endpoint,{method:'OPTIONS'});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-methods'),'POST, OPTIONS');
  console.log(`PASS: ${checks} HTTP checks; real anonymous Auth and gateway rejection;`);
  console.log(realCaptchaChecked ? 'Real Siteverify rejected invalid proof.' :
    'Manual pending: configure TURNSTILE_SECRET_KEY in Edge runtime; real endpoint safely returns 503.');
  console.log('isolated Siteverify success/expiry/reuse, real transactional RPC, committed-timeout retry, payload tampering,');
  console.log('concurrent duplicate comments/clovers/reports, concurrent hourly limits, direct Data API/RPC denial.');
} finally {
  await new Promise((resolve)=>server.close(resolve));
  sql(`begin;
    delete from comment_reports where reporter_id in ('${actor}','${other}');
    delete from chapter_clovers where user_id in ('${actor}','${other}');
    delete from community_private.rate_events where actor_id in ('${actor}','${other}');
    delete from comments where author_id in ('${actor}','${other}');
    delete from auth.users where id in ('${actor}','${other}');
    delete from community_chapters where chapter_number in (${chapter},${chapter+1}); commit;`);
  assert.equal(sql('select count(*) from auth.users'),originalUsers,'existing anonymous identities preserved');
  console.log('Synthetic fixtures removed; existing Auth identities preserved.');
}
