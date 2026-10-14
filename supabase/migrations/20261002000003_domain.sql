-- P2~P9 도메인: 일정 · 비공개 상세 · 댓글 · 반응 · 기념일 · 위시 · 푸시 구독 · 구독 피드 · 외부 캘린더
-- 규칙은 CLAUDE.md "Supabase", "도메인 규칙" 참고.

-- ─────────────────────────────────────────────
-- 공용 헬퍼
-- ─────────────────────────────────────────────
create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- 같은 커플 구성원인지 (owner_id 검증용)
create function private.is_couple_member(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = p_user
       and couple_id is not null
       and couple_id = (select couple_id from public.profiles where id = auth.uid())
  )
$$;
revoke execute on function private.is_couple_member(uuid) from public, anon;
grant  execute on function private.is_couple_member(uuid) to authenticated;

-- '우리' 일정 색
alter table public.couples add column us_color text not null default '#C3B1E1';
grant update (us_color) on public.couples to authenticated;

-- ─────────────────────────────────────────────
-- 일정
-- ─────────────────────────────────────────────
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  owner_id    uuid references public.profiles (id) on delete set null,   -- NULL = 우리
  title       text not null default '',
  location    text,
  memo        text,
  all_day     boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  start_date  date,
  end_date    date,                                                      -- 종료일 포함
  rrule       text,                                                      -- DTSTART 없는 RRULE 본문
  exdates     date[] not null default '{}',                              -- 반복에서 뺀 날
  is_private  boolean not null default false,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_time_chk check (
    (all_day and start_date is not null and end_date is not null and end_date >= start_date
             and starts_at is null and ends_at is null)
    or
    (not all_day and starts_at is not null and ends_at is not null and ends_at >= starts_at
                 and start_date is null and end_date is null)
  ),
  constraint events_private_chk check (not is_private or owner_id is not null),
  constraint events_title_chk check (is_private or char_length(title) between 1 and 100),
  constraint events_rrule_chk check (rrule is null or rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)')
);

create index events_couple_id_idx  on public.events (couple_id);
create index events_owner_id_idx   on public.events (owner_id);
create index events_created_by_idx on public.events (created_by);

create trigger events_touch before update on public.events
  for each row execute function private.touch_updated_at();

-- 비공개 일정의 실제 내용 (소유자만 조회)
create table public.event_secrets (
  event_id  uuid primary key references public.events (id) on delete cascade,
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title     text not null check (char_length(title) between 1 and 100),
  location  text,
  memo      text
);
create index event_secrets_user_id_idx on public.event_secrets (user_id);

-- 댓글
create table public.event_comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index event_comments_event_id_idx  on public.event_comments (event_id, created_at);
create index event_comments_couple_id_idx on public.event_comments (couple_id);
create index event_comments_user_id_idx   on public.event_comments (user_id);

-- 이모지 반응
create table public.event_reactions (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji       text not null check (emoji in ('❤️', '👍', '😂', '😮', '😢', '🎉')),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id, emoji)
);
create index event_reactions_couple_id_idx on public.event_reactions (couple_id);
create index event_reactions_user_id_idx   on public.event_reactions (user_id);

-- ─────────────────────────────────────────────
-- 기념일 (사용자 정의만 저장. 100일·주년·생일은 화면에서 계산)
-- ─────────────────────────────────────────────
create table public.anniversaries (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 50),
  base_date   date not null,
  is_lunar    boolean not null default false,
  kind        text not null default 'yearly' check (kind in ('yearly', 'once')),
  emoji       text not null default '🎉',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index anniversaries_couple_id_idx  on public.anniversaries (couple_id);
create index anniversaries_created_by_idx on public.anniversaries (created_by);

-- ─────────────────────────────────────────────
-- 위시리스트
-- ─────────────────────────────────────────────
create table public.wishes (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 100),
  url         text check (url is null or url ~* '^https?://'),
  tag         text not null default '기타' check (tag in ('맛집', '카페', '여행', '데이트', '영화', '전시', '쇼핑', '기타')),
  memo        text,
  done        boolean not null default false,
  event_id    uuid references public.events (id) on delete set null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index wishes_couple_id_idx  on public.wishes (couple_id);
create index wishes_event_id_idx   on public.wishes (event_id);
create index wishes_created_by_idx on public.wishes (created_by);

create trigger wishes_touch before update on public.wishes
  for each row execute function private.touch_updated_at();

-- ─────────────────────────────────────────────
-- 푸시 구독 · 구독 피드 토큰 · 외부 캘린더
-- ─────────────────────────────────────────────
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create table public.feed_tokens (
  user_id     uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  token       text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at  timestamptz not null default now()
);

create table public.external_calendars (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 30),
  ics_url         text not null check (ics_url ~* '^(https?|webcal)://'),
  last_synced_at  timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);
