-- 회사 캘린더 동기화: 30분마다 Edge Function `sync-external` 호출 (PLAN.md 6장)
-- 비밀값(cron_secret)은 실행할 때 app_config 에서 읽는다 (잡 정의에 남기지 않음).
create extension if not exists pg_cron;

select cron.schedule(
  'sync-external-calendars',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url     := 'https://yoouuwcyylqisnuaevdl.supabase.co/functions/v1/sync-external',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
               ),
    timeout_milliseconds := 60000
  )
  $job$
);
