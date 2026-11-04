begin;

-- Only backend RPCs may change moderation state or append audit events.
revoke update on public.comments, public.comment_reports from service_role;
revoke insert on public.moderation_audit from service_role;
alter table public.comments add column moderation_version integer not null default 0 check (moderation_version >= 0);
alter table public.comment_reports add column moderation_version integer not null default 0 check (moderation_version >= 0);
alter table public.moderation_audit add column request_id uuid;
create unique index moderation_audit_request_idx on public.moderation_audit(moderator_id, request_id)
  where request_id is not null;

-- Internal helper; lock membership until the calling transaction completes.
create function community_private.require_moderator(p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.community_moderators m join auth.users u on u.id = m.user_id
    where m.user_id = p_actor and m.active and u.is_anonymous is false
    for share of m, u;
  if not found then raise insufficient_privilege using message = 'forbidden'; end if;
end;
$$;
revoke all on function community_private.require_moderator(uuid) from public, anon, authenticated, service_role;

create function public.community_admin_mutate(p_actor uuid, p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_operation text; v_target uuid; v_request uuid; v_version integer; v_note text;
  v_before jsonb; v_after jsonb; v_payload jsonb; v_audit public.moderation_audit%rowtype;
  v_comment public.comments%rowtype; v_report public.comment_reports%rowtype;
  v_action text; v_status text; v_now timestamptz;
begin
  perform community_private.require_moderator(p_actor);
  if p_input is null or jsonb_typeof(p_input) <> 'object'
    or (p_input - array['operation','target_id','request_id','expected_version','note']) <> '{}'::jsonb
    or jsonb_typeof(p_input->'operation') is distinct from 'string'
    or (p_input->>'operation') not in ('hide_comment','restore_comment','resolve_report','dismiss_report')
    or jsonb_typeof(p_input->'target_id') is distinct from 'string'
    or (p_input->>'target_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_input->'request_id') is distinct from 'string'
    or (p_input->>'request_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_input->'expected_version') is distinct from 'number'
    or (p_input->>'expected_version') !~ '^[0-9]{1,10}$'
    or (p_input->>'expected_version')::numeric > 2147483646
    or (p_input ? 'note' and jsonb_typeof(p_input->'note') <> 'string') then
    return jsonb_build_object('error','invalid_parameters');
  end if;
  v_operation := p_input->>'operation'; v_target := (p_input->>'target_id')::uuid;
  v_request := (p_input->>'request_id')::uuid; v_version := (p_input->>'expected_version')::integer;
  v_note := nullif(regexp_replace(p_input->>'note', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if char_length(v_note) > 2000 or (v_operation = 'hide_comment' and v_note is null) then
    return jsonb_build_object('error','invalid_parameters');
  end if;
  v_payload := jsonb_build_object('operation',v_operation,'target_id',v_target,'expected_version',v_version,'note',v_note);
  -- Serialize retries before locking the target. The unique index is a second guard.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text || ':' || v_request::text, 4279002));
  select * into v_audit from public.moderation_audit where moderator_id=p_actor and request_id=v_request;
  if found then
    if v_audit.metadata->'request' is distinct from v_payload then
      return jsonb_build_object('error','idempotency_conflict');
    end if;
    return jsonb_build_object('audit_id',v_audit.id,'target_id',v_target,'state',v_audit.metadata->'after','replayed',true);
  end if;
  v_now := clock_timestamp();
  if v_operation in ('hide_comment','restore_comment') then
    select * into v_comment from public.comments where id=v_target for update;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if v_comment.moderation_version <> v_version or v_comment.status <>
      (case when v_operation='hide_comment' then 'published' else 'hidden' end) then
      return jsonb_build_object('error','state_conflict');
    end if;
    v_before := jsonb_build_object('status',v_comment.status,'version',v_comment.moderation_version,
      'moderated_at',v_comment.moderated_at,'moderated_by',v_comment.moderated_by,'reason',v_comment.moderation_reason);
    v_status := case when v_operation='hide_comment' then 'hidden' else 'published' end;
    v_action := case when v_operation='hide_comment' then 'comment_hidden' else 'comment_restored' end;
    update public.comments set status=v_status, moderated_at=v_now, moderated_by=p_actor,
      moderation_reason=v_note, moderation_version=moderation_version+1 where id=v_target;
    v_after := jsonb_build_object('status',v_status,'version',v_version+1,'moderated_at',v_now,'moderated_by',p_actor,'reason',v_note);
  else
    select * into v_report from public.comment_reports where id=v_target for update;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if v_report.moderation_version <> v_version or v_report.status <> 'open' then
      return jsonb_build_object('error','state_conflict');
    end if;
    v_before := jsonb_build_object('status',v_report.status,'version',v_report.moderation_version,
      'resolved_at',v_report.resolved_at,'resolved_by',v_report.resolved_by,'reason',v_report.resolution_note);
    v_status := case when v_operation='resolve_report' then 'resolved' else 'dismissed' end;
    v_action := case when v_operation='resolve_report' then 'report_resolved' else 'report_dismissed' end;
    update public.comment_reports set status=v_status, resolved_at=v_now, resolved_by=p_actor,
      resolution_note=v_note, moderation_version=moderation_version+1 where id=v_target;
    v_after := jsonb_build_object('status',v_status,'version',v_version+1,'resolved_at',v_now,'resolved_by',p_actor,'reason',v_note);
  end if;
  -- No exception handler: a failed audit insert rolls back the update as well.
  insert into public.moderation_audit(moderator_id,action,comment_id,report_id,reason,metadata,created_at,request_id)
    values(p_actor,v_action,case when v_operation in ('hide_comment','restore_comment') then v_target end,
      case when v_operation in ('resolve_report','dismiss_report') then v_target end,v_note,
      jsonb_build_object('before',v_before,'after',v_after,'request',v_payload),v_now,v_request)
    returning * into v_audit;
  return jsonb_build_object('audit_id',v_audit.id,'target_id',v_target,'state',v_after,'replayed',false);
end;
$$;

-- Each resource has an explicit safe projection. No reader Auth UUID crosses this boundary.
create function public.community_admin_read(p_actor uuid, p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_resource text; v_status text; v_chapter integer; v_limit integer; v_cursor_time timestamptz;
  v_cursor_id uuid; v_rows jsonb; v_next jsonb; v_scope jsonb;
begin
  perform community_private.require_moderator(p_actor);
  if p_input is null or jsonb_typeof(p_input) <> 'object'
    or (p_input - array['resource','status','chapter','limit','cursor']) <> '{}'::jsonb
    or jsonb_typeof(p_input->'resource') is distinct from 'string'
    or (p_input->>'resource') not in ('comments','reports','history') then
    return jsonb_build_object('error','invalid_parameters');
  end if;
  v_resource := p_input->>'resource';
  if p_input ? 'status' then
    if jsonb_typeof(p_input->'status') <> 'string' or
      (v_resource='comments' and (p_input->>'status') not in ('published','hidden','removed')) or
      (v_resource='reports' and (p_input->>'status') not in ('open','resolved','dismissed')) or v_resource='history' then
      return jsonb_build_object('error','invalid_parameters');
    end if;
    v_status := p_input->>'status';
  end if;
  if p_input ? 'chapter' then
    if jsonb_typeof(p_input->'chapter') <> 'number' or (p_input->>'chapter') !~ '^[1-9][0-9]{0,9}$'
      or (p_input->>'chapter')::numeric > 2147483647 then return jsonb_build_object('error','invalid_parameters'); end if;
    v_chapter := (p_input->>'chapter')::integer;
  end if;
  if p_input ? 'limit' and (jsonb_typeof(p_input->'limit') <> 'number' or (p_input->>'limit') !~ '^[1-9][0-9]?$'
    or (p_input->>'limit')::numeric > 50) then return jsonb_build_object('error','invalid_parameters'); end if;
  v_limit := coalesce((p_input->>'limit')::integer,20);
  v_scope := jsonb_build_object('resource',v_resource,'status',v_status,'chapter',v_chapter);
  if p_input ? 'cursor' then
    if jsonb_typeof(p_input->'cursor') <> 'object' or
      ((p_input->'cursor') - array['v','scope','created_at','id']) <> '{}'::jsonb or
      p_input->'cursor'->'v' is distinct from '1'::jsonb or p_input->'cursor'->'scope' is distinct from v_scope or
      jsonb_typeof(p_input->'cursor'->'created_at') is distinct from 'string' or
      (p_input->'cursor'->>'created_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$' or
      jsonb_typeof(p_input->'cursor'->'id') is distinct from 'string' or
      (p_input->'cursor'->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('error','invalid_parameters');
    end if;
    begin
      v_cursor_time := (p_input->'cursor'->>'created_at')::timestamptz;
      v_cursor_id := (p_input->'cursor'->>'id')::uuid;
    exception when invalid_datetime_format or datetime_field_overflow then
      return jsonb_build_object('error','invalid_parameters');
    end;
  end if;
  select coalesce(jsonb_agg(q.data order by q.created_at desc,q.id desc),'[]'::jsonb) into v_rows from (
    select c.created_at,c.id,jsonb_build_object('id',c.id,'chapter_number',c.chapter_number,'pseudonym',c.pseudonym,
      'body',c.body,'status',c.status,'created_at',c.created_at,'moderated_at',c.moderated_at,
      'moderation_reason',c.moderation_reason,'moderation_version',c.moderation_version) data
    from public.comments c where v_resource='comments' and (v_status is null or c.status=v_status)
      and (v_chapter is null or c.chapter_number=v_chapter)
      and (v_cursor_time is null or (c.created_at,c.id)<(v_cursor_time,v_cursor_id))
    union all
    select r.created_at,r.id,jsonb_build_object('id',r.id,'comment_id',r.comment_id,'reason_code',r.reason_code,
      'details',r.details,'status',r.status,'created_at',r.created_at,'resolved_at',r.resolved_at,
      'resolution_note',r.resolution_note,'moderation_version',r.moderation_version,
      'comment',jsonb_build_object('id',c.id,'chapter_number',c.chapter_number,'pseudonym',c.pseudonym,
        'body',c.body,'status',c.status,'moderation_version',c.moderation_version))
    from public.comment_reports r join public.comments c on c.id=r.comment_id
    where v_resource='reports' and (v_status is null or r.status=v_status) and (v_chapter is null or c.chapter_number=v_chapter)
      and (v_cursor_time is null or (r.created_at,r.id)<(v_cursor_time,v_cursor_id))
    union all
    select a.created_at,a.id,jsonb_build_object('id',a.id,'moderator_id',a.moderator_id,'action',a.action,
      'comment_id',a.comment_id,'report_id',a.report_id,'reason',a.reason,'created_at',a.created_at,
      'metadata',jsonb_build_object('before',a.metadata->'before','after',a.metadata->'after'))
    from public.moderation_audit a left join public.comment_reports r on r.id=a.report_id
      join public.comments c on c.id=coalesce(a.comment_id,r.comment_id)
    where v_resource='history' and (v_chapter is null or c.chapter_number=v_chapter)
      and (v_cursor_time is null or (a.created_at,a.id)<(v_cursor_time,v_cursor_id))
    order by created_at desc,id desc limit v_limit+1
  ) q;
  if jsonb_array_length(v_rows)>v_limit then
    v_rows := v_rows - v_limit;
    v_next := jsonb_build_object('v',1,'scope',v_scope,'created_at',v_rows->(v_limit-1)->>'created_at','id',v_rows->(v_limit-1)->>'id');
  end if;
  return jsonb_build_object('items',v_rows,'next_cursor',v_next);
end;
$$;
revoke all on function public.community_admin_mutate(uuid,jsonb), public.community_admin_read(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.community_admin_mutate(uuid,jsonb), public.community_admin_read(uuid,jsonb) to service_role;
commit;