create index external_calendars_user_id_idx on public.external_calendars (user_id);

-- 외부 캘린더에서 가져온 바쁜 시간 (제목은 저장하지 않음). service role 만 쓴다.
create table public.external_busy (
  id           bigint generated always as identity primary key,
  calendar_id  uuid not null references public.external_calendars (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  couple_id    uuid references public.couples (id) on delete cascade,
  all_day      boolean not null,
  starts_at    timestamptz,
  ends_at      timestamptz,
  start_date   date,
  end_date     date,
  constraint external_busy_time_chk check (
    (all_day and start_date is not null and end_date is not null)
    or (not all_day and starts_at is not null and ends_at is not null)
  )
);
create index external_busy_calendar_id_idx on public.external_busy (calendar_id);
create index external_busy_couple_id_idx   on public.external_busy (couple_id);
create index external_busy_user_id_idx     on public.external_busy (user_id);

-- 서버 전용 설정 (VAPID 키, 웹훅 비밀값 등). RLS on + 정책 없음 → service role / security definer 만 접근
create table public.app_config (
  key    text primary key,
  value  text not null
);

-- ─────────────────────────────────────────────
-- 일정 저장 RPC (비공개 분리 저장을 한 트랜잭션으로)
-- security invoker → RLS 그대로 적용
-- ─────────────────────────────────────────────
create function public.save_event(p jsonb)
returns public.events
language plpgsql security invoker set search_path = ''
as $$
declare
  v_private boolean := coalesce((p ->> 'is_private')::boolean, false);
  v_title   text    := btrim(coalesce(p ->> 'title', ''));
  v_loc     text    := nullif(btrim(coalesce(p ->> 'location', '')), '');
  v_memo    text    := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_row     public.events;
begin
  if (p ->> 'id') is null then
    insert into public.events (owner_id, title, location, memo, all_day, starts_at, ends_at,
                               start_date, end_date, rrule, is_private)
    values ((p ->> 'owner_id')::uuid,
            case when v_private then '' else v_title end,
            case when v_private then null else v_loc end,
            case when v_private then null else v_memo end,
            coalesce((p ->> 'all_day')::boolean, false),
            (p ->> 'starts_at')::timestamptz, (p ->> 'ends_at')::timestamptz,
            (p ->> 'start_date')::date, (p ->> 'end_date')::date,
            nullif(p ->> 'rrule', ''), v_private)
    returning * into v_row;
  else
    update public.events
       set owner_id   = (p ->> 'owner_id')::uuid,
           title      = case when v_private then '' else v_title end,
           location   = case when v_private then null else v_loc end,
           memo       = case when v_private then null else v_memo end,
           all_day    = coalesce((p ->> 'all_day')::boolean, false),
           starts_at  = (p ->> 'starts_at')::timestamptz,
           ends_at    = (p ->> 'ends_at')::timestamptz,
           start_date = (p ->> 'start_date')::date,
           end_date   = (p ->> 'end_date')::date,
           rrule      = nullif(p ->> 'rrule', ''),
           exdates    = case when rrule is distinct from nullif(p ->> 'rrule', '') then '{}' else exdates end,
           is_private = v_private
     where id = (p ->> 'id')::uuid
    returning * into v_row;
    if not found then
      raise exception 'event_not_found';
    end if;
  end if;

  if v_private then
    if char_length(v_title) = 0 then
      raise exception 'title_required';
    end if;
    insert into public.event_secrets (event_id, title, location, memo)
    values (v_row.id, v_title, v_loc, v_memo)
    on conflict (event_id) do update
      set title = excluded.title, location = excluded.location, memo = excluded.memo;
  else
    delete from public.event_secrets where event_id = v_row.id;
  end if;

  return v_row;
end
$$;
revoke execute on function public.save_event(jsonb) from public, anon;
grant  execute on function public.save_event(jsonb) to authenticated;

-- 구독 피드 주소 발급/재발급
create function public.rotate_feed_token()
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.feed_tokens (user_id, token) values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token, created_at = now();
  return v_token;
end
$$;
revoke execute on function public.rotate_feed_token() from public, anon;
grant  execute on function public.rotate_feed_token() to authenticated;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.events             enable row level security;
alter table public.event_secrets      enable row level security;
alter table public.event_comments     enable row level security;
alter table public.event_reactions    enable row level security;
alter table public.anniversaries      enable row level security;
alter table public.wishes             enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.feed_tokens        enable row level security;
alter table public.external_calendars enable row level security;
alter table public.external_busy      enable row level security;
alter table public.app_config         enable row level security;

-- events: 커플 모두 조회·작성. 비공개 일정은 소유자만 수정·삭제. 비공개는 본인 일정만.
create policy "커플 일정 조회" on public.events for select to authenticated
  using (couple_id = (select private.my_couple_id()));
create policy "커플 일정 작성" on public.events for insert to authenticated
  with check (
    couple_id = (select private.my_couple_id())
    and (owner_id is null or private.is_couple_member(owner_id))
    and (not is_private or owner_id = (select auth.uid()))
  );
create policy "커플 일정 수정" on public.events for update to authenticated
  using (couple_id = (select private.my_couple_id()) and (not is_private or owner_id = (select auth.uid())))
  with check (
    couple_id = (select private.my_couple_id())
    and (owner_id is null or private.is_couple_member(owner_id))
    and (not is_private or owner_id = (select auth.uid()))
  );
create policy "커플 일정 삭제" on public.events for delete to authenticated
  using (couple_id = (select private.my_couple_id()) and (not is_private or owner_id = (select auth.uid())));

-- event_secrets: 본인 것만
create policy "비공개 상세 본인만" on public.event_secrets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );

