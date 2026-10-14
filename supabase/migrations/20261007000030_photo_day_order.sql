-- 그날 사진 순서 (날짜 창에서 끌어서 바꾼다). 맨 앞(가장 작은 값) = 달력 사진 보기의 대표 사진.
-- NULL = 아직 순서를 안 정함 → 인생네컷 → 일정에 붙은 사진 → 먼저 올린 사진 순.
alter table public.photos add column day_order int;
grant update (day_order) on public.photos to authenticated;
