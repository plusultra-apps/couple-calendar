-- 자주 쓰는 일정(빠른 선택 칩 · 도장). 커플이 함께 쓴다.
create table public.quick_templates (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  emoji       text not null default '⭐' check (char_length(emoji) between 1 and 16),
  title       text not null check (char_length(title) between 1 and 100),
  owner_id    uuid references public.profiles (id) on delete set null,   -- NULL = 우리
  all_day     boolean not null default false,
  start_time  time,
  end_time    time,
  repeat      text check (repeat in ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  location    text,
  sort_order  int not null default 0,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint quick_templates_time_chk check (all_day or (start_time is not null and end_time is not null))
);
create index quick_templates_couple_id_idx  on public.quick_templates (couple_id, sort_order);
create index quick_templates_owner_id_idx   on public.quick_templates (owner_id);
create index quick_templates_created_by_idx on public.quick_templates (created_by);

alter table public.quick_templates enable row level security;

create policy "빠른 일정 커플" on public.quick_templates for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (
    couple_id = (select private.my_couple_id())
    and (owner_id is null or private.is_couple_member(owner_id))
  );

revoke all on public.quick_templates from anon, authenticated;
grant select, delete on public.quick_templates to authenticated;
grant insert (emoji, title, owner_id, all_day, start_time, end_time, repeat, location, sort_order),
      update (emoji, title, owner_id, all_day, start_time, end_time, repeat, location, sort_order)
  on public.quick_templates to authenticated;

alter publication supabase_realtime add table public.quick_templates;
