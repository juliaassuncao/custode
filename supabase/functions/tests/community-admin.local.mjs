// LOCAL ONLY. Real Auth + PostgREST + PostgreSQL, production handler with native fetch.
// Fresh UUIDs; collision guard; cleanup matches ONLY this run's committed identities.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { base, serviceKey, publicKey, fixtureJwt, sql } from './local-stack.mjs';
import { createCommunityAdminHandler } from '../_shared/community-admin-handler.ts';

const actors=Array.from({length:5},()=>randomUUID());
const [moderator,moderatorTwo,inactive,reader,anonymous]=actors;
const chapter=2147483500, comment=randomUUID(), report=randomUUID();
const usersBefore=sql('select count(*) from auth.users');
assert.equal(sql(`select count(*) from community_chapters where chapter_number=${chapter}`),'0','fixture chapter must not exist');
let created=false, checks=0;
const handler=createCommunityAdminHandler({env:name=>({SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:serviceKey})[name],fetch});
const checkGateway=process.argv.includes('--gateway');
const token=id=>fixtureJwt(id);
async function call(id,body,status=200,query=null,jwt=token(id)) {
  const response=await handler(new Request(base+'/functions/v1/community-admin'+(query?'?'+query:''),{
    method:query?'GET':'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},
    ...(!query?{body:JSON.stringify(body)}:{})}));
  assert.equal(response.status,status,`Unexpected admin response (${(await response.clone().json()).error?.code ?? 'success'})`);
  const data=await response.json();
  const output=JSON.stringify(data);
  for(const privateId of [reader,anonymous]) assert.ok(!output.includes(privateId),'reader Auth identity leaked');
  assert.ok(!output.includes(serviceKey),'credential leaked'); checks++;
  return data;
}
const command=(operation,target_id,expected_version,note)=>({operation,target_id,expected_version,request_id:randomUUID(),...(note?{note}:{})});
try {
  sql(`begin;
    ${actors.map((id,i)=>`insert into auth.users(id,instance_id,is_anonymous,role,aud,email,encrypted_password,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values('${id}','00000000-0000-0000-0000-000000000000',${i===4},'authenticated','authenticated','${id}@fixture.invalid','','','','','','{}','{}',now(),now());`).join('\n')}
    insert into community_moderators(user_id,active) values('${moderator}',true),('${moderatorTwo}',true),('${inactive}',false),('${anonymous}',true);
    insert into community_chapters(chapter_number) values(${chapter});
    insert into comments(id,chapter_number,author_id,pseudonym,body,client_request_id)
      values('${comment}',${chapter},'${reader}','Synthetic','Local admin test','${randomUUID()}');
    insert into comment_reports(id,comment_id,reporter_id,reason_code) values('${report}','${comment}','${reader}','spam');
    commit;`);
  created=true;
  for(const actor of [inactive,reader,anonymous]) {
    await call(actor,null,403,'resource=comments');
    await call(actor,command('hide_comment',comment,0,'spam'),403);
  }
  await call(moderator,null,401,'resource=comments','invalid.jwt');
  await call(moderator,null,401,'resource=comments',fixtureJwt(moderator,-60));
  await call(moderator,{...command('hide_comment',comment,0,'spam'),moderator_id:moderatorTwo},400);
  if(checkGateway) {
    const gatewayRead=await fetch(`${base}/functions/v1/community-admin?resource=comments&chapter=${chapter}`,{
      headers:{apikey:publicKey,Authorization:`Bearer ${token(moderator)}`}});
    assert.equal(gatewayRead.status,200,'local Edge gateway must serve community-admin');
    assert.equal((await gatewayRead.json()).items[0].id,comment); checks++;
  }
  const hide=command('hide_comment',comment,0,'spam');
  // Concurrent identical retries: one update, one audit, all callers recover same result.
  const repeated=await Promise.all(Array.from({length:8},()=>call(moderator,hide)));
  assert.equal(repeated.filter(result=>!result.replayed).length,1);
  assert.equal(new Set(repeated.map(result=>result.audit_id)).size,1);
  if(checkGateway) {
    const gatewayRetry=await fetch(`${base}/functions/v1/community-admin`,{method:'POST',
      headers:{apikey:publicKey,Authorization:`Bearer ${token(moderator)}`,'Content-Type':'application/json'},body:JSON.stringify(hide)});
    assert.equal(gatewayRetry.status,200); assert.equal((await gatewayRetry.json()).replayed,true); checks++;
  }
  const hidden=await call(moderator,null,200,`resource=comments&chapter=${chapter}&status=hidden`);
  assert.equal(hidden.items[0].moderation_version,1);
  const publicRead=()=>fetch(`${base}/functions/v1/community-read?chapter=${chapter}`).then(response=>response.json());
  assert.equal((await publicRead()).comments.length,0);
  const restore=command('restore_comment',comment,1);
  await call(moderatorTwo,restore);
  assert.equal((await publicRead()).comments[0].id,comment);
  // Two moderators act on the same version; loser must conflict, not overwrite.
  const contenders=await Promise.all([moderator,moderatorTwo].map(async actor=>{
    const response=await handler(new Request(base+'/functions/v1/community-admin',{method:'POST',
      headers:{Authorization:`Bearer ${token(actor)}`,'Content-Type':'application/json'},
      body:JSON.stringify(command('hide_comment',comment,2,'review'))}));
    return response.status;
  }));
  assert.deepEqual(contenders.sort(),[200,409]);
  assert.equal(sql(`select moderation_version from comments where id='${comment}'`),'3');
  assert.equal(sql(`select count(*) from moderation_audit where comment_id='${comment}'`),'3');
  const reportContenders=await Promise.all(['resolve_report','dismiss_report'].map(async(operation,i)=>{
    const response=await handler(new Request(base+'/functions/v1/community-admin',{method:'POST',
      headers:{Authorization:`Bearer ${token(actors[i])}`,'Content-Type':'application/json'},
      body:JSON.stringify(command(operation,report,0))})); return response.status;
  }));
  assert.deepEqual(reportContenders.sort(),[200,409]);
  assert.equal(sql(`select count(*) from moderation_audit where report_id='${report}'`),'1');
  assert.equal(sql(`select status from comments where id='${comment}'`),'hidden');
  // Lose an actual committed RPC response, then recover using the same request.
  const uncertainRestore=command('restore_comment',comment,3);
  const lossy=createCommunityAdminHandler({env:name=>({SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:serviceKey})[name],
    fetch:async(url,options)=>{const response=await fetch(url,options);
      if(String(url).includes('community_admin_mutate') && response.ok) throw new Error('synthetic lost response after commit');
      return response;}});
  const uncertain=await lossy(new Request(base+'/functions/v1/community-admin',{method:'POST',
    headers:{Authorization:`Bearer ${token(moderatorTwo)}`,'Content-Type':'application/json'},body:JSON.stringify(uncertainRestore)}));
  assert.equal(uncertain.status,503);
  const recovered=await call(moderatorTwo,uncertainRestore);
  assert.equal(recovered.replayed,true); assert.equal(recovered.state.status,'published');
  assert.equal(sql(`select count(*) from moderation_audit where comment_id='${comment}'`),'4');
  const reports=await call(moderator,null,200,`resource=reports&chapter=${chapter}`);
  assert.equal(reports.items[0].comment.id,comment);
  const history=await call(moderator,null,200,`resource=history&chapter=${chapter}&limit=1`);
  const next=await call(moderator,null,200,`resource=history&chapter=${chapter}&cursor=${history.next_cursor}`);
  assert.equal(next.items.length,4);
  assert.ok(next.items.every(item=>item.id!==history.items[0].id));
  await call(moderator,null,400,`resource=comments&cursor=${history.next_cursor}`);
  // Actual Data API grants; even trusted Edge credentials cannot bypass the RPC.
  for(const table of ['comments','comment_reports']) {
    const response=await fetch(`${base}/rest/v1/${table}?id=eq.${table==='comments'?comment:report}`,{
      method:'PATCH',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({status:table==='comments'?'published':'open'})});
    assert.equal(response.status,403); checks++;
  }
  const denied=await fetch(`${base}/rest/v1/rpc/community_admin_read`,{method:'POST',headers:{apikey:publicKey,
    Authorization:`Bearer ${token(moderator)}`,'Content-Type':'application/json'},body:JSON.stringify({p_actor:moderator,p_input:{resource:'comments'}})});
  assert.equal(denied.status,403); checks++;
  console.log(`PASS: ${checks} administrative Auth/HTTP checks; 8 simultaneous retries; two-moderator comment/report races; public visibility; direct UPDATE/RPC denial.`);
  console.log(checkGateway ? 'Local Edge gateway verified.' : 'Edge gateway check not requested; run again with --gateway after serving community-admin locally.');
} finally {
  if(created) sql(`begin;
    delete from moderation_audit where moderator_id in ('${moderator}','${moderatorTwo}');
    delete from comment_reports where id='${report}' and reporter_id='${reader}';
    delete from comments where id='${comment}' and author_id='${reader}';
    delete from community_moderators where user_id in ('${actors.join("','")}');
    delete from auth.users where id in ('${actors.join("','")}');
    delete from community_chapters where chapter_number=${chapter}; commit;`);
  assert.equal(sql('select count(*) from auth.users'),usersBefore,'existing identities preserved');
  console.log('Only this run’s synthetic administrative fixtures removed.');
}
