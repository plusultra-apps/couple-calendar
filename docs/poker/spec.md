# 몽글 인디언 포커 — 개발 설계서 (agent 공용 계약)

프로젝트: `C:\Users\KUP\Desktop\applications\calander-1` (러브로그 PWA). 먼저 `CLAUDE.md` 를 읽고 규칙을 지킨다.
디자인 시안(확정): `docs/poker/design/` 의 (캔버스 원본: https://claude.ai/artifact/1zWkUfQ5dTz9X1bqn3kwqu) `Main.dc.html`(로비), `Game.dc.html`(게임), `Result.dc.html`(결과), `Cards.dc.html`(카드 덱). 색은 시안의 hex 대신 앱 테마 토큰으로 옮긴다.

## 게임 규칙
- 2인(커플 두 사람). 카드 = 1~20 한 벌 + 조커(값 21) = 21장. **판마다 21장을 새로 섞어** 2장을 뽑아 한 장씩 (남은 덱을 두지 않는다 — 지난 판 카드로 내 카드를 짐작하는 카드 세기 방지, 2026-10-14 결정).
- 자기 카드는 못 보고 상대 카드만 본다. 무승부 없음(모든 카드가 다름). 조커는 모든 숫자를 이긴다.
- 술 단위 q: 1q = ¼잔. 게임 설정: `base_q` ∈ {1,2} (기본 판돈, 기본 1), `max_q` ∈ {2,4,6} (최대 판돈, 기본 4), `water_q` ∈ {4,8,12} (물 한 잔 타임 간격, 기본 8).
- 판 시작: `pot_q = base_q`. 선(先)은 판마다 번갈아 (홀수 판 = 게임 만든 사람, 짝수 판 = 상대).
- 차례인 사람이 고른다:
  - **raise**: `pot_q < max_q` 일 때만. `pot_q += 1`, 차례가 상대로 넘어감.
  - **call**: 즉시 공개. 낮은 카드 주인이 `pot_q` 만큼 마심.
  - **fold(다이)**: 즉시 끝. 다이한 사람이 `base_q` 만큼 마심. 단 다이한 사람 카드가 20 또는 조커면 2배.
- 판이 끝나면 패자의 `drunk_q += drink_q`, 패자 `lose_streak += 1`, 승자 `lose_streak = 0`. 패자 `lose_streak` 이 3이 되면 `half_left += 1` 하고 streak 를 0으로.
- 아이템 (게임 시작 시 각자 1개씩):
  - **엿보기** (`peek_left`): 베팅 중인 판에서 쓸 수 있음(차례 무관). 내 카드에 대한 힌트만 나에게:
    3·4·5 중 내 카드를 나누는 수가 있으면 그 중 **하나를 무작위**로 → `'3'|'4'|'5'`. 없거나 조커면 `'lonely'`(외톨이 숫자).
    (12→3/4, 15→3/5, 20→4/5 중 랜덤. 조커는 반드시 lonely.) 한 판에 한 사람당 한 번.
    상대에게는 "엿보기를 썼다"는 사실만 보인다 (`poker_rounds.peeked_by`).
  - **반잔 원샷권** (`half_left`): 판이 끝난 뒤 **패자만**, 그 판에 한 번. `drink_q` 를 `floor((drink_q+1)/2)` 로 (단 drink_q=1 이면 0 = 면제). 패자 `drunk_q` 도 그만큼 줄임. 2배 다이 벌칙(2)은 1이 되어 2배가 상쇄됨.
- 물 한 잔 타임: 패자의 누적 `drunk_q` 가 `water_q` 의 배수를 새로 넘으면 결과 화면에 "물 한 잔 마시고 가요" 안내 (클라이언트 계산).

## DB — migration `supabase/migrations/20261014000035_poker.sql`
모든 테이블 public, RLS on, `couple_id uuid not null default private.my_couple_id() references couples on delete cascade`. 정책 안에서 `(select private.my_couple_id())`, `(select auth.uid())` 형태. 클라이언트는 **select 만** 직접, 쓰기는 전부 아래 RPC(security definer, `set search_path = ''`, 첫 줄에서 호출자가 해당 커플 멤버인지 확인)로.

- `poker_games`: `id uuid pk default gen_random_uuid()`, `couple_id`, `created_by uuid not null default auth.uid() references profiles`, `status text not null default 'waiting' check (status in ('waiting','playing','ended'))`, `base_q smallint not null default 1 check (base_q in (1,2))`, `max_q smallint not null default 4 check (max_q in (2,4,6))`, `water_q smallint not null default 8 check (water_q in (4,8,12))`, `round_no int not null default 0`, `created_at timestamptz not null default now()`, `ended_at timestamptz`.
  커플당 끝나지 않은 게임 1개: `create unique index on poker_games(couple_id) where status <> 'ended'`.
- `poker_players`: `game_id uuid references poker_games on delete cascade`, `user_id uuid references profiles`, `couple_id`, `peek_left smallint not null default 1`, `half_left smallint not null default 1`, `drunk_q int not null default 0`, `lose_streak smallint not null default 0`, `joined_at timestamptz not null default now()`, pk `(game_id, user_id)`.
- `poker_rounds`: `id uuid pk`, `game_id`, `couple_id`, `round_no int`, `status text check in ('betting','done')`, `pot_q smallint`, `first_user uuid`, `turn_user uuid` (done 이면 null), `last_action text` (`'raise'|'call'|'fold'|null`), `last_actor uuid`, `peeked_by uuid[] not null default '{}'`, `winner_id uuid`, `loser_id uuid`, `result text check in ('call','fold')`, `drink_q smallint`, `half_used boolean not null default false`, `created_at`, `ended_at`. unique `(game_id, round_no)`.
- `poker_hands`: `round_id uuid references poker_rounds on delete cascade`, `user_id uuid` (카드를 이마에 붙인 사람), `couple_id`, `card smallint check (card between 1 and 21)`, pk `(round_id, user_id)`.
  **select 정책: 같은 커플 AND (`user_id <> auth.uid()` OR 그 판이 `done`)** — 진행 중인 판의 내 카드는 절대 못 읽는다. (이 표가 핵심 보안.)
- `poker_peeks`: `round_id`, `user_id`, `couple_id`, `hint text check (hint in ('3','4','5','lonely'))`, pk `(round_id,user_id)`. select 정책: `user_id = auth.uid()` 만.
- (덱 표는 두지 않는다 — 판마다 새로 섞으므로 다음 카드가 미리 정해져 있지 않다.)

RPC (모두 `public`, `security definer`, `set search_path = ''`, `revoke execute from public, anon; grant execute to authenticated`). 반환은 아래대로. 잘못된 호출은 한국어 메시지로 `raise exception` (클라이언트 `toMessage()` 가 보여 줌).
- `poker_open(p_base int default 1, p_max int default 4, p_water int default 8) returns uuid` — 커플의 끝나지 않은 게임이 있으면 그 id 반환(설정 무시). 단 waiting 상태로 12시간 넘었거나 마지막 활동이 12시간 넘은 게임은 ended 로 닫고 새로 만든다. 새로 만들면 호출자를 player 로 넣고, 상대에게 알림(아래).
- `poker_join(p_game uuid) returns void` — 호출자를 player 로 추가(이미 있으면 무시). 두 명이 되면 `status='playing'` 으로 바꾸고 덱을 섞고 1판을 딜.
- `poker_next_round(p_game uuid) returns uuid` — playing 인 게임에서 현재 판이 done(또는 판 없음)이면 새 판을 딜하고 id 반환. 이미 betting 판이 있으면 그 id 반환(두 사람이 동시에 눌러도 안전하게: 게임 행 `for update` 잠금).
- `poker_act(p_round uuid, p_action text) returns void` — `p_action in ('raise','call','fold')`. betting 이고 `turn_user = auth.uid()` 일 때만. 규칙대로 처리. 끝나면 `status='done'`, `turn_user=null`, winner/loser/result/drink_q/ended_at, players 갱신.
- `poker_peek(p_round uuid) returns text` — 규칙대로. `peek_left` 감소, `poker_peeks` insert, `peeked_by` 에 추가. 힌트 반환.
- `poker_use_half(p_round uuid) returns smallint` — 규칙대로. 새 drink_q 반환.
- `poker_end(p_game uuid) returns void` — `status='ended'`, `ended_at=now()`.
- 딜(내부 함수 `private.poker_deal(p_game uuid) returns uuid`): 1..21 을 `order by random()` 으로 섞어 2장, `round_no += 1`, 선 결정, `pot_q = base_q`, hands 2행 insert.

알림: 기존 알림 체계(notifications 표 + `private.notify_webhook()` / Edge Function `notify`, migration 10·22·31·32·34 참고)를 읽고 그 방식 그대로, 새 게임을 만들 때 상대에게 kind `'game'` 알림 "🃏 {닉네임}님이 인디언 포커 한 판 하재요" 를 보내고 클릭 시 `/poker` 로 열리게 한다. `notifications.kind` 와 `profiles.notify_off` check 제약에 `'game'` 추가. Edge Function 쪽 수정이 필요하면 코드만 고치고 배포는 하지 않는다(보고).

Realtime: 4개 public 표(`poker_games`, `poker_players`, `poker_rounds`, `poker_hands`)를 `supabase_realtime` publication 에 추가. (`poker_peeks` 는 본인만 쓰니 불필요.)

테스트: `supabase/scripts/` 에 `poker_test.sql` — CLAUDE.md 의 `do $$ ... raise exception 'TEST_RESULT %', r; end $$` 롤백 패턴. 두 사용자 흉내는 `set_config('request.jwt.claims', ..., true)` + `set local role authenticated` 로. 확인 항목: 진행 중 판에서 내 카드 select 0행 / 상대 카드 1행, done 후 둘 다 보임, raise 상한, 차례 아닌 사람 act 거부, fold 2배, call 승패, 조커 승리, peek 힌트 규칙(12/15/20/조커/7), half 계산, 3연패 보너스, 판마다 서로 다른 카드 2장, 다른 커플 접근 거부.

## 프론트 — `web/src/features/poker/`
- `queries.ts`: 쿼리 키 `['poker', ...]` 로 모음 (`['poker','game']` 현재 게임+players, `['poker','round', gameId]` 최신 판, `['poker','hands', roundId]`, `['poker','peek', roundId]`). 뮤테이션 = 위 RPC. 성공 후 `['poker']` invalidate.
- `model.ts`: `glassText(q)` (1→'¼잔', 2→'½잔', 3→'¾잔', 4→'1잔', 5→'1¼잔'…), 잔 채우기 path(시안의 `fillPath`), 카드 등급(1–5 쫄보 / 6–10 애매 / 11–15 든든 / 16–20 왕 / 21 조커) 과 색, 힌트 문구(`'3'`→'3의 배수예요', `'4'`→'4의 배수예요', `'5'`→'5의 배수예요', `'lonely'`→'외톨이 숫자예요'), 취함 단계(`<4` 멀쩡, `<8` 알딸딸, `<10` 헤롱헤롱, 그 이상 물 마셔!).
- 화면: `PokerLobbyPage` (`/poker`) = 시안 Main (오늘의 룰 시트 포함, 상대 접속/대기 상태, "게임 시작"=open 후 join 대기 화면, 상대가 만든 게임이 있으면 "참가하기"), `PokerGamePage` (`/poker/play`) = 시안 Game + Result 를 판 상태(betting/done)로 전환. 다이 확인 시트, 결과의 패자용 "반잔권 쓰기" 버튼, 엿보기 버튼과 결과 표시, 상대가 엿보기 썼다는 표시, "다음 판"(next_round), "그만하기"(end).
- 컴포넌트: `Glass`(¼ 눈금 소주잔, 채움 비율), `PlayingCard`(앞/뒤, 등급색), `PokerMascot`(곰/토끼 SVG + 이마 카드; 시안 SVG 를 컴포넌트로). 주인 판별: `profiles.avatar === '🐰'` 면 토끼, 그 외 곰. 몸 색은 `profiles.color`.
- 프로필 사진: `profiles.photo_path` 가 있으면 아바타 자리(상단 정보줄·로비 상태·결과 카드 밑)에 사진(기존 `useSignedUrls` 사용) + 작은 마스코트 배지, 없으면 마스코트 얼굴.
- 라우트: `app/AppRoutes.tsx` StackLayout 아래 `poker`, `poker/play`, `React.lazy`. 진입점: 설정 화면에 "같이 놀기 → 몽글 인디언 포커" 카드(+ 원하면 캘린더 쪽 눈에 띄는 진입점 하나). 알림 클릭 `/poker`.
- 실시간: `app/realtime.ts` 에 4개 표 추가(필터 `couple_id=eq.`), 키 `['poker']`.
- 알림 종류 목록이 있는 곳(알림 설정/알림함 라벨 등)에 `'game'` 추가.
- 타입: Supabase MCP 가 지금 연결 안 돼 `generate_typescript_types` 를 못 돌린다. 임시로 `web/src/types/database.types.ts` 에 위 표·RPC 를 **자동 생성 형식 그대로** 손으로 추가하고 `database.ts` 에 별칭(`PokerGame` 등) 추가. 나중에 생성 결과로 덮어쓴다.
- 디자인: 시안 그대로 (상대 위 / 테이블 가운데 판돈 소주잔 / 나 아래 / 맨 아래 다이·레이즈·콜). 공용 컴포넌트(Button, Card, Sheet, PageHeader 등)와 테마 토큰 우선, 새 색이 필요하면 `index.css` @theme 에 토큰 추가(예: 카드 등급 색). 하드코딩 금지(사용자 색 인라인 예외). 모바일 360~430px, safe-area. 로딩·빈 상태·에러(`toMessage`) 문구 필수.
- 튜토리얼: CLAUDE.md 규칙상 새 기능은 `features/tutorial/steps.ts` 에 단계 추가 — 설정의 진입 카드를 가리키는 짧은 안내 하나면 충분(구조상 어려우면 생략하고 보고).
- 검사: `export PATH="/c/Program Files/nodejs:$PATH"; cd web && npx tsc -b && npm run build` 통과.
