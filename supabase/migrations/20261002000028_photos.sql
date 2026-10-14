-- 사진: 데이트 사진 · 인생네컷 · 커버(배경) · 프로필 사진
-- 파일은 비공개 Storage 버킷 'photos' 에 '{couple_id}/{파일}' 경로로 둔다. 커플 구성원만 읽고 쓸 수 있다.

-- ── Storage ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "커플 사진 파일 조회" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select private.my_couple_id())::text);
create policy "커플 사진 파일 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select private.my_couple_id())::text);
create policy "커플 사진 파일 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select private.my_couple_id())::text);

-- ── 사진 목록 ──
create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  path        text not null unique,          -- 큰 사진 (긴 쪽 1600px)
  thumb_path  text not null,                 -- 작은 사진 (긴 쪽 480px)
  width       int,
  height      int,
  taken_on    date not null,                 -- 어느 날의 사진인지 (달력·기념일과 연결)
  event_id    uuid references public.events (id) on delete set null,
  kind        text not null default 'photo' check (kind in ('photo', 'fourcut')),  -- fourcut = 인생네컷
  caption     text check (char_length(caption) <= 200),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint photos_path_chk check (
    split_part(path, '/', 1) = couple_id::text and split_part(thumb_path, '/', 1) = couple_id::text
  )
);
create index photos_couple_taken_idx on public.photos (couple_id, taken_on desc);
create index photos_event_id_idx     on public.photos (event_id);
create index photos_created_by_idx   on public.photos (created_by);

alter table public.photos enable row level security;

-- 상대의 '나만 보기' 일정에 붙은 사진은 보이지 않게 (events RLS 가 서브쿼리에도 적용된다)
create policy "커플 사진 조회" on public.photos for select to authenticated
  using (
    couple_id = (select private.my_couple_id())
    and (event_id is null or exists (select 1 from public.events e where e.id = event_id))
  );
create policy "커플 사진 올리기" on public.photos for insert to authenticated
  with check (
    couple_id = (select private.my_couple_id())
    and (event_id is null or exists (select 1 from public.events e where e.id = event_id and e.couple_id = (select private.my_couple_id())))
  );
create policy "커플 사진 고치기" on public.photos for update to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (
    couple_id = (select private.my_couple_id())
    and (event_id is null or exists (select 1 from public.events e where e.id = event_id and e.couple_id = (select private.my_couple_id())))
  );
create policy "커플 사진 지우기" on public.photos for delete to authenticated
  using (couple_id = (select private.my_couple_id()));

revoke all on public.photos from anon, authenticated;
grant select, delete on public.photos to authenticated;
grant insert (path, thumb_path, width, height, taken_on, event_id, kind, caption) on public.photos to authenticated;
grant update (taken_on, event_id, kind, caption) on public.photos to authenticated;

alter publication supabase_realtime add table public.photos;

-- ── 커버(배경) · 프로필 사진 ──
alter table public.couples  add column cover_path text;
alter table public.profiles add column photo_path text;
grant update (cover_path) on public.couples  to authenticated;
grant update (photo_path) on public.profiles to authenticated;
