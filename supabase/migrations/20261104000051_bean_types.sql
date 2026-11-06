-- 콩 항목: 커플이 직접 만든다 (이름·이모지·색). 기본 3개는 새 커플·기존 커플 모두에 넣는다.
create table public.bean_types (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 12),
  emoji       text not null default '💗' check (char_length(emoji) between 1 and 16),
  color       text not null default '#F8B4C4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order  int not null default 0,
  archived    boolean not null default false,                  -- 지운 항목: 버튼에서만 숨기고 기록은 남긴다
  created_at  timestamptz not null default now()
);

alter table public.bean_types enable row level security;

create policy "콩 항목 커플" on public.bean_types for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (couple_id = (select private.my_couple_id()));

-- 새 커플이 생기면 기본 항목 3개
create function private.seed_bean_types()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.bean_types (couple_id, label, emoji, color, sort_order) values
    (new.id, '데이트', '🍽️', '#C3B1E1', 1),
    (new.id, '꽁냥', '🧸', '#F8B4C4', 2),
    (new.id, '키스', '💋', '#FFC8A2', 3);
  return null;
end $$;

create trigger couples_seed_bean_types after insert on public.couples
  for each row execute function private.seed_bean_types();

-- 이미 있는 커플에게도 기본 항목을 넣는다
insert into public.bean_types (couple_id, label, emoji, color, sort_order)
select c.id, v.label, v.emoji, v.color, v.ord
from public.couples c
cross join (values
  ('데이트', '🍽️', '#C3B1E1', 1),
  ('꽁냥', '🧸', '#F8B4C4', 2),
  ('키스', '💋', '#FFC8A2', 3)
) as v(label, emoji, color, ord)
where not exists (select 1 from public.bean_types t where t.couple_id = c.id);

-- 콩 기록: 항목(type_id) 연결. 옛 화면(kind 만 보내는 버전)도 깨지지 않게 kind 는 남기고 제약만 푼다.
alter table public.bean_logs add column type_id uuid references public.bean_types (id) on delete set null;

update public.bean_logs b
set type_id = t.id
from public.bean_types t
where t.couple_id = b.couple_id
  and b.type_id is null
  and t.label = case b.kind when 'date' then '데이트' when 'cuddle' then '꽁냥' when 'kiss' then '키스' end;

alter table public.bean_logs alter column kind drop not null;
alter table public.bean_logs drop constraint bean_logs_kind_check;
create index bean_logs_type_idx on public.bean_logs (type_id);

alter publication supabase_realtime add table public.bean_types;
