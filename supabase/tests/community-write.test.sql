begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_schema_privilege(r, 'community_private', 'USAGE'), r || ' cannot access private ledger')
from unnest(array['anon','authenticated','service_role']) r;
select ok(not has_table_privilege(r, 'community_private.rate_events', 'SELECT'), r || ' cannot read rate events')
from unnest(array['anon','authenticated','service_role']) r;
select ok(not has_function_privilege(r, 'public.community_mutate(uuid,text,jsonb)', 'EXECUTE'), r || ' cannot mutate via RPC')
from unnest(array['anon','authenticated']) r;
select ok(has_function_privilege('service_role', 'public.community_mutate(uuid,text,jsonb)', 'EXECUTE'), 'backend can execute RPC');
select ok((select prosecdef and proconfig = array['search_path=""'] from pg_proc
  where oid='public.community_mutate(uuid,text,jsonb)'::regprocedure), 'definer has empty search_path');
select ok((select relrowsecurity from pg_class where oid='community_private.rate_events'::regclass), 'private ledger RLS');

insert into auth.users(id,is_anonymous) values ('00000000-0000-4000-8000-000000004b01',true);
insert into community_chapters(chapter_number,enabled) values (2147483100,true),(2147483101,false);
create function pg_temp.mutate(op text, extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
 select community_mutate('00000000-0000-4000-8000-000000004b01', op,
   case when op='comment' then jsonb_build_object('chapter_number',2147483100,'pseudonym','Guest',
     'body','Text','client_request_id',gen_random_uuid())
     when op='clover' then '{"chapter_number":2147483100}'::jsonb else '{}'::jsonb end || extra)
$$;
select is(community_mutate(null,'clover','{}')->>'error','unauthorized','unknown identity');
select is(pg_temp.mutate('clover','{"chapter_number":2147483101}')->>'error','chapter_not_found','disabled chapter');
select is(pg_temp.mutate('clover','{"chapter_number":2147483647}')->>'error','chapter_not_found','missing chapter');
select is(pg_temp.mutate('comment','{"body":"   "}')->>'error','invalid_parameters','empty body');
select is(pg_temp.mutate('comment',jsonb_build_object('body',repeat('x',5001)))->>'error','invalid_parameters','long body');
select is(pg_temp.mutate('comment','{"pseudonym":"x"}')->>'error','invalid_parameters','short name');
select is(pg_temp.mutate('comment',jsonb_build_object('pseudonym',repeat('x',41)))->>'error','invalid_parameters','long name');
select is(pg_temp.mutate('comment','{"author_id":"00000000-0000-4000-8000-000000004b01"}')->>'error','invalid_parameters','actor injection');
select is(pg_temp.mutate('comment','{"status":"hidden"}')->>'error','invalid_parameters','status injection');
create temp table result as select pg_temp.mutate('comment', '{"client_request_id":"00000000-0000-4000-8000-000000004b02","body":" <script>alert(1)</script> "}') data;
select is((select status from comments where id=(select (data->>'comment_id')::uuid from result)), 'published','immediate publication');
select is((select body from comments where id=(select (data->>'comment_id')::uuid from result)), '<script>alert(1)</script>', 'HTML stored as inert plain text');
select is(pg_temp.mutate('comment','{"client_request_id":"00000000-0000-4000-8000-000000004b02","body":"<script>alert(1)</script>"}')->>'replayed','true','retry before cooldown check');
select is(pg_temp.mutate('comment','{"client_request_id":"00000000-0000-4000-8000-000000004b02"}')->>'error','idempotency_conflict','changed payload conflict');
select is(pg_temp.mutate('comment')->>'error','rate_limited','30 second cooldown');
select is((select count(*) from community_private.rate_events where actor_id='00000000-0000-4000-8000-000000004b01'),1::bigint,'retry/failure consume no quota');
select is(pg_temp.mutate('clover')->>'clover_count','1','first clover');
select is(pg_temp.mutate('clover')->>'already_left','true','repeat clover');
select is(pg_temp.mutate('clover')->>'clover_count','1','one clover total');
select is(pg_temp.mutate('report',jsonb_build_object('comment_id',gen_random_uuid(),'reason_code','spam'))->>'error','comment_not_found','missing report target');
select is(pg_temp.mutate('report',jsonb_build_object('comment_id',data->>'comment_id','reason_code','invalid'))->>'error','invalid_parameters','reason allowlist') from result;
select is(pg_temp.mutate('report',jsonb_build_object('comment_id',data->>'comment_id','reason_code','spam'))->>'already_reported','false','report created') from result;
select is(pg_temp.mutate('report',jsonb_build_object('comment_id',data->>'comment_id','reason_code','spam'))->>'already_reported','true','report duplicate safe') from result;
select is((select status from comments where id=(select (data->>'comment_id')::uuid from result)), 'published','reports never hide');

delete from community_private.rate_events where actor_id='00000000-0000-4000-8000-000000004b01';
insert into community_private.rate_events(actor_id,kind,occurred_at)
 select '00000000-0000-4000-8000-000000004b01','comment',clock_timestamp()-make_interval(secs=>60*i) from generate_series(1,9) i;
select is(pg_temp.mutate('comment')->>'replayed','false','tenth comment allowed');
update community_private.rate_events set occurred_at=occurred_at-interval '31 seconds' where kind='comment' and actor_id='00000000-0000-4000-8000-000000004b01';
select is(pg_temp.mutate('comment')->>'error','rate_limited','eleventh comment per hour rejected');
delete from community_private.rate_events where actor_id='00000000-0000-4000-8000-000000004b01';
insert into community_private.rate_events(actor_id,kind,occurred_at)
 select '00000000-0000-4000-8000-000000004b01','report',clock_timestamp()-interval '1 minute' from generate_series(1,4);
insert into comments(chapter_number,author_id,pseudonym,body,client_request_id)
 select 2147483100,'00000000-0000-4000-8000-000000004b01','Fixture','Target',gen_random_uuid() from generate_series(1,2);
select is(pg_temp.mutate('report',jsonb_build_object('comment_id',id,'reason_code','other'))->>'already_reported','false','fifth report allowed')
 from comments where body='Target' and chapter_number=2147483100 order by id limit 1;
select is(pg_temp.mutate('report',jsonb_build_object('comment_id',id,'reason_code','other'))->>'error','rate_limited','sixth report rejected')
 from comments where body='Target' and chapter_number=2147483100 order by id desc limit 1;
update community_private.rate_events set occurred_at=clock_timestamp()-interval '61 minutes' where actor_id='00000000-0000-4000-8000-000000004b01';
select is(pg_temp.mutate('comment')->>'replayed','false','expired quota recovered');

set local role authenticated;
select throws_ok($$insert into public.chapter_clovers values (2147483100,'00000000-0000-4000-8000-000000004b01',now())$$,'42501',null,'browser direct writes denied');
select throws_ok($$select public.community_mutate('00000000-0000-4000-8000-000000004b01','clover','{}')$$,'42501',null,'browser RPC denied');
reset role;
select * from finish();
rollback;
