-- 위시에 장소 정보 저장 (카카오 장소 검색으로 고른 경우)
-- 대표 사진은 다음 이미지 검색의 썸네일 주소. 상세 사진·후기는 place-info 함수로 그때그때 가져온다.
alter table public.wishes
  add column place_id      text,
  add column place_name    text,
  add column place_address text,
  add column place_x       double precision,
  add column place_y       double precision,
  add column photo_url     text check (photo_url is null or photo_url ~* '^https://');

grant insert (place_id, place_name, place_address, place_x, place_y, photo_url),
      update (place_id, place_name, place_address, place_x, place_y, photo_url)
  on public.wishes to authenticated;
