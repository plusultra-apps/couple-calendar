-- 콩 기록: 데이트·꽁냥·키스 한 번마다 콩 한 개 (한 행 = 콩 한 개). 하루에 여러 번 가능.
create table public.bean_logs (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  kind        text not null check (kind in ('date', 'cuddle', 'kiss')),
  taken_on    date not null,                                  -- 그 일이 있었던 날 (서울 날짜)
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index bean_logs_couple_day_idx on public.bean_logs (couple_id, taken_on);

alter table public.bean_logs enable row level security;

create policy "콩 기록 커플" on public.bean_logs for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (couple_id = (select private.my_couple_id()));

-- 상대가 추가·삭제하면 실시간으로 반영
alter publication supabase_realtime add table public.bean_logs;
