-- 실사용 시작 전에 한 번 실행: 개발용 계정(dev1/dev2)과 그 커플·일정·위시를 모두 지운다.
-- Supabase 대시보드 SQL Editor 에서 실행. 되돌릴 수 없으니 먼저 아래 SELECT 로 대상 확인.
--
-- 1) 확인
select u.email, p.nickname, p.couple_id
  from auth.users u
  join public.profiles p on p.id = u.id
 where u.email in ('dev1@example.com', 'dev2@example.com');

-- 2) 삭제 (커플을 지우면 events·wishes·anniversaries·댓글·반응이 함께 지워진다 — on delete cascade)
begin;
delete from public.couples
 where id in (select couple_id from public.profiles p join auth.users u on u.id = p.id
               where u.email in ('dev1@example.com', 'dev2@example.com'));
delete from auth.users where email in ('dev1@example.com', 'dev2@example.com');
-- 지워진 건수를 확인한 뒤 commit, 이상하면 rollback
commit;

-- 3) 웹 쪽: web/.env.local 의 VITE_DEV_PASSWORD 줄을 지우면 개발자 로그인 버튼도 사라진다.
