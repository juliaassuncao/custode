begin;

-- Technical chapter registry only. Never store editorial content here.
create table public.community_chapters (
  chapter_number integer primary key check (chapter_number > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Text is untrusted plain text. Future public responses must omit author_id
-- and moderation internals. Removed/hidden comments remain stored for audit.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  chapter_number integer not null references public.community_chapters(chapter_number) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  pseudonym text not null check (char_length(pseudonym) between 2 and 40 and pseudonym ~ '[^[:space:]]'),
  body text not null check (char_length(body) between 1 and 5000 and body ~ '[^[:space:]]'),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete restrict,
  moderation_reason text,
  unique (author_id, client_request_id)
);

-- One clover per Auth identity and chapter, not necessarily per human.
create table public.chapter_clovers (
  chapter_number integer not null references public.community_chapters(chapter_number) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (chapter_number, user_id)
);

-- Reports never change comment visibility automatically.
create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete restrict,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reason_code text not null check (reason_code in (
    'spam', 'harassment', 'hate_or_discrimination', 'spoiler', 'inappropriate_content', 'other'
  )),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text,
  unique (comment_id, reporter_id)
);

-- No automatic grants or metadata-based roles. Bootstrap separately by admin.
create table public.community_moderators (
  user_id uuid primary key references auth.users(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict
);

-- Append-only audit: exactly one target, coherent with the action.
create table public.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'comment_hidden', 'comment_restored', 'comment_removed', 'report_resolved', 'report_dismissed'
  )),
  comment_id uuid references public.comments(id) on delete restrict,
  report_id uuid references public.comment_reports(id) on delete restrict,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moderation_audit_one_target check (num_nonnulls(comment_id, report_id) = 1),
  constraint moderation_audit_action_target check (
    (action in ('comment_hidden', 'comment_restored', 'comment_removed') and comment_id is not null)
    or (action in ('report_resolved', 'report_dismissed') and report_id is not null)
  )
);

create index comments_published_chapter_idx on public.comments (chapter_number, created_at, id)
  where status = 'published';
create index comments_moderation_idx on public.comments (status, created_at, id);
create index comment_reports_open_idx on public.comment_reports (created_at, id) where status = 'open';
create index comment_reports_reporter_idx on public.comment_reports (reporter_id);
create index chapter_clovers_user_idx on public.chapter_clovers (user_id, chapter_number);
create index moderation_audit_history_idx on public.moderation_audit (created_at desc, id desc);
create index moderation_audit_comment_idx on public.moderation_audit (comment_id, created_at desc, id desc)
  where comment_id is not null;
create index moderation_audit_report_idx on public.moderation_audit (report_id, created_at desc, id desc)
  where report_id is not null;
create index moderation_audit_moderator_idx on public.moderation_audit (moderator_id, created_at desc);

-- Verified against src/data/chapters/manifest.json AND all 27 chapter JSONs.
-- New chapters require an explicit registry insert; no editorial duplication.
insert into public.community_chapters (chapter_number) values
  (1), (2), (3), (4), (5), (6), (7), (8), (9),
  (10), (11), (12), (13), (14), (15), (16), (17), (18),
  (19), (20), (21), (22), (23), (24), (25), (26), (27);

alter table public.community_chapters enable row level security;
alter table public.comments enable row level security;
alter table public.chapter_clovers enable row level security;
alter table public.comment_reports enable row level security;
alter table public.community_moderators enable row level security;
alter table public.moderation_audit enable row level security;

-- No policies: default deny, including Auth anonymous users (authenticated).
-- service_role bypasses RLS. Edge Functions MUST validate JWTs, identity,
-- active moderators, enabled chapters, text, rate limits and public projections.
-- Moderation changes and their audit inserts MUST share a transaction.
revoke all privileges on table public.community_chapters, public.comments,
  public.chapter_clovers, public.comment_reports, public.community_moderators,
  public.moderation_audit from public, anon, authenticated, service_role;

grant select, insert, update on table public.community_chapters, public.comments,
  public.comment_reports, public.community_moderators to service_role;
grant select, insert on table public.chapter_clovers, public.moderation_audit to service_role;
grant usage on schema public to service_role;

-- Even service_role cannot DELETE/TRUNCATE these tables, or UPDATE audit rows.
-- FK RESTRICT also prevents deleting referenced Auth identities or audit targets.
-- Account deletion therefore needs a separately reviewed retention procedure.
commit;
