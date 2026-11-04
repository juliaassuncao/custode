-- LOCAL ONLY. All fixtures and failure-injection DDL roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create temp table admin_fixture as select gen_random_uuid() moderator, gen_random_uuid() moderator_two,
  gen_random_uuid() inactive, gen_random_uuid() reader, gen_random_uuid() anonymous,
  gen_random_uuid() comment, gen_random_uuid() report, gen_random_uuid() report2,
  gen_random_uuid() request, gen_random_uuid() restore_request;
insert into auth.users(id,is_anonymous)
select moderator,false from admin_fixture union all select moderator_two,false from admin_fixture
union all select inactive,false from admin_fixture union all select reader,false from admin_fixture
union all select anonymous,true from admin_fixture;
insert into community_moderators(user_id,active)
select moderator,true from admin_fixture union all select moderator_two,true from admin_fixture
union all select inactive,false from admin_fixture union all select anonymous,true from admin_fixture;
-- Refuse collisions rather than reusing any pre-existing chapter.
insert into community_chapters(chapter_number,enabled) values(2147483400,false);
insert into comments(id,chapter_number,author_id,pseudonym,body,client_request_id)
select comment,2147483400,reader,'Synthetic','Admin test',gen_random_uuid() from admin_fixture;
insert into comment_reports(id,comment_id,reporter_id,reason_code)
select report,comment,reader,'spam' from admin_fixture union all
select report2,comment,anonymous,'other' from admin_fixture;
create function pg_temp.command(op text, target uuid, req uuid, version integer, note text default null)
returns jsonb language sql as $$ select jsonb_strip_nulls(jsonb_build_object('operation',op,'target_id',target,
  'request_id',req,'expected_version',version,'note',note)) $$;
select ok(not has_function_privilege('authenticated','public.community_admin_mutate(uuid,jsonb)','EXECUTE'),'browser mutation RPC denied');
select ok(not has_function_privilege('anon','public.community_admin_read(uuid,jsonb)','EXECUTE'),'browser read RPC denied');
select ok(not has_table_privilege('service_role','comments','UPDATE'),'direct comment update denied');
select ok(not has_table_privilege('service_role','comment_reports','UPDATE'),'direct report update denied');
select ok(not has_table_privilege('service_role','moderation_audit','INSERT'),'direct audit forgery denied');
select throws_ok(format('select community_admin_read(%L,''{"resource":"comments"}'')', reader),'42501','forbidden','ordinary user rejected') from admin_fixture;
select throws_ok(format('select community_admin_read(%L,''{"resource":"comments"}'')', inactive),'42501','forbidden','inactive moderator rejected') from admin_fixture;
select throws_ok(format('select community_admin_read(%L,''{"resource":"comments"}'')', anonymous),'42501','forbidden','anonymous moderator rejected') from admin_fixture;
select throws_ok(format('select community_admin_mutate(%L,''{}'')', reader),'42501','forbidden','mutation authorization enforced') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0))->>'error','invalid_parameters','hide requires reason') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0,'   '))->>'error','invalid_parameters','blank reason rejected') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('restore_comment',comment,request,0))->>'error','state_conflict','published cannot be restored') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0,'spam') || jsonb_build_object('moderator_id',moderator_two))->>'error','invalid_parameters','forged moderator rejected') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0,'spam'))->>'replayed','false','hide succeeds') from admin_fixture;
select is((select status from comments where id=comment),'hidden','comment hidden') from admin_fixture;
select is((select moderated_by from comments where id=comment),moderator,'correct moderator recorded') from admin_fixture;
select is((select count(*) from moderation_audit where request_id=request),1::bigint,'one audit') from admin_fixture;
select is((select moderator_id from moderation_audit where request_id=request),moderator,'audit actor derived correctly') from admin_fixture;
select is((select metadata->'before'->>'status' from moderation_audit where request_id=request),'published','audit before state') from admin_fixture;
select is((select metadata->'after'->>'status' from moderation_audit where request_id=request),'hidden','audit after state') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0,'spam'))->>'replayed','true','uncertain retry acknowledged') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0,'changed'))->>'error','idempotency_conflict','request UUID cannot be repurposed') from admin_fixture;
select is(community_admin_mutate(moderator_two,pg_temp.command('hide_comment',comment,gen_random_uuid(),0,'spam'))->>'error','state_conflict','other moderator stale action conflicts') from admin_fixture;
select is(community_admin_mutate(moderator_two,pg_temp.command('restore_comment',comment,restore_request,1))->>'replayed','false','equivalent moderator_two moderator restores') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,request,0,'spam'))->>'replayed','true','old retry does not repeat hide after restore') from admin_fixture;
select is((select status from comments where id=comment),'published','old retry preserves newer state') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('hide_comment',comment,gen_random_uuid(),0,'spam'))->>'error','state_conflict','version protects full hide/restore cycle') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('resolve_report',report,gen_random_uuid(),0,'reviewed'))->'state'->>'status','resolved','resolve report') from admin_fixture;
select is(community_admin_mutate(moderator_two,pg_temp.command('dismiss_report',report2,gen_random_uuid(),0))->'state'->>'status','dismissed','dismiss report') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('dismiss_report',report,gen_random_uuid(),1))->>'error','state_conflict','closed report cannot be dismissed') from admin_fixture;
select is((select status from comments where id=comment),'published','report resolution does not alter comment') from admin_fixture;
select is((select count(*) from moderation_audit where moderator_id in (moderator,moderator_two)),4::bigint,'exactly four successful events') from admin_fixture;
select is(jsonb_array_length(community_admin_read(moderator,'{"resource":"comments","chapter":2147483400}')->'items'),1,'admin sees disabled chapter') from admin_fixture;
select is(jsonb_array_length(community_admin_read(moderator,'{"resource":"reports","chapter":2147483400}')->'items'),2,'reports include closed states') from admin_fixture;
select ok(not (community_admin_read(moderator,'{"resource":"reports","chapter":2147483400}')::text like '%'||reader::text||'%'),'no reader identity in report projection') from admin_fixture;
select is(community_admin_read(moderator,'{"resource":"comments","moderator_id":"forged"}')->>'error','invalid_parameters','read identity injection denied') from admin_fixture;
create temp table admin_page as select moderator, community_admin_read(moderator,'{"resource":"history","chapter":2147483400,"limit":1}') data from admin_fixture;
select is(jsonb_array_length(data->'items'),1,'history page bounded') from admin_page;
select ok(data->'next_cursor' <> 'null'::jsonb,'history cursor available') from admin_page;
select is(jsonb_array_length(community_admin_read(moderator,jsonb_build_object('resource','history','chapter',2147483400,'cursor',data->'next_cursor'))->'items'),3,'cursor retrieves remaining events') from admin_page;
select is(community_admin_read(moderator,jsonb_build_object('resource','comments','chapter',2147483400,'cursor',data->'next_cursor'))->>'error','invalid_parameters','cursor scope cannot change') from admin_page;
-- Failure injection is transactional and targets only this transaction's synthetic moderator.
create function pg_temp.fail_admin_audit() returns trigger language plpgsql as $$
begin
  if new.moderator_id = (select moderator from admin_fixture) then raise exception 'synthetic audit failure'; end if;
  return new;
