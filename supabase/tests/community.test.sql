-- Run only against the local Supabase stack: supabase test db --local
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public'::name, name::name) from unnest(array[
  'community_chapters', 'comments', 'chapter_clovers', 'comment_reports',
  'community_moderators', 'moderation_audit'
]) as t(name);

select ok(c.relrowsecurity, c.relname || ' has RLS')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'community_chapters', 'comments', 'chapter_clovers', 'comment_reports',
  'community_moderators', 'moderation_audit'
);

select ok(not has_table_privilege(r.role_name, 'public.' || t.table_name, p.privilege),
  r.role_name || ' denied ' || p.privilege || ' on ' || t.table_name)
from unnest(array['anon', 'authenticated']) r(role_name)
cross join unnest(array['community_chapters', 'comments', 'chapter_clovers',
  'comment_reports', 'community_moderators', 'moderation_audit']) t(table_name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(privilege);

select ok(has_table_privilege('service_role', 'public.' || t.table_name, p.privilege),
  'service_role allowed ' || p.privilege || ' on ' || t.table_name)
from unnest(array['community_chapters', 'comments', 'chapter_clovers',
  'comment_reports', 'community_moderators', 'moderation_audit']) t(table_name)
cross join unnest(array['SELECT', 'INSERT']) p(privilege);

select ok(not has_table_privilege('service_role', 'public.' || t.table_name, p.privilege),
  'service_role denied ' || p.privilege || ' on ' || t.table_name)
from unnest(array['community_chapters', 'comments', 'chapter_clovers',
  'comment_reports', 'community_moderators', 'moderation_audit']) t(table_name)
cross join unnest(array['DELETE', 'TRUNCATE']) p(privilege);
select ok(not has_table_privilege('service_role', 'public.moderation_audit', 'UPDATE'), 'audit is append only');
select ok(has_table_privilege('service_role', 'public.' || name, 'UPDATE'), 'service_role can update ' || name)
from unnest(array['community_chapters', 'comments', 'comment_reports', 'community_moderators']) t(name);
select has_index('public'::name, table_name::name, index_name::name) from (values
  ('comments', 'comments_published_chapter_idx'),
  ('comments', 'comments_moderation_idx'),
  ('comment_reports', 'comment_reports_open_idx'),
  ('chapter_clovers', 'chapter_clovers_user_idx'),
  ('moderation_audit', 'moderation_audit_history_idx'),
  ('moderation_audit', 'moderation_audit_comment_idx'),
  ('moderation_audit', 'moderation_audit_report_idx')
) t(table_name, index_name);
select is((select count(*) from pg_constraint k join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and k.contype = 'f'
  and c.relname in ('community_chapters', 'comments', 'chapter_clovers', 'comment_reports',
    'community_moderators', 'moderation_audit') and k.confdeltype <> 'r'), 0::bigint,
  'all community FKs restrict deletion');
select is((select count(*) from pg_policies where schemaname = 'public'
  and tablename in ('community_chapters', 'comments', 'chapter_clovers',
  'comment_reports', 'community_moderators', 'moderation_audit')), 0::bigint, 'no frontend policies');
select is((select array_agg(chapter_number order by chapter_number) from community_chapters),
  array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28], 'verified chapter registry');
select is((select count(*) from community_moderators), 0::bigint, 'no automatic moderators');

-- Synthetic Auth identity, always rolled back. No remote or real-user fixtures.
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
insert into comments (id, chapter_number, author_id, pseudonym, body, client_request_id)
values ('00000000-0000-4000-8000-000000000002', 1,
  '00000000-0000-4000-8000-000000000001', 'Guest', 'Test comment',
  '00000000-0000-4000-8000-000000000003');
select is((select status from comments where id = '00000000-0000-4000-8000-000000000002'), 'published', 'immediate publication');
select throws_ok($$insert into comments (chapter_number, author_id, pseudonym, body, client_request_id)
values (1, '00000000-0000-4000-8000-000000000001', 'Guest', 'Retry',
  '00000000-0000-4000-8000-000000000003')$$, '23505', null, 'comment idempotency');
insert into chapter_clovers (chapter_number, user_id) values (1, '00000000-0000-4000-8000-000000000001');
select throws_ok($$insert into chapter_clovers (chapter_number, user_id)
values (1, '00000000-0000-4000-8000-000000000001')$$, '23505', null, 'unique clover');
insert into comment_reports (comment_id, reporter_id, reason_code)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'spam');
select throws_ok($$insert into comment_reports (comment_id, reporter_id, reason_code)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'spam')$$,
  '23505', null, 'unique report');
select is((select status from comments where id = '00000000-0000-4000-8000-000000000002'), 'published', 'report does not hide comment');
select throws_ok($$update comments set pseudonym = 'x' where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'short pseudonym rejected');
select throws_ok($$update comments set body = repeat('x', 5001) where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'long body rejected');
select throws_ok($$update comments set status = 'pending' where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'pending rejected');
select throws_ok($$update comments set chapter_number = 999 where id = '00000000-0000-4000-8000-000000000002'$$,
  '23503', null, 'unknown chapter rejected');
insert into moderation_audit (moderator_id, action, comment_id) values (
  '00000000-0000-4000-8000-000000000001', 'comment_removed', '00000000-0000-4000-8000-000000000002');
select throws_ok($$insert into moderation_audit (moderator_id, action)
values ('00000000-0000-4000-8000-000000000001', 'comment_hidden')$$,
  '23514', null, 'audit requires target');
select throws_ok($$delete from comments where id = '00000000-0000-4000-8000-000000000002'$$,
  '23503', null, 'audit target cannot be deleted');
update comments set status = 'removed' where id = '00000000-0000-4000-8000-000000000002';
select is((select count(*) from comments where id = '00000000-0000-4000-8000-000000000002'), 1::bigint,
  'removed comment is retained');

select * from finish();
rollback;
