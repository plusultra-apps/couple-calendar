-- 읽은 상태는 사람마다 따로 둔다 (누가 읽었는지 보이도록). 책 자체(제목·표지)는 커플이 공유.
create table public.book_progress (
  book_id      uuid not null references public.book_logs (id) on delete cascade,
  couple_id    uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status       text not null default 'wish' check (status in ('wish', 'reading', 'done')),
  rating       smallint check (rating is null or rating between 1 and 5),
  started_on   date,
  finished_on  date,
  updated_at   timestamptz not null default now(),
  primary key (book_id, user_id)
);

alter table public.book_progress enable row level security;

create policy "책 읽은 상태 커플" on public.book_progress for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (couple_id = (select private.my_couple_id()) and user_id = (select auth.uid()));

-- 기존 기록을 담은 사람의 상태로 옮긴다
insert into public.book_progress (book_id, couple_id, user_id, status, rating, started_on, finished_on, updated_at)
select b.id, b.couple_id, b.created_by, b.status, b.rating, b.started_on, b.finished_on, b.updated_at
from public.book_logs b
where b.created_by is not null;

alter table public.book_logs drop column status, drop column rating, drop column started_on, drop column finished_on, drop column updated_at;

alter publication supabase_realtime add table public.book_progress;
