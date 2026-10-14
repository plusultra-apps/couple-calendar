-- 몽글 인디언 포커 검증 (migration 20261014000035_poker.sql 적용 뒤 실행)
-- CLAUDE.md 의 롤백 패턴: 전부 한 DO 블록 안에서 하고 마지막에 raise exception 'TEST_RESULT ...' 로 끝내
-- 가짜 사용자·커플·게임이 하나도 남지 않는다. (알림 트리거의 pg_net 요청도 같은 트랜잭션이라 함께 취소된다)
-- 결과는 오류 메시지 "TEST_RESULT ..." 에 줄마다 ok / FAIL 로 나온다. 맨 끝 줄에 FAIL 개수.
--
-- 사용자 흉내: set_config('request.jwt.claims', {"sub": ...}, true) + set local role authenticated
-- 카드 고정·덱 조작·확인 조회는 reset role 로 돌아와(postgres) 직접 한다.

do $$
declare
  a    uuid := gen_random_uuid();   -- 커플1: 게임 만든 사람
  b    uuid := gen_random_uuid();   -- 커플1: 상대
  c    uuid := gen_random_uuid();   -- 커플2
  d    uuid := gen_random_uuid();   -- 커플2
  cp1  uuid;
  cp2  uuid;
  g    uuid;  g2 uuid;  g3 uuid;
  r1   uuid;  r2 uuid;  r3 uuid;  r4 uuid;  r5 uuid;  r6 uuid;  rx uuid;
  n    int;   n2 int;
  t    text;
  q    smallint;
  hs   text[];
  rnd  public.poker_rounds;
  res  text := '';
