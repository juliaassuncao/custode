begin;

-- Technical community registry only; editorial content and publication metadata stay in Git.
insert into public.community_chapters (chapter_number) values (29)
  on conflict (chapter_number) do nothing;

commit;