end $$;
create trigger admin_test_fail before insert on moderation_audit for each row execute function pg_temp.fail_admin_audit();
select throws_ok(format('select community_admin_mutate(%L,%L::jsonb)',moderator,pg_temp.command('hide_comment',comment,gen_random_uuid(),2,'failure test')),
  'P0001','synthetic audit failure','audit failure propagates') from admin_fixture;
select is((select status from comments where id=comment),'published','audit failure rolls back state') from admin_fixture;
select is((select moderation_version from comments where id=comment),2,'audit failure rolls back version') from admin_fixture;
select is((select count(*) from moderation_audit where moderator_id in (moderator,moderator_two)),4::bigint,'failed transaction leaves no event') from admin_fixture;
create temp table failing_report as select gen_random_uuid() id;
insert into comment_reports(id,comment_id,reporter_id,reason_code)
select r.id,f.comment,f.moderator_two,'other' from failing_report r cross join admin_fixture f;
select throws_ok(format('select community_admin_mutate(%L,%L::jsonb)',f.moderator,pg_temp.command('resolve_report',r.id,gen_random_uuid(),0)),
  'P0001','synthetic audit failure','report audit failure propagates') from admin_fixture f cross join failing_report r;
select is((select status from comment_reports where id=r.id),'open','audit failure rolls back report') from failing_report r;
select ok((select resolved_by is null and resolved_at is null and moderation_version=0 from comment_reports where id=r.id),
  'report actor/time/version roll back') from failing_report r;
drop trigger admin_test_fail on moderation_audit;
update comments set status='removed' where id=(select comment from admin_fixture);
select is(jsonb_array_length(community_admin_read(moderator,'{"resource":"comments","chapter":2147483400,"status":"removed"}')->'items'),1,'removed comments remain accessible') from admin_fixture;
select is(community_admin_mutate(moderator,pg_temp.command('restore_comment',comment,gen_random_uuid(),2))->>'error','state_conflict','removed comments cannot be restored') from admin_fixture;
update community_moderators set active=false where user_id=(select moderator from admin_fixture);
select throws_ok(format('select community_admin_mutate(%L,%L::jsonb)',moderator,pg_temp.command('hide_comment',comment,request,0,'spam')),
  '42501','forbidden','revoked moderator cannot replay old request') from admin_fixture;
select * from finish();
rollback;
