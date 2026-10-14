-- 푸시 알림: 일정·댓글·반응·위시·기념일 변경 → Edge Function `notify` 로 비동기 전송 (PLAN.md 6장)
-- pg_net 은 요청을 큐에 넣고 바로 돌아오므로 사용자의 쓰기를 늦추지 않는다.
create extension if not exists pg_net with schema extensions;

create function private.notify_webhook()
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

create trigger events_notify after insert or update or delete on public.events
  for each row execute function private.notify_webhook();
create trigger event_comments_notify after insert on public.event_comments
  for each row execute function private.notify_webhook();
create trigger event_reactions_notify after insert on public.event_reactions
  for each row execute function private.notify_webhook();
create trigger wishes_notify after insert on public.wishes
  for each row execute function private.notify_webhook();
create trigger anniversaries_notify after insert on public.anniversaries
  for each row execute function private.notify_webhook();
