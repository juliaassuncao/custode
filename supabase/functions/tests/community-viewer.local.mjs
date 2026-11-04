// Optional personalization tested against real LOCAL Auth and Edge; no reset/migration.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { base, publicKey, fixtureJwt, sql } from './local-stack.mjs';

const chapter=2147483300;
const actors=[randomUUID(),randomUUID()];
const before=sql('select count(*) from auth.users');
let checks=0;
async function read(jwt,status=200,suffix='') {
  const response=await fetch(`${base}/functions/v1/community-read?chapter=${chapter}${suffix}`,{headers:jwt ? {Authorization:`Bearer ${jwt}`,apikey:publicKey} : {}});
  const data=await response.json();
  assert.equal(response.status,status);
  for(const id of actors) assert.ok(!JSON.stringify(data).includes(id));
  checks++;
  return data;
}
assert.equal(sql(`select count(*) from community_chapters where chapter_number=${chapter}`),'0');
try {
  sql(`begin; insert into community_chapters(chapter_number) values (${chapter});
    ${actors.map(id=>`insert into auth.users(id,instance_id,is_anonymous,role,aud,email,encrypted_password,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values ('${id}','00000000-0000-0000-0000-000000000000',true,'authenticated','authenticated','${id}@fixture.invalid','','','','','','{}','{}',now(),now());`).join('\n')}
    commit;`);
  assert.equal((await read()).has_left_clover,false);
  assert.equal((await read(fixtureJwt(actors[0]))).has_left_clover,false);
  // Simulates the existing mutation's committed result; does not change its rules.
  sql(`insert into chapter_clovers(chapter_number,user_id) values (${chapter},'${actors[0]}')`);
  const active=await read(fixtureJwt(actors[0]));
  assert.equal(active.has_left_clover,true); assert.equal(active.clover_count,1);
  assert.equal((await read(fixtureJwt(actors[0]))).has_left_clover,true,'fresh read recovers active state');
  assert.equal((await read(fixtureJwt(actors[1]))).has_left_clover,false);
  assert.equal((await read()).has_left_clover,false);
  assert.equal((await read()).clover_count,1);
  await read('invalid.jwt.token',401);
  await read(fixtureJwt(actors[0],-60),401);
  await read(fixtureJwt(randomUUID()),401);
  await read(undefined,400,`&user_id=${actors[0]}`);
  console.log(`PASS: ${checks} real local HTTP checks for optional identity, clover recovery, isolation and invalid JWTs.`);
} finally {
  sql(`begin; delete from chapter_clovers where chapter_number=${chapter};
    delete from auth.users where id in ('${actors.join("','")}');
    delete from community_chapters where chapter_number=${chapter}; commit;`);
  assert.equal(sql('select count(*) from auth.users'),before);
  console.log('Viewer fixtures removed; existing identities preserved.');
}
