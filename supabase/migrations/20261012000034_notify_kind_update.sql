-- 알림 종류에 'update'(앱 업데이트 소식) 추가. 배포 스크립트(scripts/deploy.mjs --notes)가 notify 함수로 보낸다.
-- 인증 비밀값은 app_config.release_secret (마이그레이션에 남기지 않고 따로 넣는다) — 로컬 .env.local 의 RELEASE_SECRET 과 같다.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('event', 'comment', 'wish', 'anniv', 'photo', 'like', 'reminder', 'update'));

alter table public.profiles drop constraint profiles_notify_off_check;
alter table public.profiles add constraint profiles_notify_off_check
  check (notify_off <@ array['event', 'comment', 'wish', 'anniv', 'photo', 'like', 'reminder', 'update']::text[]);
