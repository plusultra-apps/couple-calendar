-- N일째 기념일 챙기는 방식을 고를 수 있게: 주기(100일마다 / 1000일마다 / 안 챙김) + 특별한 날(22일·50일 등)
-- 사귄 날(couples)과 직접 추가한 기념일(anniversaries) 모두. 기준일 = 1일째.
-- 새 칸만 추가한다. anniversaries.count_days 는 지우지 않고 남겨 두며,
-- 앱은 day_every 가 비어 있고 count_days 가 켜져 있으면 '100일마다'로 읽는다.

-- 사귄 날: 기본은 지금처럼 100일마다
alter table public.couples
  add column day_every int default 100 check (day_every in (100, 1000)),
  add column day_marks int[] not null default '{}'
    check (cardinality(day_marks) <= 20 and 0 < all (day_marks) and 100000 > all (day_marks));
grant update (day_every, day_marks) on public.couples to authenticated;

-- 직접 추가한 기념일
alter table public.anniversaries
  add column day_every int check (day_every in (100, 1000)),
  add column day_marks int[] not null default '{}'
    check (cardinality(day_marks) <= 20 and 0 < all (day_marks) and 100000 > all (day_marks));
grant insert (day_every, day_marks), update (day_every, day_marks) on public.anniversaries to authenticated;
