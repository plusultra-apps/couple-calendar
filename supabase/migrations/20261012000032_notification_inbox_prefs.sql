-- 알림함 · 알림 설정 · 알림 줄이기
-- 1) notifications: 받는 사람별 알림 기록 (앱 안 알림함). 쓰기는 Edge Function(service role)만.
--    deferred = 조용한 시간(밤 11시~아침 7시)이라 푸시를 미뤄 둔 것 → 아침 7시에 모아서 한 번 보낸다.
-- 2) profiles.notify_off: 푸시를 끈 알림 종류 / profiles.quiet_hours: 조용한 시간 사용
-- 3) 일정 수정 알림은 제목·날짜·시간·장소·주인·반복이 바뀔 때만, 위시는 2분 안 연속 담기를 한 번으로

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,  -- 받는 사람
  couple_id  uuid not null references public.couples (id) on delete cascade,
  kind       text not null check (kind in ('event', 'comment', 'wish', 'anniv', 'photo', 'like', 'reminder')),
  title      text not null,
  body       text not null default '',
  url        text not null default '/',
  deferred   boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_couple_id_idx    on public.notifications (couple_id);
create index notifications_deferred_idx     on public.notifications (user_id) where deferred;

alter table public.notifications enable row level security;

create policy "내 알림 조회" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "내 알림 읽음 표시" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "내 알림 지우기" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

-- 알림 설정
alter table public.profiles
  add column notify_off text[] not null default '{}'
    check (notify_off <@ array['event', 'comment', 'wish', 'anniv', 'photo', 'like', 'reminder']::text[]),
  add column quiet_hours boolean not null default true;
grant update (notify_off, quiet_hours) on public.profiles to authenticated;

-- 알림 트리거: 일정 수정·위시 담기 조건 추가 (나머지는 20261012000031 과 같음)
create or replace function private.notify_webhook()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
begin
  begin
    -- 로그인 사용자의 변경만 알린다 (service role · cron 변경 제외)
    if auth.uid() is null then
      return null;
    end if;

    if tg_table_name = 'events' then
      if tg_op = 'INSERT' then
        if new.hidden then
          return null;
        end if;
        -- 도장 연속 찍기: 같은 제목을 2분 안에 또 추가하면 생략
        if new.title <> '' and exists (
             select 1 from public.events e
              where e.id <> new.id
                and e.couple_id = new.couple_id
                and e.created_by = auth.uid()
                and e.title = new.title
                and e.created_at > now() - interval '2 minutes'
           ) then
          return null;
        end if;
      elsif tg_op = 'UPDATE' then
        if new.hidden or old.hidden then
          return null;
        end if;
        -- 상대가 알아야 할 것(제목·날짜·시간·장소·주인·공개 범위·반복)이 바뀔 때만. 메모·제외일 수정은 조용히.
        if (new.title, new.all_day, new.starts_at, new.ends_at, new.start_date, new.end_date,
            new.location, new.owner_id, new.is_private, new.rrule)
           is not distinct from
           (old.title, old.all_day, old.starts_at, old.ends_at, old.start_date, old.end_date,
            old.location, old.owner_id, old.is_private, old.rrule) then
          return null;
        end if;
      else -- DELETE
        if old.hidden then
          return null;
        end if;
        -- 도장 되돌리기: 방금(2분 안) 만든 일정을 지우면 생략
        if old.created_at > now() - interval '2 minutes' then
          return null;
        end if;
      end if;

    elsif tg_table_name = 'photos' then
      -- 나만 보기 일정에 붙인 사진은 상대가 못 보므로 알리지 않는다
      if new.event_id is not null and exists (
           select 1 from public.events e where e.id = new.event_id and e.hidden
         ) then
        return null;
      end if;
      -- 연달아 올리는 중이면(2분 안에 올린 사진이 이미 있으면) 생략 — 장수는 notify 가 센다
      if exists (
           select 1 from public.photos p
            where p.id <> new.id
              and p.couple_id = new.couple_id
              and p.created_by = auth.uid()
              and p.created_at > now() - interval '2 minutes'
         ) then
        return null;
      end if;

    elsif tg_table_name = 'photo_likes' then
      if exists (
           select 1 from public.photo_likes l
            where l.photo_id <> new.photo_id
              and l.couple_id = new.couple_id
              and l.user_id = auth.uid()
              and l.created_at > now() - interval '2 minutes'
         ) then
        return null;
      end if;

    elsif tg_table_name = 'wishes' then
      if tg_op = 'UPDATE' then
        if not (new.done and not old.done) then
          return null;
        end if;
      else -- INSERT: 2분 안에 연달아 담으면 첫 번째만 — 개수는 notify 가 센다
        if exists (
             select 1 from public.wishes w
              where w.id <> new.id
                and w.couple_id = new.couple_id
                and w.created_by = auth.uid()
                and w.created_at > now() - interval '2 minutes'
           ) then
          return null;
        end if;
      end if;
    end if;

    select value into v_secret from public.app_config where key = 'webhook_secret';
    if v_secret is null then
      return null;
    end if;

    perform net.http_post(
      url     := 'https://yoouuwcyylqisnuaevdl.supabase.co/functions/v1/notify',
      body    := jsonb_build_object(
                   'table',      tg_table_name,
                   'op',         tg_op,
                   'record',     case when tg_op <> 'DELETE' then to_jsonb(new) end,
                   'old_record', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                   'actor',      auth.uid()
                 ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notify_webhook 실패 (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end
$$;
revoke execute on function private.notify_webhook() from public, anon, authenticated;

-- 매일 아침 7시(서울) = 22:00 UTC: 밤사이 모아 둔 알림 보내기 + 오늘 일정·기념일 미리 알림
select cron.schedule(
  'daily-reminders',
  '0 22 * * *',
  $job$
  select net.http_post(
    url     := 'https://yoouuwcyylqisnuaevdl.supabase.co/functions/v1/remind',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
               ),
    timeout_milliseconds := 60000
  )
  $job$
);