begin
  begin
    -- ── 준비: 가짜 사용자 4명(프로필은 handle_new_user 트리거가 만든다) · 커플 2개 ──
    insert into auth.users (id, email, aud, role, raw_user_meta_data) values
      (a, 'poker-test-a-' || a || '@example.invalid', 'authenticated', 'authenticated', '{"nickname":"포커A"}'),
      (b, 'poker-test-b-' || b || '@example.invalid', 'authenticated', 'authenticated', '{"nickname":"포커B"}'),
      (c, 'poker-test-c-' || c || '@example.invalid', 'authenticated', 'authenticated', '{"nickname":"포커C"}'),
      (d, 'poker-test-d-' || d || '@example.invalid', 'authenticated', 'authenticated', '{"nickname":"포커D"}');
    insert into public.couples (started_on, invite_code) values (current_date, 'PT' || left(md5(random()::text), 10))
      returning id into cp1;
    insert into public.couples (started_on, invite_code) values (current_date, 'PT' || left(md5(random()::text), 10))
      returning id into cp2;
    update public.profiles set couple_id = cp1 where id in (a, b);
    update public.profiles set couple_id = cp2 where id in (c, d);

    -- ── 열기 · 참가 ──
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    g := public.poker_open(1, 4, 8);
    res := res || E'\n' || case when public.poker_open(2, 6, 12) = g then 'ok   ' else 'FAIL ' end || 'open 두 번 → 같은 게임';

    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    res := res || E'\n' || case when public.poker_open() = g then 'ok   ' else 'FAIL ' end || '상대가 open → 기존 게임 id';
    select count(*) into n from public.poker_games where id = g and status = 'waiting' and base_q = 1 and max_q = 4;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || '참가 전 waiting · 처음 설정 유지';
    perform public.poker_join(g);
    perform public.poker_join(g);   -- 두 번 눌러도 무시
    select count(*) into n from public.poker_rounds where game_id = g;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'join 두 번 → 판 1개 (' || n || ')';
    select * into rnd from public.poker_rounds where game_id = g and round_no = 1;
    r1 := rnd.id;
    res := res || E'\n' || case when rnd.status = 'betting' and rnd.pot_q = 1 and rnd.first_user = a and rnd.turn_user = a
                                then 'ok   ' else 'FAIL ' end || '1판: betting · pot 1 · 선 = 만든 사람';
    select count(*) into n from public.poker_games where id = g and status = 'playing' and round_no = 1;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || '두 명 → playing';

    -- ── 핵심 보안: 진행 중 판의 내 카드 ──
    select count(*) into n from public.poker_hands where round_id = r1 and user_id = b;
    select count(*) into n2 from public.poker_hands where round_id = r1 and user_id = a;
    res := res || E'\n' || case when n = 0 and n2 = 1 then 'ok   ' else 'FAIL ' end || 'B: 진행 중 내 카드 0행 / 상대 카드 1행';
    select count(*) into n from public.poker_hands where user_id = b;
    res := res || E'\n' || case when n = 0 then 'ok   ' else 'FAIL ' end || 'B: 조건 없이 조회해도 내 카드 0행';

    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.poker_hands where round_id = r1 and user_id = a;
    select count(*) into n2 from public.poker_hands where round_id = r1 and user_id = b;
    res := res || E'\n' || case when n = 0 and n2 = 1 then 'ok   ' else 'FAIL ' end || 'A: 진행 중 내 카드 0행 / 상대 카드 1행';

    begin
      select count(*) into n from private.poker_decks;
      res := res || E'\nFAIL 덱 직접 조회 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   덱 직접 조회 거부 — ' || sqlerrm;
    end;
    begin
      perform private.poker_hint(12);
      res := res || E'\nFAIL 힌트 내부 함수 실행 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   힌트 내부 함수 실행 거부 — ' || sqlerrm;
    end;
    begin
      update public.poker_players set drunk_q = 0 where game_id = g;
      res := res || E'\nFAIL 참가자 직접 수정 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   참가자 직접 수정 거부 — ' || sqlerrm;
    end;
    begin
      update public.poker_hands set card = 1 where round_id = r1;
      res := res || E'\nFAIL 카드 직접 수정 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   카드 직접 수정 거부 — ' || sqlerrm;
    end;

    -- 덱: 19장 남고, 덱 + 카드 2장 = 1~21 한 벌
    execute 'reset role';
    select count(*), count(distinct x) into n, n2 from (
      select unnest(cards) as x from private.poker_decks where game_id = g
      union all select card from public.poker_hands where round_id = r1) s;
    res := res || E'\n' || case when n = 21 and n2 = 21 then 'ok   ' else 'FAIL ' end || '첫 딜: 덱 19 + 카드 2 = 21장 한 벌';

    -- ── 1판: 엿보기(조커) · raise 상한 · 차례 · call 조커 승리 ──
    update public.poker_hands set card = 21 where round_id = r1 and user_id = a;
    update public.poker_hands set card = 20 where round_id = r1 and user_id = b;

    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    t := public.poker_peek(r1);
    res := res || E'\n' || case when t = 'lonely' then 'ok   ' else 'FAIL ' end || '엿보기(조커) → lonely (' || t || ')';
    begin
      perform public.poker_peek(r1);
      res := res || E'\nFAIL 한 판 두 번 엿보기 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   한 판 두 번 엿보기 거부 — ' || sqlerrm;
    end;
    select count(*) into n from public.poker_peeks where round_id = r1;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'A: 내 엿보기 결과 1행';

    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.poker_peeks;
    select count(*) into n2 from public.poker_rounds where id = r1 and a = any (peeked_by);
    res := res || E'\n' || case when n = 0 and n2 = 1 then 'ok   ' else 'FAIL ' end || 'B: 상대 엿보기 결과 0행 · 썼다는 사실(peeked_by)만 보임';
    begin
      perform public.poker_act(r1, 'raise');
      res := res || E'\nFAIL 차례 아닌 사람 act 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   차례 아닌 사람 act 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_act(r1, 'allin');
      res := res || E'\nFAIL 알 수 없는 행동 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   알 수 없는 행동 거부 — ' || sqlerrm;
    end;

    -- A raise(2) → B raise(3) → A raise(4) → B raise 거부(최대 4) → B call
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_act(r1, 'raise');
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_act(r1, 'raise');
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_act(r1, 'raise');
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select * into rnd from public.poker_rounds where id = r1;
    res := res || E'\n' || case when rnd.pot_q = 4 and rnd.turn_user = b and rnd.last_action = 'raise' and rnd.last_actor = a
                                then 'ok   ' else 'FAIL ' end || 'raise 3번 → pot 4 · 차례 B';
    begin
      perform public.poker_act(r1, 'raise');
      res := res || E'\nFAIL raise 상한(max_q=4) 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   raise 상한(max_q=4) 거부 — ' || sqlerrm;
    end;
    perform public.poker_act(r1, 'call');
    select * into rnd from public.poker_rounds where id = r1;
    res := res || E'\n' || case when rnd.status = 'done' and rnd.turn_user is null and rnd.winner_id = a and rnd.loser_id = b
                                     and rnd.result = 'call' and rnd.drink_q = 4 and rnd.ended_at is not null
                                then 'ok   ' else 'FAIL ' end || 'call: 조커(A) 가 20(B) 이김 · B 가 pot 4 마심';
    select count(*) into n from public.poker_hands where round_id = r1;
    res := res || E'\n' || case when n = 2 then 'ok   ' else 'FAIL ' end || 'B: done 후 카드 둘 다 보임';
    begin
      perform public.poker_act(r1, 'call');
      res := res || E'\nFAIL 끝난 판에 act 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   끝난 판에 act 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_peek(r1);
      res := res || E'\nFAIL 끝난 판에 엿보기 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   끝난 판에 엿보기 거부 — ' || sqlerrm;
    end;

    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.poker_hands where round_id = r1;
    res := res || E'\n' || case when n = 2 then 'ok   ' else 'FAIL ' end || 'A: done 후 카드 둘 다 보임';
    begin
      perform public.poker_use_half(r1);
      res := res || E'\nFAIL 이긴 사람 반잔권 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   이긴 사람 반잔권 거부 — ' || sqlerrm;
    end;
    select count(*) into n from public.poker_players where game_id = g and user_id = b and drunk_q = 4 and lose_streak = 1;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'B drunk 4 · 연패 1';

    -- ── 2판: next_round 중복 호출 · 선 교대 · fold 2배 · 반잔권(2→1) ──
    r2 := public.poker_next_round(g);
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    rx := public.poker_next_round(g);
    res := res || E'\n' || case when rx = r2 then 'ok   ' else 'FAIL ' end || 'next_round 두 사람이 눌러도 같은 판';
    select * into rnd from public.poker_rounds where id = r2;
    res := res || E'\n' || case when rnd.round_no = 2 and rnd.first_user = b and rnd.turn_user = b and rnd.pot_q = 1
                                then 'ok   ' else 'FAIL ' end || '2판: 선 = 상대(B)';

    execute 'reset role';
    update public.poker_hands set card = 20 where round_id = r2 and user_id = b;
    update public.poker_hands set card = 5  where round_id = r2 and user_id = a;
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    t := public.poker_peek(r2);
    res := res || E'\n' || case when t in ('4', '5') then 'ok   ' else 'FAIL ' end || 'B 엿보기(20) → 4|5 (' || t || ')';
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.poker_peek(r2);
      res := res || E'\nFAIL 엿보기 다 쓴 뒤 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   엿보기 다 쓴 뒤 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_act(r2, 'fold');
      res := res || E'\nFAIL 차례 아닌 사람 fold 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   차례 아닌 사람 fold 거부 — ' || sqlerrm;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_act(r2, 'fold');
    select * into rnd from public.poker_rounds where id = r2;
    res := res || E'\n' || case when rnd.result = 'fold' and rnd.loser_id = b and rnd.winner_id = a and rnd.drink_q = 2
                                then 'ok   ' else 'FAIL ' end || 'fold(20) → 2배 벌칙 2 (' || coalesce(rnd.drink_q::text, 'null') || ')';
    q := public.poker_use_half(r2);
    res := res || E'\n' || case when q = 1 then 'ok   ' else 'FAIL ' end || '반잔권 2 → 1 (' || q || ')';
    begin
      perform public.poker_use_half(r2);
      res := res || E'\nFAIL 반잔권 한 판 두 번 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   반잔권 한 판 두 번 거부 — ' || sqlerrm;
    end;
    select count(*) into n from public.poker_players where game_id = g and user_id = b and drunk_q = 5 and half_left = 0 and lose_streak = 2;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'B drunk 4+2-1=5 · 반잔권 0 · 연패 2';
    select count(*) into n from public.poker_rounds where id = r2 and half_used and drink_q = 1;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || '2판 half_used · drink_q 1';

    -- ── 3판: call 일반 승패 · 3연패 보너스 · 반잔권(1→0 면제) ──
    r3 := public.poker_next_round(g);
    execute 'reset role';
    update public.poker_hands set card = 10 where round_id = r3 and user_id = a;
    update public.poker_hands set card = 5  where round_id = r3 and user_id = b;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select first_user into rx from public.poker_rounds where id = r3;
    res := res || E'\n' || case when rx = a then 'ok   ' else 'FAIL ' end || '3판: 선 = 만든 사람(A)';
    perform public.poker_act(r3, 'call');
    select * into rnd from public.poker_rounds where id = r3;
    res := res || E'\n' || case when rnd.winner_id = a and rnd.loser_id = b and rnd.drink_q = 1
                                then 'ok   ' else 'FAIL ' end || 'call: 10(A) > 5(B) · B 가 1 마심';
    select count(*) into n from public.poker_players where game_id = g and user_id = b and half_left = 1 and lose_streak = 0 and drunk_q = 6;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || '3연패 → 반잔권 +1 · 연패 0';
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    q := public.poker_use_half(r3);
    res := res || E'\n' || case when q = 0 then 'ok   ' else 'FAIL ' end || '반잔권 1 → 0 면제 (' || q || ')';
    select count(*) into n from public.poker_players where game_id = g and user_id = b and drunk_q = 5 and half_left = 0;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'B drunk 6-1=5 · 반잔권 0';
    select count(*) into n from public.poker_players where game_id = g and user_id = a and drunk_q = 0 and lose_streak = 0 and peek_left = 0 and half_left = 1;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'A drunk 0 · 연패 0 · 엿보기 0 · 반잔권 1';

    -- ── 덱 소진: 1장 남음 → 21장 다시 섞기 / 딱 2장 → 그 2장 · 빈 덱 / 빈 덱 → 다시 섞기 ──
    execute 'reset role';
    update private.poker_decks set cards = '{7}' where game_id = g;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    r4 := public.poker_next_round(g);
    execute 'reset role';
    select count(*), count(distinct x) into n, n2 from (
      select unnest(cards) as x from private.poker_decks where game_id = g
      union all select card from public.poker_hands where round_id = r4) s;
    res := res || E'\n' || case when n = 21 and n2 = 21 then 'ok   ' else 'FAIL ' end || '덱 1장 → 21장 다시 섞음 (' || n || '/' || n2 || ')';
    update public.poker_hands set card = 1 where round_id = r4 and user_id = b;
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_act(r4, 'fold');   -- 4판 선 = B, 카드 1 다이 → 1
    select drink_q into q from public.poker_rounds where id = r4;
    res := res || E'\n' || case when q = 1 then 'ok   ' else 'FAIL ' end || 'fold(1) → 기본 벌칙 1';

    execute 'reset role';
    update private.poker_decks set cards = '{8,9}' where game_id = g;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    r5 := public.poker_next_round(g);
    execute 'reset role';
    select array_agg(card::text order by card) into hs from public.poker_hands where round_id = r5;
    select cardinality(cards) into n from private.poker_decks where game_id = g;
    res := res || E'\n' || case when hs = array['8', '9'] and n = 0 then 'ok   ' else 'FAIL ' end || '덱 2장 → 그 2장 딜 · 덱 0장';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_act(r5, 'fold');   -- 5판 선 = A
    r6 := public.poker_next_round(g);
    execute 'reset role';
    select count(*), count(distinct x) into n, n2 from (
      select unnest(cards) as x from private.poker_decks where game_id = g
      union all select card from public.poker_hands where round_id = r6) s;
    res := res || E'\n' || case when n = 21 and n2 = 21 then 'ok   ' else 'FAIL ' end || '빈 덱 → 21장 다시 섞음 (' || n || '/' || n2 || ')';
    select count(*) into n from public.poker_players where game_id = g and user_id = a and drunk_q = 1 and lose_streak = 1;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'A fold(8) → drunk 1 · 연패 1';

    -- 다음 판(6판)이 이미 시작된 뒤에도 지난 판(5판) 반잔권은 쓸 수 있다 (프론트: 결과 보는 사이 상대가 다음 판을 연 경우)
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    q := public.poker_use_half(r5);
    execute 'reset role';
    select count(*) into n from public.poker_players where game_id = g and user_id = a and drunk_q = 0 and half_left = 0;
    res := res || E'\n' || case when q = 0 and n = 1 then 'ok   ' else 'FAIL ' end || '다음 판 시작 뒤 지난 판 반잔권 → 0 · A drunk 0';

    -- 판 목록에 카드를 끼워 읽는 조인(REST 임베드 poker_rounds?select=*,poker_hands(*) 와 같은 RLS)도 진행 중 내 카드는 없음
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.poker_rounds r join public.poker_hands h on h.round_id = r.id
     where r.id = r6 and h.user_id = b;
    execute 'reset role';
    res := res || E'\n' || case when n = 0 then 'ok   ' else 'FAIL ' end || '조인으로 읽어도 진행 중 내 카드 0행';

    -- ── 엿보기 힌트 규칙 (각 300번 뽑아 나온 값 모음) ──
    select array_agg(distinct h order by h) into hs from (select private.poker_hint(12) as h from generate_series(1, 300)) s;
    res := res || E'\n' || case when hs = array['3', '4'] then 'ok   ' else 'FAIL ' end || '힌트 12 → 3|4 ' || hs::text;
    select array_agg(distinct h order by h) into hs from (select private.poker_hint(15) as h from generate_series(1, 300)) s;
    res := res || E'\n' || case when hs = array['3', '5'] then 'ok   ' else 'FAIL ' end || '힌트 15 → 3|5 ' || hs::text;
    select array_agg(distinct h order by h) into hs from (select private.poker_hint(20) as h from generate_series(1, 300)) s;
    res := res || E'\n' || case when hs = array['4', '5'] then 'ok   ' else 'FAIL ' end || '힌트 20 → 4|5 ' || hs::text;
    select array_agg(distinct h order by h) into hs from (select private.poker_hint(21) as h from generate_series(1, 300)) s;
    res := res || E'\n' || case when hs = array['lonely'] then 'ok   ' else 'FAIL ' end || '힌트 조커 → lonely ' || hs::text;
    select array_agg(distinct h order by h) into hs from (select private.poker_hint(7) as h from generate_series(1, 300)) s;
    res := res || E'\n' || case when hs = array['lonely'] then 'ok   ' else 'FAIL ' end || '힌트 7 → lonely ' || hs::text;
    select array_agg(distinct h order by h) into hs from (select private.poker_hint(9) as h from generate_series(1, 300)) s;
    res := res || E'\n' || case when hs = array['3'] then 'ok   ' else 'FAIL ' end || '힌트 9 → 3 ' || hs::text;

    -- ── 다른 커플 접근 거부 ──
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select (select count(*) from public.poker_games   where id = g)
         + (select count(*) from public.poker_players where game_id = g)
         + (select count(*) from public.poker_rounds  where game_id = g)
         + (select count(*) from public.poker_hands   where round_id in (r1, r6))
         + (select count(*) from public.poker_peeks   where round_id in (r1, r2))
      into n;
    res := res || E'\n' || case when n = 0 then 'ok   ' else 'FAIL ' end || '다른 커플: 게임·참가자·판·카드·엿보기 0행';
    begin
      perform public.poker_join(g);
      res := res || E'\nFAIL 다른 커플 join 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   다른 커플 join 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_next_round(g);
      res := res || E'\nFAIL 다른 커플 next_round 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   다른 커플 next_round 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_act(r6, 'call');
      res := res || E'\nFAIL 다른 커플 act 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   다른 커플 act 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_peek(r6);
      res := res || E'\nFAIL 다른 커플 peek 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   다른 커플 peek 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_use_half(r4);
      res := res || E'\nFAIL 다른 커플 use_half 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   다른 커플 use_half 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_end(g);
      res := res || E'\nFAIL 다른 커플 end 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   다른 커플 end 거부 — ' || sqlerrm;
    end;

    -- 다른 커플은 자기 게임을 따로 연다 + 12시간 방치된 게임은 닫고 새로
    g2 := public.poker_open();
    res := res || E'\n' || case when g2 <> g then 'ok   ' else 'FAIL ' end || '커플2 는 자기 게임';
    execute 'reset role';
    update public.poker_games   set created_at = now() - interval '13 hours' where id = g2;
    update public.poker_players set joined_at  = now() - interval '13 hours' where game_id = g2;
    select count(*) into n from public.poker_games where id = g and status = 'playing';
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || '커플1 게임은 그대로 playing';
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    g3 := public.poker_open();
    select count(*) into n from public.poker_games where id = g2 and status = 'ended' and ended_at is not null;
    res := res || E'\n' || case when g3 <> g2 and n = 1 then 'ok   ' else 'FAIL ' end || '12시간 방치 게임 → 닫고 새 게임';

    -- 상대가 연 대기 게임을 (참가하지 않은) 내가 닫을 수 있다 (프론트 로비의 "닫기")
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_end(g3);
    select count(*) into n from public.poker_games where id = g3 and status = 'ended';
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || '상대가 연 대기 게임을 end 로 닫기';

    -- ── anon 차단 ──
    execute 'reset role';
    perform set_config('request.jwt.claims', '{}', true);
    execute 'set local role anon';
    begin
      perform public.poker_open();
      res := res || E'\nFAIL anon open 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   anon open 거부 — ' || sqlerrm;
    end;
    begin
      select count(*) into n from public.poker_hands;
      res := res || E'\nFAIL anon 카드 조회 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   anon 카드 조회 거부 — ' || sqlerrm;
    end;

    -- ── 그만하기 ──
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.poker_end(g);
    perform public.poker_end(g);   -- 두 번 눌러도 무시
    select count(*) into n from public.poker_games where id = g and status = 'ended' and ended_at is not null;
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'end → ended';
    select count(*) into n from public.poker_hands where round_id = r6 and user_id = a;
    res := res || E'\n' || case when n = 0 then 'ok   ' else 'FAIL ' end || '끝낸 게임의 진행 중 판 내 카드는 계속 숨김';
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.poker_act(r6, 'call');
      res := res || E'\nFAIL 끝난 게임에 act 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   끝난 게임에 act 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_next_round(g);
      res := res || E'\nFAIL 끝난 게임 next_round 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   끝난 게임 next_round 거부 — ' || sqlerrm;
    end;
    begin
      perform public.poker_join(g);
      res := res || E'\nFAIL 끝난 게임 join 거부 (통과됨)';
    exception when others then
      res := res || E'\nok   끝난 게임 join 거부 — ' || sqlerrm;
    end;

    -- ── 설정 확인: 실시간 publication · 알림 종류 ──
    execute 'reset role';
    select count(*) into n from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename in ('poker_games', 'poker_players', 'poker_rounds', 'poker_hands');
    select count(*) into n2 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'poker_peeks';
    res := res || E'\n' || case when n = 4 and n2 = 0 then 'ok   ' else 'FAIL ' end || 'realtime: 포커 4개 표 (peeks 제외)';
    select count(*) into n from pg_constraint
     where conname in ('notifications_kind_check', 'profiles_notify_off_check')
       and pg_get_constraintdef(oid) like '%''game''%';
    res := res || E'\n' || case when n = 2 then 'ok   ' else 'FAIL ' end || '알림 종류 game 추가';
    -- open 의 커플 행 잠금은 for no key update 여야 한다 (for update 면 외래키 확인과 교착)
    select count(*) into n from pg_proc
     where oid = 'public.poker_open(int, int, int)'::regprocedure
       and prosrc like '%for no key update%';
    res := res || E'\n' || case when n = 1 then 'ok   ' else 'FAIL ' end || 'open 잠금 = for no key update';

  exception when others then
    res := res || E'\nFAIL !! 예기치 않은 오류: ' || sqlerrm;
  end;

  res := res || E'\n── FAIL ' || ((length(res) - length(replace(res, 'FAIL ', ''))) / 5) || '개';
  raise exception 'TEST_RESULT %', res;
end
$$;

-- ── 손으로 보는 동시성 확인 (선택) ──
-- 한 트랜잭션 안에서는 진짜 동시 호출을 흉내 낼 수 없다. 필요하면 dev 커플로 SQL 창 두 개를 열어:
--   창1: begin; select set_config('request.jwt.claims', '{"sub":"<dev1>"}', true); set local role authenticated;
--        select public.poker_next_round('<game>');            -- 커밋하지 않고 둔다
--   창2: (dev2 로 같은 준비) select public.poker_next_round('<game>');  -- 창1 이 끝날 때까지 기다린다
--   창1: rollback;  → 창2 가 이어서 판 하나만 만든다. 확인 뒤 창2 도 rollback.
-- 교착 방지 확인: 창1: begin; select 1 from public.couples where id = '<dev 커플>' for no key update;  (open 이 잡는 잠금 흉내, 커밋 안 함)
--   창2(dev2): dev1 이 연 대기 게임에 select public.poker_join('<game>');  → 창1 을 기다리지 않고 바로 끝나야 한다
--   (for update 였다면 외래키 확인이 막혀 기다린다 = open 과 엇갈리면 교착). 확인 뒤 둘 다 rollback.
