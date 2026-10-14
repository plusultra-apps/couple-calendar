-- 직접 추가한 기념일도 100일 단위로 챙기기 (예: 처음 만난 날 100일·200일…)
-- 계산은 화면(lib/anniversary.ts)과 구독 피드(_shared/anniversary.ts)에서 한다. 기준일 = 1일째.
alter table public.anniversaries add column count_days boolean not null default false;
grant insert (count_days), update (count_days) on public.anniversaries to authenticated;
