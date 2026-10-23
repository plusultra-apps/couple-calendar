-- 1시간 전 알림(Edge Function remind-soon)의 중복 발송 방지 표.
-- 이미 알린 (일정, 회차) 를 남겨 두어 반복 일정도 회차별로 한 번만 보낸다.
-- 앱에서는 쓰지 않는 서버 전용 표 → RLS 켜고 정책 없음(app_config 와 같은 방식: service role 만 접근).
create table if not exists public.event_reminders (
  event_id uuid not null references public.events(id) on delete cascade,
  occ_key date not null,              -- 그 회차의 서울 날짜 (반복 일정 회차 구분)
  sent_at timestamptz not null default now(),
  primary key (event_id, occ_key)
);

alter table public.event_reminders enable row level security;
-- 정책을 만들지 않는다: anon·authenticated 는 접근 불가, Edge Function(service role) 만 읽고 쓴다.