-- 댓글
create policy "댓글 조회" on public.event_comments for select to authenticated
  using (couple_id = (select private.my_couple_id()));
create policy "댓글 작성" on public.event_comments for insert to authenticated
  with check (
    couple_id = (select private.my_couple_id())
    and user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.couple_id = (select private.my_couple_id()))
  );
create policy "댓글 삭제" on public.event_comments for delete to authenticated
  using (user_id = (select auth.uid()));

-- 반응
create policy "반응 조회" on public.event_reactions for select to authenticated
  using (couple_id = (select private.my_couple_id()));
create policy "반응 작성" on public.event_reactions for insert to authenticated
  with check (
    couple_id = (select private.my_couple_id())
    and user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.couple_id = (select private.my_couple_id()))
  );
create policy "반응 삭제" on public.event_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- 기념일 · 위시: 커플 공동 관리
create policy "기념일 커플" on public.anniversaries for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (couple_id = (select private.my_couple_id()));
create policy "위시 커플" on public.wishes for all to authenticated
  using (couple_id = (select private.my_couple_id()))
  with check (
    couple_id = (select private.my_couple_id())
    and (event_id is null or exists (select 1 from public.events e where e.id = event_id and e.couple_id = (select private.my_couple_id())))
  );

-- 본인 것만
create policy "푸시 구독 본인" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "피드 토큰 본인" on public.feed_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "외부 캘린더 본인" on public.external_calendars for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 외부 바쁨: 커플 조회만 (쓰기는 service role)
create policy "외부 바쁨 조회" on public.external_busy for select to authenticated
  using (couple_id = (select private.my_couple_id()));

-- ─────────────────────────────────────────────
-- 권한 (anon 차단, 기본값 컬럼은 클라이언트가 못 바꾸게)
-- ─────────────────────────────────────────────
revoke all on public.events, public.event_secrets, public.event_comments, public.event_reactions,
              public.anniversaries, public.wishes, public.push_subscriptions, public.feed_tokens,
              public.external_calendars, public.external_busy, public.app_config
  from anon, authenticated;

grant select, delete on public.events to authenticated;
grant insert (owner_id, title, location, memo, all_day, starts_at, ends_at, start_date, end_date, rrule, exdates, is_private)
  on public.events to authenticated;
grant update (owner_id, title, location, memo, all_day, starts_at, ends_at, start_date, end_date, rrule, exdates, is_private)
  on public.events to authenticated;

grant select, delete on public.event_secrets to authenticated;
grant insert (event_id, title, location, memo), update (title, location, memo) on public.event_secrets to authenticated;

grant select, delete on public.event_comments to authenticated;
grant insert (event_id, body) on public.event_comments to authenticated;

grant select, delete on public.event_reactions to authenticated;
grant insert (event_id, emoji) on public.event_reactions to authenticated;

grant select, delete on public.anniversaries to authenticated;
grant insert (title, base_date, is_lunar, kind, emoji), update (title, base_date, is_lunar, kind, emoji)
  on public.anniversaries to authenticated;

grant select, delete on public.wishes to authenticated;
grant insert (title, url, tag, memo, done, event_id), update (title, url, tag, memo, done, event_id)
  on public.wishes to authenticated;

grant select, delete on public.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth, user_agent), update (p256dh, auth, user_agent) on public.push_subscriptions to authenticated;

grant select on public.feed_tokens to authenticated;   -- 발급은 rotate_feed_token()
grant insert (user_id, token), update (token, created_at) on public.feed_tokens to authenticated;

grant select, delete on public.external_calendars to authenticated;
grant insert (name, ics_url), update (name, ics_url) on public.external_calendars to authenticated;

grant select on public.external_busy to authenticated;

-- ─────────────────────────────────────────────
-- 실시간 반영
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table
  public.events, public.event_secrets, public.event_comments, public.event_reactions,
  public.anniversaries, public.wishes, public.external_busy, public.profiles, public.couples;
