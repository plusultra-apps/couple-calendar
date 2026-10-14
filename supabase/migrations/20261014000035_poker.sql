-- 몽글 인디언 포커 (커플 둘이 하는 술게임)
-- · 덱 1~20 + 조커(21) = 21장. 판마다 2장을 뽑아 한 장씩 이마에 붙인다. 자기 카드는 못 보고 상대 카드만 본다.
-- · 클라이언트는 select 만 직접 한다. 쓰기는 전부 아래 RPC(security definer)로만.
-- · 보안 핵심: 진행 중(betting)인 판의 내 카드(poker_hands) · 덱(private.poker_decks) · 상대의 엿보기 결과(poker_peeks)는
--   REST select · RPC 반환값 · 실시간 · 오류 메시지 어느 경로로도 새지 않아야 한다.
--   - poker_hands select 정책: 같은 커플 AND (상대 카드 OR 끝난 판)
--   - 덱은 private 스키마(REST 비노출) + 권한 없음 + RLS on(정책 없음)
--   - poker_peeks 는 본인만 조회, 실시간 publication 에 넣지 않는다
--   - RPC 는 카드 값을 돌려주지 않고(엿보기 힌트만 본인에게), 오류 문구에 카드 정보를 담지 않는다
-- · 동시성: 같은 게임에 대한 쓰기 RPC 는 모두 게임 행을 select ... for update 로 잠가 차례대로 처리한다
--   (잠금 순서는 항상 게임 → 판. 새 게임 만들기는 커플 행을 for no key update 로 잠가 직렬화 — 외래키 확인과 안 부딪힌다).

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────

