-- 책 기록: 커플이 함께 보는 서재. 한 권 = 한 행 (같은 책은 커플당 한 번).
create table public.book_logs (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  isbn         text not null check (char_length(isbn) between 1 and 40),
  title        text not null check (char_length(title) between 1 and 200),
  authors      text,
  publisher    text,
  thumbnail    text,                                             -- 카카오가 준 표지 주소 (이미지는 복사해 저장하지 않는다)
  status       text not null default 'wish' check (status in ('wish', 'reading', 'done')),
  rating       smallint check (rating is null or rating between 1 and 5),
  started_on   date,
  finished_on  date,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (couple_id, isbn)
);

-- 한 줄 기록 (감상). 둘이 각자 여러 줄 남길 수 있다.
create table public.book_notes (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  book_id     uuid not null references public.book_logs (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 300),
  created_at  timestamptz not null default now()
);

create index book_notes_book_idx on public.book_notes (book_id, created_at);

alter table public.book_logs enable row level security;
alter table public.book_notes enable row level security;

create policy "책 기록 커플" on public.book_logs for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (couple_id = (select private.my_couple_id()));

create policy "책 한 줄 커플" on public.book_notes for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (couple_id = (select private.my_couple_id()) and user_id = (select auth.uid()));

alter publication supabase_realtime add table public.book_logs;
alter publication supabase_realtime add table public.book_notes;
