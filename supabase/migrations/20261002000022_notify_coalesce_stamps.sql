-- 도장 찍기 알림 묶기: 같은 사람이 같은 제목의 일정을 2분 안에 여러 개 추가하면 첫 번째만 알린다.
-- 방금(2분 안) 만든 일정을 지우는 경우(도장 되돌리기)도 알리지 않는다.
create or replace function private.notify_webhook()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
begin
  -- 알림 실패가 사용자의 저장을 막으면 안 된다: 모든 오류를 삼킨다
  begin
    -- 반복 일정의 "이 날만 빼기"(exdates) · updated_at 만 바뀐 수정은 알리지 않는다
    if tg_table_name = 'events' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'exdates' - 'updated_at') = (to_jsonb(old) - 'exdates' - 'updated_at') then
      return null;
    end if;

    -- 로그인 사용자의 변경만 알린다 (service role · cron 변경 제외)
    if auth.uid() is null then
      return null;
    end if;

    -- 도장 연속 찍기: 같은 제목을 방금 추가했으면 생략
    if tg_table_name = 'events' and tg_op = 'INSERT' and exists (
         select 1 from public.events e
          where e.id <> new.id
            and e.couple_id = new.couple_id
            and e.created_by = auth.uid()
            and e.title = new.title
            and e.title <> ''
            and e.created_at > now() - interval '2 minutes'
       ) then
      return null;
    end if;

    -- 도장 되돌리기: 방금 만든 일정을 지우면 생략
    if tg_table_name = 'events' and tg_op = 'DELETE' and old.created_at > now() - interval '2 minutes' then
      return null;
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