-- 게임 (커플당 끝나지 않은 게임은 하나)
create table public.poker_games (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status      text not null default 'waiting' check (status in ('waiting', 'playing', 'ended')),
  base_q      smallint not null default 1 check (base_q in (1, 2)),       -- 기본 판돈 (1q = ¼잔)
  max_q       smallint not null default 4 check (max_q in (2, 4, 6)),     -- 최대 판돈
  water_q     smallint not null default 8 check (water_q in (4, 8, 12)),  -- 물 한 잔 타임 간격
  round_no    int not null default 0,                                     -- 마지막으로 딜한 판 번호
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create unique index poker_games_one_open_idx on public.poker_games (couple_id) where status <> 'ended';
create index poker_games_couple_id_idx  on public.poker_games (couple_id);
create index poker_games_created_by_idx on public.poker_games (created_by);

-- 참가자 (게임마다 두 사람)
create table public.poker_players (
  game_id      uuid not null references public.poker_games (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  couple_id    uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  peek_left    smallint not null default 1 check (peek_left >= 0),    -- 엿보기 남은 수
  half_left    smallint not null default 1 check (half_left >= 0),    -- 반잔 원샷권 남은 수
  drunk_q      int not null default 0 check (drunk_q >= 0),           -- 누적 마신 양 (q)
  lose_streak  smallint not null default 0 check (lose_streak between 0 and 2),
  joined_at    timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index poker_players_couple_id_idx on public.poker_players (couple_id);
create index poker_players_user_id_idx   on public.poker_players (user_id);

-- 판
create table public.poker_rounds (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.poker_games (id) on delete cascade,
  couple_id    uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  round_no     int not null,
  status       text not null default 'betting' check (status in ('betting', 'done')),
  pot_q        smallint not null check (pot_q between 1 and 6),
  first_user   uuid not null,                                         -- 이 판의 선
  turn_user    uuid,                                                  -- 지금 차례 (done 이면 null)
  last_action  text check (last_action in ('raise', 'call', 'fold')),
  last_actor   uuid,
  peeked_by    uuid[] not null default '{}',                          -- 엿보기를 쓴 사람 (결과는 poker_peeks, 본인만)
  winner_id    uuid,
  loser_id     uuid,
  result       text check (result in ('call', 'fold')),
  drink_q      smallint check (drink_q >= 0),                         -- 패자가 마실 양 (반잔권 쓰면 줄어듦)
  half_used    boolean not null default false,
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  unique (game_id, round_no),
  constraint poker_rounds_turn_chk check ((status = 'betting') = (turn_user is not null)),
  constraint poker_rounds_done_chk check (
    status = 'betting'
    or (winner_id is not null and loser_id is not null and result is not null and drink_q is not null and ended_at is not null)
  )
);
create index poker_rounds_couple_id_idx on public.poker_rounds (couple_id);

-- 판마다 각자의 카드 (user_id = 카드를 이마에 붙인 사람). 진행 중인 판의 내 카드는 RLS 로 절대 못 읽는다.
create table public.poker_hands (
  round_id   uuid not null references public.poker_rounds (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  couple_id  uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  card       smallint not null check (card between 1 and 21),   -- 21 = 조커
  primary key (round_id, user_id)
);
create index poker_hands_couple_id_idx on public.poker_hands (couple_id);
create index poker_hands_user_id_idx   on public.poker_hands (user_id);

-- 엿보기 결과 (본인만 조회)
create table public.poker_peeks (
  round_id   uuid not null references public.poker_rounds (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  couple_id  uuid not null default private.my_couple_id() references public.couples (id) on delete cascade,
  hint       text not null check (hint in ('3', '4', '5', 'lonely')),
  primary key (round_id, user_id)
);
create index poker_peeks_couple_id_idx on public.poker_peeks (couple_id);
create index poker_peeks_user_id_idx   on public.poker_peeks (user_id);

-- 남은 덱 (다음 카드가 새지 않게 private 스키마 · 권한 없음 · RLS on 정책 없음)
create table private.poker_decks (
  game_id  uuid primary key references public.poker_games (id) on delete cascade,
  cards    smallint[] not null
);
alter table private.poker_decks enable row level security;
revoke all on private.poker_decks from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- RLS · 권한 (클라이언트는 select 만)
-- ─────────────────────────────────────────────
alter table public.poker_games   enable row level security;
alter table public.poker_players enable row level security;
alter table public.poker_rounds  enable row level security;
alter table public.poker_hands   enable row level security;
alter table public.poker_peeks   enable row level security;

create policy "포커 게임 조회" on public.poker_games for select to authenticated
  using (couple_id = (select private.my_couple_id()));
create policy "포커 참가자 조회" on public.poker_players for select to authenticated
  using (couple_id = (select private.my_couple_id()));
create policy "포커 판 조회" on public.poker_rounds for select to authenticated
  using (couple_id = (select private.my_couple_id()));
-- 핵심: 상대 카드는 언제나, 내 카드는 그 판이 끝난(done) 뒤에만
create policy "포커 카드 조회" on public.poker_hands for select to authenticated
  using (
    couple_id = (select private.my_couple_id())
    and (
      user_id <> (select auth.uid())
      or exists (select 1 from public.poker_rounds r where r.id = round_id and r.status = 'done')
    )
  );
create policy "포커 엿보기 본인만" on public.poker_peeks for select to authenticated
  using (user_id = (select auth.uid()) and couple_id = (select private.my_couple_id()));

revoke all on public.poker_games, public.poker_players, public.poker_rounds, public.poker_hands, public.poker_peeks
  from anon, authenticated;
grant select on public.poker_games, public.poker_players, public.poker_rounds, public.poker_hands, public.poker_peeks
  to authenticated;

-- ─────────────────────────────────────────────
-- 내부 함수 (private, 클라이언트 실행 불가)
-- ─────────────────────────────────────────────

-- 엿보기 힌트: 3·4·5 중 카드를 나누는 수 하나를 무작위로. 없거나 조커(21)면 'lonely'
create function private.poker_hint(p_card int)
returns text
language sql volatile set search_path = ''
as $$
  select coalesce(
    (select d::text
       from unnest(array[3, 4, 5]) as d
      where p_card <> 21 and p_card % d = 0
      order by random()
      limit 1),
    'lonely')
$$;
revoke execute on function private.poker_hint(int) from public, anon, authenticated;

-- 새 판 딜: 덱에서 2장 pop(2장 미만이면 21장 전체를 다시 섞음) → round_no += 1 → 선 결정 → 카드 2장.
-- 호출하는 RPC 가 게임 행을 이미 잠근 상태여야 한다. 새 판 id 를 돌려준다.
create function private.poker_deal(p_game uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_cards  smallint[];
  v_game   public.poker_games;
  v_other  uuid;
  v_first  uuid;
  v_round  uuid;
begin
  select cards into v_cards from private.poker_decks where game_id = p_game for update;
  if v_cards is null or cardinality(v_cards) < 2 then
    v_cards := array(select g::smallint from generate_series(1, 21) as g order by random());
  end if;

  update public.poker_games set round_no = round_no + 1 where id = p_game
  returning * into v_game;
  if not found then
    raise exception '게임을 찾을 수 없어요';
  end if;

  select user_id into v_other
    from public.poker_players
   where game_id = p_game and user_id <> v_game.created_by
   limit 1;
  if v_other is null then
    raise exception '상대가 아직 들어오지 않았어요';
  end if;

  -- 선: 홀수 판 = 게임 만든 사람, 짝수 판 = 상대
  v_first := case when v_game.round_no % 2 = 1 then v_game.created_by else v_other end;

  insert into public.poker_rounds (game_id, couple_id, round_no, status, pot_q, first_user, turn_user)
  values (p_game, v_game.couple_id, v_game.round_no, 'betting', v_game.base_q, v_first, v_first)
  returning id into v_round;

  insert into public.poker_hands (round_id, user_id, couple_id, card) values
    (v_round, v_game.created_by, v_game.couple_id, v_cards[1]),
    (v_round, v_other,           v_game.couple_id, v_cards[2]);

  -- 남은 카드 (2장이었으면 빈 배열)
  insert into private.poker_decks (game_id, cards) values (p_game, v_cards[3:])
  on conflict (game_id) do update set cards = excluded.cards;

  return v_round;
end
$$;
revoke execute on function private.poker_deal(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- RPC (public · security definer · 첫 줄에서 커플 멤버 확인)
-- 다른 커플의 게임·판은 "없음"과 같은 문구로 거절한다 (존재 여부도 알려 주지 않게).
-- ─────────────────────────────────────────────

-- 게임 열기: 끝나지 않은 게임이 있으면 그 id (설정 무시).
-- 단 마지막 활동(만든 때·참가·판 시작·판 끝)이 12시간 넘은 게임은 닫고 새로 만든다.
-- 새로 만들면 호출자를 참가자로 넣고, 알림 트리거가 상대에게 'game' 알림을 보낸다.
create function public.poker_open(p_base int default 1, p_max int default 4, p_water int default 8)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_couple uuid := private.my_couple_id();
  v_game   public.poker_games;
  v_last   timestamptz;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;
  if coalesce(p_base, 0) not in (1, 2) or coalesce(p_max, 0) not in (2, 4, 6) or coalesce(p_water, 0) not in (4, 8, 12) then
    raise exception '게임 설정 값이 올바르지 않아요';
  end if;
  if (select count(*) from public.profiles where couple_id = v_couple) < 2 then
    raise exception '상대가 아직 연결되지 않았어요';
  end if;

  -- 두 사람이 동시에 열어도 게임이 하나만 생기게 커플 행으로 직렬화.
  -- for update 가 아니라 for no key update: 다른 RPC(join·next_round·peek)가 게임 행을 잠근 채
  -- poker_players·poker_rounds·poker_peeks 를 넣을 때의 couples 외래키 확인(for key share)과 부딪혀
  -- 교착(open: 커플 → 게임 대기 / 상대: 게임 → 커플 대기)이 나지 않게 한다.
  perform 1 from public.couples where id = v_couple for no key update;

  select * into v_game
    from public.poker_games
   where couple_id = v_couple and status <> 'ended'
     for update;

  if found then
    select greatest(
             v_game.created_at,
             (select max(coalesce(r.ended_at, r.created_at)) from public.poker_rounds r where r.game_id = v_game.id),
             (select max(p.joined_at) from public.poker_players p where p.game_id = v_game.id)
           )
      into v_last;
    if v_last > now() - interval '12 hours' then
      return v_game.id;
    end if;
    -- 오래 방치된 게임은 닫는다
    update public.poker_games set status = 'ended', ended_at = now() where id = v_game.id;
  end if;

  insert into public.poker_games (couple_id, created_by, base_q, max_q, water_q)
  values (v_couple, v_uid, p_base, p_max, p_water)
  returning * into v_game;

  insert into public.poker_players (game_id, user_id, couple_id)
  values (v_game.id, v_uid, v_couple);

  return v_game.id;
end
$$;

-- 참가: 호출자를 참가자로 추가(이미 있으면 무시). 두 명이 되면 playing 으로 바꾸고 덱을 섞어 1판을 딜한다.
create function public.poker_join(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_couple uuid := private.my_couple_id();
  v_game   public.poker_games;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;

  select * into v_game
    from public.poker_games
   where id = p_game and couple_id = v_couple
     for update;
  if not found then
    raise exception '게임을 찾을 수 없어요';
  end if;
  if v_game.status = 'ended' then
    raise exception '이미 끝난 게임이에요';
  end if;

  insert into public.poker_players (game_id, user_id, couple_id)
  values (p_game, v_uid, v_couple)
  on conflict (game_id, user_id) do nothing;

  if v_game.status = 'waiting'
     and (select count(*) from public.poker_players where game_id = p_game) >= 2 then
    update public.poker_games set status = 'playing' where id = p_game;
    perform private.poker_deal(p_game);
  end if;
end
$$;

-- 다음 판: 현재 판이 done(또는 판 없음)이면 새로 딜, 이미 betting 판이 있으면 그 id.
-- 두 사람이 동시에 눌러도 게임 행 잠금으로 한 판만 생긴다.
create function public.poker_next_round(p_game uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_couple uuid := private.my_couple_id();
  v_game   public.poker_games;
  v_round  uuid;
  v_status text;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;

  select * into v_game
    from public.poker_games
   where id = p_game and couple_id = v_couple
     for update;
  if not found then
    raise exception '게임을 찾을 수 없어요';
  end if;
  if v_game.status = 'ended' then
    raise exception '이미 끝난 게임이에요';
  end if;
  if v_game.status <> 'playing' then
    raise exception '상대가 아직 들어오지 않았어요';
  end if;
  if not exists (select 1 from public.poker_players where game_id = p_game and user_id = v_uid) then
    raise exception '이 게임의 참가자가 아니에요';
  end if;

  select id, status into v_round, v_status
    from public.poker_rounds
   where game_id = p_game
   order by round_no desc
   limit 1;
  if v_status = 'betting' then
    return v_round;
  end if;

  return private.poker_deal(p_game);
end
$$;

-- 베팅: raise(판돈 +1, 차례 넘김) / call(즉시 공개, 낮은 카드가 pot_q 마심) / fold(다이한 사람이 base_q, 20·조커면 2배)
create function public.poker_act(p_round uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := private.my_couple_id();
  v_game_id uuid;
  v_game    public.poker_games;
  v_round   public.poker_rounds;
  v_other   uuid;
  v_mine    smallint;
  v_theirs  smallint;
  v_winner  uuid;
  v_loser   uuid;
  v_drink   smallint;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;
  if p_action is null or p_action not in ('raise', 'call', 'fold') then
    raise exception '알 수 없는 행동이에요';
  end if;

  select game_id into v_game_id from public.poker_rounds where id = p_round and couple_id = v_couple;
  if v_game_id is null then
    raise exception '판을 찾을 수 없어요';
  end if;

  -- 잠금 순서: 게임 → 판
  select * into v_game from public.poker_games where id = v_game_id for update;
  if v_game.status <> 'playing' then
    raise exception '이미 끝난 게임이에요';
  end if;
  select * into v_round from public.poker_rounds where id = p_round for update;
  if v_round.status <> 'betting' then
    raise exception '이미 끝난 판이에요';
  end if;
  if v_round.turn_user is distinct from v_uid then
    raise exception '내 차례가 아니에요';
  end if;

  select user_id into v_other from public.poker_hands where round_id = p_round and user_id <> v_uid;
  if v_other is null then
    raise exception '이 판의 참가자가 아니에요';
  end if;

  if p_action = 'raise' then
    if v_round.pot_q >= v_game.max_q then
      raise exception '판돈이 이미 최대예요';
    end if;
    update public.poker_rounds
       set pot_q = pot_q + 1, turn_user = v_other, last_action = 'raise', last_actor = v_uid
     where id = p_round;
    return;
  end if;

  select card into v_mine   from public.poker_hands where round_id = p_round and user_id = v_uid;
  select card into v_theirs from public.poker_hands where round_id = p_round and user_id = v_other;

  if p_action = 'call' then
    -- 카드는 모두 다르므로 무승부 없음. 조커(21)는 가장 큰 수.
    if v_mine > v_theirs then
      v_winner := v_uid;   v_loser := v_other;
    else
      v_winner := v_other; v_loser := v_uid;
    end if;
    v_drink := v_round.pot_q;
  else -- fold
    v_winner := v_other; v_loser := v_uid;
    v_drink := v_game.base_q * case when v_mine >= 20 then 2 else 1 end;
  end if;

  update public.poker_rounds
     set status = 'done', turn_user = null,
         last_action = p_action, last_actor = v_uid,
         winner_id = v_winner, loser_id = v_loser, result = p_action,
         drink_q = v_drink, ended_at = now()
   where id = p_round;

  -- 패자: 마신 양 누적, 연패 +1 (3연패면 반잔권 +1 하고 연패 0). 오른쪽 식은 모두 갱신 전 값.
  update public.poker_players
     set drunk_q     = drunk_q + v_drink,
         half_left   = half_left + case when lose_streak + 1 >= 3 then 1 else 0 end,
         lose_streak = case when lose_streak + 1 >= 3 then 0 else lose_streak + 1 end
   where game_id = v_game.id and user_id = v_loser;
  update public.poker_players
     set lose_streak = 0
   where game_id = v_game.id and user_id = v_winner;
end
$$;

-- 엿보기: 베팅 중인 판에서 차례와 관계없이, 한 판에 한 사람당 한 번. 힌트는 호출자에게만 돌려준다.
create function public.poker_peek(p_round uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := private.my_couple_id();
  v_game_id uuid;
  v_game    public.poker_games;
  v_round   public.poker_rounds;
  v_mine    smallint;
  v_left    smallint;
  v_hint    text;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;

  select game_id into v_game_id from public.poker_rounds where id = p_round and couple_id = v_couple;
  if v_game_id is null then
    raise exception '판을 찾을 수 없어요';
  end if;

  select * into v_game from public.poker_games where id = v_game_id for update;
  if v_game.status <> 'playing' then
    raise exception '이미 끝난 게임이에요';
  end if;
  select * into v_round from public.poker_rounds where id = p_round for update;
  if v_round.status <> 'betting' then
    raise exception '베팅 중인 판에서만 엿볼 수 있어요';
  end if;

  select card into v_mine from public.poker_hands where round_id = p_round and user_id = v_uid;
  if v_mine is null then
    raise exception '이 판의 참가자가 아니에요';
  end if;
  if v_uid = any (v_round.peeked_by) then
    raise exception '이번 판에는 이미 엿봤어요';
  end if;
  select peek_left into v_left from public.poker_players where game_id = v_game.id and user_id = v_uid;
  if coalesce(v_left, 0) < 1 then
    raise exception '엿보기를 다 썼어요';
  end if;

  v_hint := private.poker_hint(v_mine);

  insert into public.poker_peeks (round_id, user_id, couple_id, hint)
  values (p_round, v_uid, v_couple, v_hint);
  update public.poker_rounds  set peeked_by = array_append(peeked_by, v_uid) where id = p_round;
  update public.poker_players set peek_left = peek_left - 1 where game_id = v_game.id and user_id = v_uid;

  return v_hint;
end
$$;

-- 반잔 원샷권: 끝난 판의 패자만, 그 판에 한 번. drink_q → floor((drink_q+1)/2), 단 1이면 0(면제).
-- 패자의 drunk_q 도 줄인 만큼 뺀다. 새 drink_q 를 돌려준다.
create function public.poker_use_half(p_round uuid)
returns smallint
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := private.my_couple_id();
  v_game_id uuid;
  v_round   public.poker_rounds;
  v_left    smallint;
  v_new     smallint;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;

  select game_id into v_game_id from public.poker_rounds where id = p_round and couple_id = v_couple;
  if v_game_id is null then
    raise exception '판을 찾을 수 없어요';
  end if;

  perform 1 from public.poker_games where id = v_game_id for update;
  select * into v_round from public.poker_rounds where id = p_round for update;
  if v_round.status <> 'done' then
    raise exception '판이 끝난 뒤에 쓸 수 있어요';
  end if;
  if v_round.loser_id is distinct from v_uid then
    raise exception '진 사람만 쓸 수 있어요';
  end if;
  if v_round.half_used then
    raise exception '이 판에는 이미 반잔권을 썼어요';
  end if;
  select half_left into v_left from public.poker_players where game_id = v_game_id and user_id = v_uid;
  if coalesce(v_left, 0) < 1 then
    raise exception '반잔권이 없어요';
  end if;

  v_new := case when v_round.drink_q <= 1 then 0 else (v_round.drink_q + 1) / 2 end;  -- 정수 나눗셈 = floor

  update public.poker_rounds set drink_q = v_new, half_used = true where id = p_round;
  update public.poker_players
     set half_left = half_left - 1,
         drunk_q   = drunk_q - (v_round.drink_q - v_new)
   where game_id = v_game_id and user_id = v_uid;

  return v_new;
end
$$;

-- 그만하기: 게임을 닫는다 (이미 닫혀 있으면 그대로). 진행 중이던 판의 카드는 계속 숨겨 둔다.
create function public.poker_end(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_couple uuid := private.my_couple_id();
  v_status text;
begin
  if v_uid is null or v_couple is null then
    raise exception '커플로 연결된 뒤에 할 수 있어요';
  end if;

  select status into v_status
    from public.poker_games
   where id = p_game and couple_id = v_couple
     for update;
  if v_status is null then
    raise exception '게임을 찾을 수 없어요';
  end if;
  if v_status = 'ended' then
    return;
  end if;

  update public.poker_games set status = 'ended', ended_at = now() where id = p_game;
end
$$;

revoke execute on function public.poker_open(int, int, int)    from public, anon;
revoke execute on function public.poker_join(uuid)             from public, anon;
revoke execute on function public.poker_next_round(uuid)       from public, anon;
revoke execute on function public.poker_act(uuid, text)        from public, anon;
revoke execute on function public.poker_peek(uuid)             from public, anon;
revoke execute on function public.poker_use_half(uuid)         from public, anon;
revoke execute on function public.poker_end(uuid)              from public, anon;
grant  execute on function public.poker_open(int, int, int)    to authenticated;
grant  execute on function public.poker_join(uuid)             to authenticated;
grant  execute on function public.poker_next_round(uuid)       to authenticated;
grant  execute on function public.poker_act(uuid, text)        to authenticated;
grant  execute on function public.poker_peek(uuid)             to authenticated;
grant  execute on function public.poker_use_half(uuid)         to authenticated;
grant  execute on function public.poker_end(uuid)              to authenticated;

-- ─────────────────────────────────────────────
-- 알림: 새 게임을 만들면 상대에게 'game' 알림 "🃏 {닉네임}님이 인디언 포커 한 판 하재요" (클릭 → /poker)
-- 기존 방식 그대로: poker_games insert 트리거 → private.notify_webhook() → Edge Function notify
-- (문구·종류·주소는 notify 함수의 poker_games 분기에서 만든다)
-- ─────────────────────────────────────────────
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('event', 'comment', 'wish', 'anniv', 'photo', 'like', 'reminder', 'update', 'game'));

alter table public.profiles drop constraint profiles_notify_off_check;
alter table public.profiles add constraint profiles_notify_off_check
  check (notify_off <@ array['event', 'comment', 'wish', 'anniv', 'photo', 'like', 'reminder', 'update', 'game']::text[]);

-- 알림 트리거: poker_games 분기 추가 — 같은 사람이 2분 안에 또 게임을 열면(닫고 다시 열기) 첫 번째만 알린다.
-- (나머지는 20261012000032 와 같음)
create or replace function private.notify_webhook()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
begin
  begin
    -- 로그인 사용자의 변경만 알린다 (service role · cron 변경 제외)
    if auth.uid() is null then
      return null;
    end if;

    if tg_table_name = 'events' then
      if tg_op = 'INSERT' then
        if new.hidden then
          return null;
        end if;
        -- 도장 연속 찍기: 같은 제목을 2분 안에 또 추가하면 생략
        if new.title <> '' and exists (
             select 1 from public.events e
              where e.id <> new.id
                and e.couple_id = new.couple_id
                and e.created_by = auth.uid()
                and e.title = new.title
                and e.created_at > now() - interval '2 minutes'
           ) then
          return null;
        end if;
      elsif tg_op = 'UPDATE' then
        if new.hidden or old.hidden then
          return null;
        end if;
        -- 상대가 알아야 할 것(제목·날짜·시간·장소·주인·공개 범위·반복)이 바뀔 때만. 메모·제외일 수정은 조용히.
        if (new.title, new.all_day, new.starts_at, new.ends_at, new.start_date, new.end_date,
            new.location, new.owner_id, new.is_private, new.rrule)
           is not distinct from
           (old.title, old.all_day, old.starts_at, old.ends_at, old.start_date, old.end_date,
            old.location, old.owner_id, old.is_private, old.rrule) then
          return null;
        end if;
      else -- DELETE
        if old.hidden then
          return null;
        end if;
        -- 도장 되돌리기: 방금(2분 안) 만든 일정을 지우면 생략
        if old.created_at > now() - interval '2 minutes' then
          return null;
        end if;
      end if;

    elsif tg_table_name = 'photos' then
      -- 나만 보기 일정에 붙인 사진은 상대가 못 보므로 알리지 않는다
      if new.event_id is not null and exists (
           select 1 from public.events e where e.id = new.event_id and e.hidden
         ) then
        return null;
      end if;
      -- 연달아 올리는 중이면(2분 안에 올린 사진이 이미 있으면) 생략 — 장수는 notify 가 센다
      if exists (
           select 1 from public.photos p
            where p.id <> new.id
              and p.couple_id = new.couple_id
              and p.created_by = auth.uid()
              and p.created_at > now() - interval '2 minutes'
         ) then
        return null;
      end if;

    elsif tg_table_name = 'photo_likes' then
      if exists (
           select 1 from public.photo_likes l
            where l.photo_id <> new.photo_id
              and l.couple_id = new.couple_id
              and l.user_id = auth.uid()
              and l.created_at > now() - interval '2 minutes'
         ) then
        return null;
      end if;

    elsif tg_table_name = 'wishes' then
      if tg_op = 'UPDATE' then
        if not (new.done and not old.done) then
          return null;
        end if;
      else -- INSERT: 2분 안에 연달아 담으면 첫 번째만 — 개수는 notify 가 센다
        if exists (
             select 1 from public.wishes w
              where w.id <> new.id
                and w.couple_id = new.couple_id
                and w.created_by = auth.uid()
                and w.created_at > now() - interval '2 minutes'
           ) then
          return null;
        end if;
      end if;

    elsif tg_table_name = 'poker_games' then
      -- 게임을 닫고 바로 다시 열면(2분 안) 알림은 처음 한 번만
      if exists (
           select 1 from public.poker_games g
            where g.id <> new.id
              and g.couple_id = new.couple_id
              and g.created_by = auth.uid()
              and g.created_at > now() - interval '2 minutes'
         ) then
        return null;
      end if;
    end if;

    select value into v_secret from public.app_config where key = 'webhook_secret';
    if v_secret is null then
      return null;
    end if;

    perform net.http_post(
      url     := 'https://yoouuwcyylqisnuaevdl.supabase.co/functions/v1/notify',
      body    := jsonb_build_object(
                   'table',      tg_table_name,
                   'op',         tg_op,
                   'record',     case when tg_op <> 'DELETE' then to_jsonb(new) end,
                   'old_record', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                   'actor',      auth.uid()
                 ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notify_webhook 실패 (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end
$$;
revoke execute on function private.notify_webhook() from public, anon, authenticated;

create trigger poker_games_notify after insert on public.poker_games
  for each row execute function private.notify_webhook();

-- ─────────────────────────────────────────────
-- 실시간 반영 (poker_peeks 는 본인만 쓰므로 넣지 않는다.
-- poker_hands 변경도 구독자별 RLS 를 거치므로 진행 중인 판의 내 카드는 전달되지 않는다)
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table
  public.poker_games, public.poker_players, public.poker_rounds, public.poker_hands;
