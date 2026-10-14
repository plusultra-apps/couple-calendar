-- 무료 플랜 일시 정지(일정 기간 활동 없음) 방지용 임시 데이터.
-- 앱 데이터와 완전히 분리: 앱 사용자 접근 불가(RLS on, 정책 없음), 알림 트리거·실시간 구독·내보내기에 연결하지 않는다.
-- 매일 새벽 4시(서울) cron → Edge Function `keepalive` 가 API 를 거쳐 한 줄 넣고(30일 지난 줄은 정리) 읽기도 한 번 한다.
create table public.keepalive (
  id        bigint generated always as identity primary key,
  pinged_at timestamptz not null default now(),
  note      text not null default 'mock'
);
alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;

select cron.schedule(
  'keepalive-ping',
  '0 19 * * *', -- 19:00 UTC = 04:00 서울
  $job$
  select net.http_post(
    url     := 'https://yoouuwcyylqisnuaevdl.supabase.co/functions/v1/keepalive',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
               ),
    timeout_milliseconds := 30000
  )
  $job$
);
