-- 1) 나만 보는 일정(hidden): 상대는 행 자체를 조회할 수 없다 (비공개 '바쁨' 과 다름)
-- 2) 프로필 아바타(동물 이모지): 달력에서 누구 일정인지 한눈에

-- ── 아바타 ──
alter table public.profiles add column avatar text not null default '🐻'
  check (char_length(avatar) between 1 and 16);
grant update (avatar) on public.profiles to authenticated;

-- 나중에 들어온 사람은 토끼로 시작
create or replace function public.join_couple(p_code text)
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
     set couple_id = v_couple.id, color = '#F8B4C4', avatar = '🐰'
   where id = auth.uid();

  return v_couple;
end
$$;

-- ── 나만 보는 일정 ──
alter table public.events add column hidden boolean not null default false;
alter table public.events add constraint events_hidden_chk
  check (not hidden or (owner_id is not null and not is_private));
grant insert (hidden), update (hidden) on public.events to authenticated;

alter policy "커플 일정 조회" on public.events
  using (couple_id = (select private.my_couple_id()) and (not hidden or owner_id = (select auth.uid())));
alter policy "커플 일정 작성" on public.events
  with check (
    couple_id = (select private.my_couple_id())
    and (owner_id is null or private.is_couple_member(owner_id))
    and (not is_private or owner_id = (select auth.uid()))
    and (not hidden or owner_id = (select auth.uid()))
  );
alter policy "커플 일정 수정" on public.events
  using (
    couple_id = (select private.my_couple_id())
    and (not is_private or owner_id = (select auth.uid()))
    and (not hidden or owner_id = (select auth.uid()))
  )
  with check (
    couple_id = (select private.my_couple_id())
    and (owner_id is null or private.is_couple_member(owner_id))
    and (not is_private or owner_id = (select auth.uid()))
    and (not hidden or owner_id = (select auth.uid()))
  );
alter policy "커플 일정 삭제" on public.events
  using (
    couple_id = (select private.my_couple_id())
    and (not is_private or owner_id = (select auth.uid()))
    and (not hidden or owner_id = (select auth.uid()))
  );

-- save_event: hidden 지원 (나만 보기는 제목을 events 에 그대로 둔다 — 상대가 행을 못 보므로)
create or replace function public.save_event(p jsonb)
returns public.events
language plpgsql security invoker set search_path = ''
as $$
declare
  v_hidden  boolean := coalesce((p ->> 'hidden')::boolean, false);
  v_private boolean := coalesce((p ->> 'is_private')::boolean, false) and not v_hidden;
  v_title   text    := btrim(coalesce(p ->> 'title', ''));
  v_loc     text    := nullif(btrim(coalesce(p ->> 'location', '')), '');
  v_memo    text    := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_rrule   text    := nullif(p ->> 'rrule', '');
  v_row     public.events;
begin
  if (p ->> 'id') is null then
    insert into public.events (owner_id, title, location, memo, all_day, starts_at, ends_at,
                               start_date, end_date, rrule, is_private, hidden)
    values ((p ->> 'owner_id')::uuid,
            case when v_private then '' else v_title end,
            case when v_private then null else v_loc end,
            case when v_private then null else v_memo end,
            coalesce((p ->> 'all_day')::boolean, false),
            (p ->> 'starts_at')::timestamptz, (p ->> 'ends_at')::timestamptz,
            (p ->> 'start_date')::date, (p ->> 'end_date')::date,
            v_rrule, v_private, v_hidden)
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
           rrule      = v_rrule,
           exdates    = case
                          when v_rrule is null then '{}'
                          when regexp_replace(coalesce(rrule, ''), ';?UNTIL=[^;]*', '')
                               is distinct from regexp_replace(v_rrule, ';?UNTIL=[^;]*', '') then '{}'
                          when start_date is distinct from (p ->> 'start_date')::date
                            or starts_at  is distinct from (p ->> 'starts_at')::timestamptz then '{}'
                          else exdates
                        end,
           is_private = v_private,
           hidden     = v_hidden
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

-- 알림 트리거 정리
-- · 나만 보는 일정은 알리지 않는다
-- · 일정 전용 조건(title·hidden·created_at)은 events 일 때만 평가한다.
--   (다른 테이블 레코드엔 그 컬럼이 없어서, 한 IF 식에 섞으면 런타임 오류 → 알림이 조용히 빠졌다)
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
        -- 반복 일정의 "이 날만 빼기"(exdates) · updated_at 만 바뀐 수정은 알리지 않는다
        if (to_jsonb(new) - 'exdates' - 'updated_at') = (to_jsonb(old) - 'exdates' - 'updated_at') then
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
