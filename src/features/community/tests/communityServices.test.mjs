// No .env, network, database or real identity is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';

globalThis.__communityAuth = { getSession: async () => ({data:{session:null},error:null}) };
const compiled = await build({
  stdin: { contents: `export * from './src/features/community/services/communityRead';
    export * from './src/features/community/services/communityWrite';
    export * from './src/features/community/services/communityErrors';
    export * from './src/features/community/services/commentDraft';
    export * from './src/features/community/services/commentAvatar';
    export * from './src/features/community/services/captchaTokens';`, resolveDir:process.cwd() },
  bundle:true, write:false, platform:'node', format:'esm',
  define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'synthetic-public'})},
  plugins:[{name:'isolated-auth',setup(b){
    b.onResolve({filter:/lib\/supabase\/client$/},()=>({path:'auth',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase = {auth: globalThis.__communityAuth};'}));
  }}],
});
const api = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const nativeFetch = globalThis.fetch;
const page = (extra={}) => ({chapter_number:1,comments:[],clover_count:0,has_left_clover:false,next_cursor:null,...extra});
const proof = () => { const token=randomUUID(); api.registerCaptchaToken(token,()=>{}); return token; };
const command = {operation:'comment',chapter_number:1,pseudonym:'Leitor',body:'Um comentário',client_request_id:randomUUID()};

test('public reads deduplicate StrictMode/concurrent loads and never sign up',async()=>{
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++; assert.equal(new URL(url).pathname,'/functions/v1/community-read');
    assert.deepEqual(options.headers,{});
    await new Promise(resolve=>setTimeout(resolve,10));
    return Response.json(page());
  };
  try {
    const results=await Promise.all([api.communityRead(1),api.communityRead(1),api.communityRead(1)]);
    assert.equal(calls,1); assert.equal(results[0].has_left_clover,false);
    await api.communityRead(1); assert.equal(calls,2,'settled reads are revalidated');
  } finally { globalThis.fetch=nativeFetch; }
});
test('viewer JWT stays in a header and cursor is passed without interpretation',async()=>{
  globalThis.__communityAuth.getSession=async()=>({data:{session:{access_token:'private-viewer-token'}},error:null});
  globalThis.fetch=async(url,options)=>{
    assert.equal(new URL(url).searchParams.get('cursor'),'opaque+cursor');
    assert.equal(options.headers.Authorization,'Bearer private-viewer-token');
    assert.ok(!String(url).includes('private-viewer-token'));
    return Response.json(page({has_left_clover:true,clover_count:3}));
  };
  try { assert.equal((await api.communityRead(1,'opaque+cursor')).has_left_clover,true); }
  finally { globalThis.fetch=nativeFetch; }
});
test('read errors and malformed responses are safe and retriable',async()=>{
  for(const [status,payload] of [[500,{error:{message:'private database detail'}}],[200,page({has_left_clover:'yes'})],[200,page({chapter_number:2})]]){
    globalThis.fetch=async()=>Response.json(payload,{status});
    try { await assert.rejects(api.communityRead(1),error=>error instanceof api.CommunityRequestError && !error.message.includes('private')); }
    finally { globalThis.fetch=nativeFetch; }
  }
});
test('writes spend each proof once and retain the exact UUID after an uncertain timeout',async()=>{
  const submitted=[];
  globalThis.fetch=async(url,options)=>{
    assert.equal(new URL(url).pathname,'/functions/v1/community-write');
    submitted.push(JSON.parse(options.body));
    if(submitted.length===1) throw new Error('synthetic network timeout');
    return Response.json({operation:'comment',comment_id:randomUUID(),created_at:new Date().toISOString(),replayed:true});
  };
  const token=proof();
  try {
    await assert.rejects(api.communityWrite(command,token),error=>error.uncertain===true);
    await assert.rejects(api.communityWrite(command,token));
    const result=await api.communityWrite(command,proof());
    assert.equal(result.replayed,true); assert.equal(submitted.length,2);
    assert.equal(submitted[0].client_request_id,submitted[1].client_request_id);
    assert.equal(submitted[0].body,submitted[1].body);
    assert.notEqual(submitted[0].captcha_token,submitted[1].captcha_token);
  } finally { globalThis.fetch=nativeFetch; }
});
test('limits expose structured Retry-After and never arbitrary backend text',async()=>{
  globalThis.fetch=async()=>Response.json({error:{code:'rate_limited',message:'private detail'}},{status:429,headers:{'Retry-After':'30'}});
  try { await assert.rejects(api.communityWrite(command,proof()),error=>error.retryAfter===30 && !error.uncertain && !error.message.includes('private')); }
  finally { globalThis.fetch=nativeFetch; }
});
test('clover and report responses retain server-confirmed idempotency',async()=>{
  for(const result of [{operation:'clover',clover_count:4,already_left:true},{operation:'report',reported:true,already_reported:true}]){
    globalThis.fetch=async()=>Response.json(result);
    const input=result.operation==='clover' ? {operation:'clover',chapter_number:1} : {operation:'report',comment_id:randomUUID(),reason_code:'spam'};
    try { assert.deepEqual(await api.communityWrite(input,proof()),result); }
    finally { globalThis.fetch=nativeFetch; }
  }
});
test('drafts preserve payload/UUID across reload; storage never determines clover state',()=>{
  const saved=new Map();
  globalThis.sessionStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  api.preserveComment(command);
  assert.deepEqual(api.restoreComment(1),command);
  assert.equal(api.restoreComment(2),null);
  assert.equal(saved.size,1);
  assert.ok(![...saved.values()][0].includes('private-viewer-token'));
  api.clearComment(1); assert.equal(api.restoreComment(1),null);
  globalThis.sessionStorage.setItem=()=>{throw new Error('blocked');};
  assert.throws(()=>api.preserveComment(command),/armazenamento/);
  delete globalThis.sessionStorage;
});
test('form feedback counts Unicode after trim and rejects invalid lengths',()=>{
  assert.equal(api.commentValidation('  Li  ',' 🌿 '),null);
  assert.equal(api.commentValidation('🌿🌿','a'.repeat(5000)),null);
  assert.ok(api.commentValidation('🌿','texto'));
  assert.ok(api.commentValidation('a'.repeat(41),'texto'));
  assert.ok(api.commentValidation('Li','a'.repeat(5001)));
  assert.ok(api.commentValidation('Li',' \n\t '));
});
test('avatars have stable initials and a bounded local green variation',()=>{
  assert.equal(api.commentAvatar('  Maria da Silva ').initials,'MS');
  assert.equal(api.commentAvatar('lia').initials,'LI');
  assert.equal(api.commentAvatar('Érica Souza').initials,'ÉS');
  const avatar=api.commentAvatar('Leitora');
  for(let i=0;i<5;i++) assert.deepEqual(api.commentAvatar('Leitora'),avatar);
  assert.ok(avatar.tone>=0 && avatar.tone<3);
});
test('opposite sort orders have separate requests and forward direction/cursor',async()=>{
  const requests=[];
  globalThis.fetch=async url=>{ requests.push(new URL(url));return Response.json(page()); };
  try {
    await Promise.all([api.communityRead(1,null,'asc'),api.communityRead(1,null,'desc')]);
    assert.equal(requests.length,2);
    assert.deepEqual(requests.map(url=>url.searchParams.get('order')).sort(),['asc','desc']);
    await api.communityRead(1,'descending-cursor','desc');
    assert.equal(requests[2].searchParams.get('cursor'),'descending-cursor');
    assert.equal(requests[2].searchParams.get('order'),'desc');
  } finally {globalThis.fetch=nativeFetch;}
});
