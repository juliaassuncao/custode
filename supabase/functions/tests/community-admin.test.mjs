import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityAdminHandler, parseAdminMutation, parseAdminRead } from '../_shared/community-admin-handler.ts';

const moderator = '00000000-0000-4000-8000-000000000111';
const command = { operation:'hide_comment', target_id:'00000000-0000-4000-8000-000000000112',
  request_id:'00000000-0000-4000-8000-000000000113', expected_version:0, note:'spam' };
function setup({ user = {id:moderator,role:'authenticated',is_anonymous:false}, authStatus=200, rpcStatus=200,
  result={audit_id:'audit',target_id:command.target_id,state:{status:'hidden',version:1},replayed:false} }={}) {
  const calls=[];
  const handler=createCommunityAdminHandler({env:name=>name==='SUPABASE_URL'?'http://local.invalid':'synthetic-backend-key',
    fetch:async(url,options)=>{
      calls.push({url:String(url),options});
      return Response.json(String(url).includes('/auth/')?user:result,{status:String(url).includes('/auth/')?authStatus:rpcStatus});
    }});
  const request=(body=command,token='valid.jwt',method='POST',query='')=>handler(new Request('http://local.invalid/admin'+query,
    {method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},
      ...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  return {calls,request};
}
test('active moderator identity comes exclusively from validated Auth user',async()=>{
  const {request,calls}=setup(); const response=await request(); assert.equal(response.status,200);
  assert.equal(JSON.parse(calls[1].options.body).p_actor,moderator);
  assert.equal(calls[0].options.headers.Authorization,'Bearer valid.jwt');
  assert.ok(!JSON.stringify(await response.json()).includes('synthetic-backend-key'));
});
test('missing, invalid and expired tokens fail before administrative RPC',async()=>{
  for(const status of [401,403]) { const {request,calls}=setup({authStatus:status}); assert.equal((await request()).status,401); assert.equal(calls.length,1); }
  const {request,calls}=setup(); assert.equal((await request(command,null)).status,401); assert.equal(calls.length,0);
});
test('anonymous and ambiguous Auth identities fail closed',async()=>{
  for(const is_anonymous of [true,undefined,null]) {
    const {request,calls}=setup({user:{id:moderator,role:'authenticated',is_anonymous}});
    assert.equal((await request()).status,403); assert.equal(calls.length,1);
  }
});
test('membership rejection from database denies both reads and writes',async()=>{
  for(const method of ['GET','POST']) { const {request}=setup({rpcStatus:403});
    assert.equal((await request(command,'valid.jwt',method,method==='GET'?'?resource=comments':'')).status,403); }
});
test('moderator_id and unknown fields cannot be supplied in mutations or reads',async()=>{
  const {request,calls}=setup(); assert.equal((await request({...command,moderator_id:moderator})).status,400);
  assert.equal((await request(command,'valid.jwt','GET','?resource=comments&moderator_id=forged')).status,400);
  assert.equal(calls.filter(call=>call.url.includes('/rpc/')).length,0);
});
test('mutation validation requires reason, version and request UUID; removal unavailable',()=>{
  for(const extra of [{note:''},{note:'  '},{note:'x'.repeat(2001)},{expected_version:-1},{expected_version:null},
    {request_id:'invalid'},{operation:'remove_comment'},{expected_version:1.2}]) assert.throws(()=>parseAdminMutation({...command,...extra}));
  for(const operation of ['restore_comment','resolve_report','dismiss_report']) assert.doesNotThrow(()=>parseAdminMutation({...command,operation,note:''}));
});
test('conflicts and uncertain failures are sanitized and keep retry semantics',async()=>{
  for(const error of ['state_conflict','idempotency_conflict']) {
    const {request}=setup({result:{error}}); assert.equal((await request()).status,409);
  }
  const {request}=setup({rpcStatus:500,result:{message:'private database detail'}});
  const response=await request(); assert.equal(response.status,503); assert.ok(!JSON.stringify(await response.json()).includes('private database'));
});
test('admin query validation and cursor transport preserve microseconds',async()=>{
  const cursor={v:1,scope:{resource:'comments',status:null,chapter:null},created_at:'2026-11-03T00:00:00.123456+00:00',id:command.target_id};
  const {request,calls}=setup({result:{items:[],next_cursor:cursor}});
  const response=await request(command,'valid.jwt','GET','?resource=comments&limit=1');
  assert.equal(response.status,200); const result=await response.json();
  assert.deepEqual(JSON.parse(atob(result.next_cursor.replace(/-/g,'+').replace(/_/g,'/'))),cursor);
  const input=parseAdminRead(new URL('http://local.invalid/?resource=comments&cursor='+result.next_cursor));
  assert.deepEqual(input.cursor,cursor); assert.equal(JSON.parse(calls[1].options.body).p_actor,moderator);
  for(const query of ['resource=comments&limit=51','resource=history&status=open','resource=comments&chapter=0',
    'resource=reports&status=hidden','resource=comments&limit=1&limit=2','resource=comments&cursor=@@']) assert.throws(()=>parseAdminRead(new URL('http://local.invalid/?'+query)));
});
test('preflight and unsupported methods expose correct methods',async()=>{
  const {request,calls}=setup(); assert.equal((await request(null,null,'OPTIONS')).status,204);
  const response=await request(null,null,'DELETE'); assert.equal(response.status,405); assert.equal(response.headers.get('Allow'),'GET, POST, OPTIONS'); assert.equal(calls.length,0);
});
