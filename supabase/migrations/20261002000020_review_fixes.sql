-- 코드 검토 반영
-- 1) save_event: 반복 종료일(UNTIL)만 바꿀 때는 '이 일정만 삭제'한 날(exdates)을 유지한다.
--    반복 방식(FREQ/INTERVAL/BY...)이나 시작 시각이 바뀌면 예전 제외일이 엉뚱한 회차에 걸리므로 비운다.
-- 2) feed_tokens: 토큰은 rotate_feed_token() 으로만 만든다(클라이언트가 임의 값 지정 불가).

create or replace function public.save_event(p jsonb)
returns public.events
language plpgsql security invoker set search_path = ''
as $$
declare
  v_private boolean := coalesce((p ->> 'is_private')::boolean, false);
  v_title   text    := btrim(coalesce(p ->> 'title', ''));
  v_loc     text    := nullif(btrim(coalesce(p ->> 'location', '')), '');
  v_memo    text    := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_rrule   text    := nullif(p ->> 'rrule', '');
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
            v_rrule, v_private)
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

-- 피드 토큰: 직접 쓰기 권한을 거두고 발급 함수만 security definer 로
revoke insert, update on public.feed_tokens from authenticated;

create or replace function public.rotate_feed_token()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.feed_tokens (user_id, token) values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token, created_at = now();
  return v_token;
end
$$;
revoke execute on function public.rotate_feed_token() from public, anon;
grant  execute on function public.rotate_feed_token() to authenticated;
