begin;

-- Not included in api.schemas. No browser or service_role access to this ledger.
create schema community_private;
revoke all on schema community_private from public, anon, authenticated, service_role;
create table community_private.rate_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('comment', 'report')),
  occurred_at timestamptz not null
);
alter table community_private.rate_events enable row level security;
revoke all on community_private.rate_events from public, anon, authenticated, service_role;
revoke all on all sequences in schema community_private from public, anon, authenticated, service_role;
create index rate_events_actor_time_idx
  on community_private.rate_events (actor_id, kind, occurred_at desc);

-- Count recent pre-existing activity as well. No historical row is changed.
insert into community_private.rate_events(actor_id, kind, occurred_at)
select author_id, 'comment', created_at from public.comments
where created_at > clock_timestamp() - interval '1 hour'
union all
select reporter_id, 'report', created_at from public.comment_reports
where created_at > clock_timestamp() - interval '1 hour';

-- Only the trusted Edge backend may call this RPC. p_actor is never a browser input:
-- community-write derives it from a token validated by Auth's /user endpoint.
create function public.community_mutate(p_actor uuid, p_operation text, p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_chapter integer;
  v_name text;
  v_body text;
  v_details text;
  v_request uuid;
  v_target uuid;
  v_comment public.comments%rowtype;
  v_last timestamptz;
  v_oldest timestamptz;
  v_count bigint;
  v_inserted integer;
  v_retry integer;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if p_operation is null or p_operation not in ('comment', 'clover', 'report')
    or p_input is null or jsonb_typeof(p_input) <> 'object' then
    return jsonb_build_object('error', 'invalid_parameters');
  end if;
  -- Serializes *all* writes from an identity, including duplicate checks and limits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text, 4279001));
  v_now := clock_timestamp();

  if p_operation in ('comment', 'clover') then
    if jsonb_typeof(p_input->'chapter_number') is distinct from 'number'
      or (p_input->>'chapter_number') !~ '^[1-9][0-9]{0,9}$'
      or (p_input->>'chapter_number')::numeric > 2147483647 then
      return jsonb_build_object('error', 'invalid_parameters');
    end if;
    v_chapter := (p_input->>'chapter_number')::integer;
  end if;

  if p_operation = 'comment' then
    if (p_input - array['chapter_number','pseudonym','body','client_request_id']) <> '{}'::jsonb
      or jsonb_typeof(p_input->'pseudonym') is distinct from 'string'
      or jsonb_typeof(p_input->'body') is distinct from 'string'
      or jsonb_typeof(p_input->'client_request_id') is distinct from 'string'
      or (p_input->>'client_request_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('error', 'invalid_parameters');
    end if;
    v_name := regexp_replace(p_input->>'pseudonym', '^[[:space:]]+|[[:space:]]+$', '', 'g');
    v_body := regexp_replace(p_input->>'body', '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if char_length(v_name) not between 2 and 40 or v_name !~ '[^[:space:]]'
      or char_length(v_body) not between 1 and 5000 or v_body !~ '[^[:space:]]' then
      return jsonb_build_object('error', 'invalid_parameters');
    end if;
    v_request := (p_input->>'client_request_id')::uuid;
    select * into v_comment from public.comments
      where author_id = p_actor and client_request_id = v_request;
    if found then
      if v_comment.chapter_number <> v_chapter or v_comment.pseudonym <> v_name or v_comment.body <> v_body then
        return jsonb_build_object('error', 'idempotency_conflict');
      end if;
      -- A previous commit is acknowledged even if moderation/chapter state changed.
      return jsonb_build_object('comment_id', v_comment.id, 'created_at', v_comment.created_at, 'replayed', true);
    end if;
  elsif p_operation = 'clover' then
    if (p_input - 'chapter_number') <> '{}'::jsonb then
      return jsonb_build_object('error', 'invalid_parameters');
    end if;
  else
    if (p_input - array['comment_id','reason_code','details']) <> '{}'::jsonb
      or jsonb_typeof(p_input->'comment_id') is distinct from 'string'
      or (p_input->>'comment_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(p_input->'reason_code') is distinct from 'string'
      or (p_input->>'reason_code') not in ('spam','harassment','hate_or_discrimination','spoiler','inappropriate_content','other')
      or (p_input ? 'details' and jsonb_typeof(p_input->'details') <> 'string') then
      return jsonb_build_object('error', 'invalid_parameters');
    end if;
    v_details := nullif(regexp_replace(p_input->>'details', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
    if char_length(v_details) > 2000 then
      return jsonb_build_object('error', 'invalid_parameters');
    end if;
    v_target := (p_input->>'comment_id')::uuid;
    -- Hidden/removed targets are not disclosed to public clients.
    select * into v_comment from public.comments where id = v_target and status = 'published' for share;
    if not found then return jsonb_build_object('error', 'comment_not_found'); end if;
    v_chapter := v_comment.chapter_number;
  end if;

  perform 1 from public.community_chapters where chapter_number = v_chapter and enabled for share;
  if not found then return jsonb_build_object('error', 'chapter_not_found'); end if;

  if p_operation = 'clover' then
    insert into public.chapter_clovers(chapter_number, user_id) values (v_chapter, p_actor)
      on conflict (chapter_number, user_id) do nothing;
    get diagnostics v_inserted = row_count;
    select count(*) into v_count from public.chapter_clovers where chapter_number = v_chapter;
    return jsonb_build_object('clover_count', v_count, 'already_left', v_inserted = 0);
  end if;

  if p_operation = 'report' and exists (
    select 1 from public.comment_reports where comment_id = v_target and reporter_id = p_actor
  ) then
    return jsonb_build_object('reported', true, 'already_reported', true);
  end if;

  delete from community_private.rate_events where actor_id = p_actor and occurred_at <= v_now - interval '1 hour';
  select count(*), max(occurred_at), min(occurred_at) into v_count, v_last, v_oldest
    from community_private.rate_events where actor_id = p_actor and kind = p_operation
      and occurred_at > v_now - interval '1 hour';
  if p_operation = 'comment' and v_last > v_now - interval '30 seconds' then
    v_retry := greatest(1, ceil(extract(epoch from v_last + interval '30 seconds' - v_now))::integer);
    return jsonb_build_object('error', 'rate_limited', 'retry_after', v_retry);
  end if;
  if v_count >= (case when p_operation = 'comment' then 10 else 5 end) then
    v_retry := greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - v_now))::integer);
    return jsonb_build_object('error', 'rate_limited', 'retry_after', v_retry);
  end if;

  if p_operation = 'comment' then
    insert into public.comments(chapter_number, author_id, pseudonym, body, client_request_id, status)
      values (v_chapter, p_actor, v_name, v_body, v_request, 'published') returning * into v_comment;
    insert into community_private.rate_events(actor_id, kind, occurred_at) values (p_actor, 'comment', v_now);
    return jsonb_build_object('comment_id', v_comment.id, 'created_at', v_comment.created_at, 'replayed', false);
  else
    insert into public.comment_reports(comment_id, reporter_id, reason_code, details)
      values (v_target, p_actor, p_input->>'reason_code', v_details);
    insert into community_private.rate_events(actor_id, kind, occurred_at) values (p_actor, 'report', v_now);
    return jsonb_build_object('reported', true, 'already_reported', false);
  end if;
end;
$$;

revoke all on function public.community_mutate(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.community_mutate(uuid, text, jsonb) to service_role;
comment on function public.community_mutate(uuid, text, jsonb) is
  'Backend-only community mutations. Edge must validate JWT with Auth and Siteverify before every call.';
commit;
