-- 배경·프로필 사진에서 보이는 위치 (0~100 %, 가운데 50). 사진이 잘릴 때 두 사람이 원하는 부분을 고른다.
alter table public.couples
  add column cover_x smallint not null default 50 check (cover_x between 0 and 100),
  add column cover_y smallint not null default 50 check (cover_y between 0 and 100);

alter table public.profiles
  add column photo_x smallint not null default 50 check (photo_x between 0 and 100),
  add column photo_y smallint not null default 50 check (photo_y between 0 and 100);
