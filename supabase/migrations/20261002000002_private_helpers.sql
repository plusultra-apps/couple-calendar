-- RLS 전용 헬퍼를 REST API 에 노출되지 않는 private 스키마로 옮긴다.
-- 정책은 함수 OID 를 참조하므로 스키마 이동 후에도 그대로 동작한다.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.my_couple_id() set schema private;

revoke execute on function private.my_couple_id() from public, anon;
grant  execute on function private.my_couple_id() to authenticated;
