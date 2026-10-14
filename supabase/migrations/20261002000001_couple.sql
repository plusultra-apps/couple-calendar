-- P1: 커플 · 프로필
-- 모든 데이터는 couple_id 로 격리한다 (PLAN.md 5장).

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────
create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  started_on  date not null,                 -- 사귄 날
  invite_code text not null unique,          -- 6자리 초대 코드
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  couple_id         uuid references public.couples (id) on delete set null,
  nickname          text not null default '',
  color             text not null default '#A7C7E7',
  birthday          date,
  birthday_is_lunar boolean not null default false,
  created_at        timestamptz not null default now()
);

create index profiles_couple_id_idx on public.profiles (couple_id);

-- ─────────────────────────────────────────────
-- 헬퍼
-- ─────────────────────────────────────────────

-- 내 couple_id. RLS 정책에서 사용한다.
-- security definer 로 profiles 의 RLS 를 거치지 않아 정책 재귀를 피한다.
create function public.my_couple_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- 헷갈리는 글자(0/O, 1/I/L)를 뺀 6자리 코드
create function public.gen_invite_code()
returns text
language sql volatile set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6)
$$;

-- 가입하면 프로필 자동 생성 (닉네임은 회원가입 폼에서 metadata 로 전달)
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), split_part(new.email, '@', 1)));
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 커플 만들기 / 연결 (RPC)
-- couple_id, invite_code 는 이 함수로만 바뀐다.
-- ─────────────────────────────────────────────
create function public.create_couple(p_started_on date)
returns public.couples
language plpgsql security definer set search_path = ''
as $$
declare
  v_code   text;
  v_couple public.couples;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'already_in_couple';
  end if;

  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (started_on, invite_code)
  values (p_started_on, v_code)
  returning * into v_couple;

  update public.profiles
     set couple_id = v_couple.id, color = '#A7C7E7'
   where id = auth.uid();

  return v_couple;
end
$$;

create function public.join_couple(p_code text)
returns public.couples
language plpgsql security definer set search_path = ''
as $$
declare
  v_couple public.couples;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'already_in_couple';
  end if;

  -- 두 사람이 동시에 같은 코드로 들어오는 경우를 막기 위해 행 잠금
  select * into v_couple
    from public.couples
   where invite_code = upper(trim(p_code))
     for update;

  if not found then
    raise exception 'invalid_code';
  end if;
  if (select count(*) from public.profiles where couple_id = v_couple.id) >= 2 then
    raise exception 'couple_full';
  end if;

  update public.profiles
     set couple_id = v_couple.id, color = '#F8B4C4'
   where id = auth.uid();

  return v_couple;
end
$$;

-- ─────────────────────────────────────────────
-- 권한 · RLS
-- ─────────────────────────────────────────────
alter table public.couples  enable row level security;
alter table public.profiles enable row level security;

create policy "커플 구성원만 조회" on public.couples
  for select to authenticated
  using (id = public.my_couple_id());

create policy "커플 구성원만 수정" on public.couples
  for update to authenticated
  using (id = public.my_couple_id())
  with check (id = public.my_couple_id());

create policy "나와 상대 프로필 조회" on public.profiles
  for select to authenticated
  using (id = auth.uid() or couple_id = public.my_couple_id());

create policy "내 프로필만 수정" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 컬럼 단위로 수정 가능 범위를 제한한다. couple_id · invite_code 는 RPC 로만.
revoke insert, update, delete on public.couples  from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (started_on) on public.couples to authenticated;
grant update (nickname, color, birthday, birthday_is_lunar) on public.profiles to authenticated;

revoke execute on function public.gen_invite_code()   from public, anon, authenticated;
revoke execute on function public.handle_new_user()   from public, anon, authenticated;
revoke execute on function public.create_couple(date) from public, anon;
revoke execute on function public.join_couple(text)   from public, anon;
grant  execute on function public.create_couple(date) to authenticated;
grant  execute on function public.join_couple(text)   to authenticated;
