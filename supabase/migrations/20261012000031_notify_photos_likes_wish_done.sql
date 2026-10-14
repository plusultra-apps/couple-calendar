-- 알림 대상 추가: 사진 올리기 · 사진 하트 · 위시 이루기
-- · 사진을 여러 장 연달아 올리면 첫 장만 알린다 (몇 장인지는 notify 함수가 잠깐 기다렸다 센다)
-- · 하트를 연달아 누르면(2분 안) 첫 번째만 알린다
-- · 위시는 done 이 false → true 로 바뀔 때만
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

    elsif tg_table_name = 'photos' then
      -- 나만 보기 일정에 붙인 사진은 상대가 못 보므로 알리지 않는다
      if new.event_id is not null and exists (
           select 1 from public.events e where e.id = new.event_id and e.hidden
         ) then
        return null;
      end if;
      -- 연달아 올리는 중이면(2분 안에 올린 사진이 이미 있으면) 생략
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

    elsif tg_table_name = 'wishes' and tg_op = 'UPDATE' then
      if not (new.done and not old.done) then
        return null;
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

create trigger photos_notify after insert on public.photos
  for each row execute function private.notify_webhook();
create trigger photo_likes_notify after insert on public.photo_likes
  for each row execute function private.notify_webhook();
create trigger wishes_done_notify after update of done on public.wishes
  for each row execute function private.notify_webhook();
