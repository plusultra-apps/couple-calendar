-- 추억 탭: 사진 좋아요 (두 번 탭 하트)
create table public.photo_likes (
  photo_id   uuid not null references public.photos (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  couple_id  uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);
create index photo_likes_couple_id_idx on public.photo_likes (couple_id);
create index photo_likes_user_id_idx   on public.photo_likes (user_id);

alter table public.photo_likes enable row level security;

create policy "사진 좋아요 조회" on public.photo_likes for select to authenticated
  using (couple_id = (select private.my_couple_id()));
create policy "사진 좋아요 누르기" on public.photo_likes for insert to authenticated
  with check (
    couple_id = (select private.my_couple_id())
    and user_id = (select auth.uid())
    and exists (select 1 from public.photos p where p.id = photo_id)
  );
create policy "사진 좋아요 취소" on public.photo_likes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.photo_likes from anon, authenticated;
grant select, delete on public.photo_likes to authenticated;
grant insert (photo_id) on public.photo_likes to authenticated;

alter publication supabase_realtime add table public.photo_likes;
