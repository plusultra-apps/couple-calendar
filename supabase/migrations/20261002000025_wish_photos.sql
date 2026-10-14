-- 위시 카드에 바로 펼쳐 보여 줄 장소 사진 몇 장 (카카오 썸네일 주소). 목록을 열 때마다 검색하지 않도록 담을 때 저장한다.
alter table public.wishes
  add column photos text[] not null default '{}'
  check (cardinality(photos) <= 6);

grant insert (photos), update (photos) on public.wishes to authenticated;
