# 인디언 포커 — 작업 인계 (2026-10-14)

새 대화에서 이어서 할 때 이 파일부터 읽는다. 규칙 원본은 [spec.md](spec.md), 확정 디자인은 [design/](design/) (캔버스: https://claude.ai/artifact/1zWkUfQ5dTz9X1bqn3kwqu).

## 지금 상태
코드 작성·검수는 끝났고, **DB 적용·실제 테스트·배포가 남았다.** 이전 대화는 Supabase MCP 가 연결되지 않아 DB 에 아무것도 적용하지 않았다.

| 단계 | 상태 |
|---|---|
| 기획·디자인 시안 | 완료 |
| DB migration + 테스트 SQL | 완료 (로컬 PGlite 에서 테스트 전부 통과, 실제 DB 미적용) |
| 화면 | 완료 (`tsc -b`, `npm run build`, `oxlint` 통과) |
| DB·보안 검수 | 완료 — 교착 가능성 1건 수정 (`poker_open` 의 잠금을 `for no key update` 로) |
| 화면 검수 | 완료 — 결과 화면 깜빡임/축하 두 번, 뒤로 가기 꼬임, 조사, 타입 관계 정보 수정 |
| 실제 DB 적용·테스트·배포 | **남음** |

## 확정된 게임 규칙 (요약 — 자세히는 spec.md)
- 덱 1~20 + 조커(21) 21장, 2인. 내 카드는 못 보고 상대 카드만 본다. 무승부 없음, 조커가 최강.
- 술 단위 ¼잔. 기본 판돈 ¼·½, 최대 판돈 ½·1·1½, 물 한 잔 타임 1·2·3잔마다.
- 레이즈 +¼잔 / 콜 = 공개, 낮은 쪽이 판돈만큼 / 다이 = 기본 판돈만큼(20·조커 들고 다이하면 2배).
- 엿보기(게임당 1회): 3·4·5 의 배수면 그 수, 아니면 "외톨이 숫자". 12·15·20 은 해당하는 것 중 랜덤 하나, 조커는 외톨이로 보임.
- 반잔 원샷권(게임당 1장, 3연패마다 1장 추가): 진 사람이 결과 화면에서 사용, 마실 양 절반(¼잔이면 면제, 2배 다이는 1배로).
- 프로필 사진이 있으면 아바타 자리에 사진 + 작은 곰/토끼 배지, 없으면 곰/토끼.

## 파일
- DB: `supabase/migrations/20261014000035_poker.sql`, 테스트 `supabase/scripts/poker_test.sql`
- 알림: `supabase/functions/notify/index.ts`, `supabase/functions/_shared/push.ts` (`game` 종류 추가 — **재배포 필요**)
- 화면: `web/src/features/poker/` (model, queries, Glass, PlayingCard, PokerMascot, PokerUI, PokerLobbyPage, PokerGamePage)
- 연결: `app/AppRoutes.tsx`(`/poker`, `/poker/play`), `app/realtime.ts`(poker 표 4개), `features/settings/SettingsPage.tsx`(진입 카드), `features/push/PushSettings.tsx`·`features/notifications/NotificationsPage.tsx`(`game` 종류), `features/tutorial/steps.ts`·`TutorialPage.tsx`(안내 단계), `index.css`(토큰 11개)
- 타입: `web/src/types/database.types.ts` 의 poker 부분은 **손으로 쓴 임시본** → 생성 결과로 덮어쓸 것. `database.ts` 에 별칭 추가.

## 남은 작업 (순서 지킬 것)
1. **Supabase MCP 연결 확인** (`mcp__supabase__*` 도구가 보이는지). 프로젝트 ref `yoouuwcyylqisnuaevdl`.
2. (사용자 결정 대기 — 아래 "정할 것") 결정에 따라 migration 수정 + 테스트 SQL 수정.
3. `apply_migration` 으로 `20261014000035_poker.sql` 적용 (파일 내용 그대로).
4. `get_advisors(security)` 확인. public 의 security definer RPC 7개 경고는 의도된 것(`save_event` 와 같은 방식).
5. `generate_typescript_types` → `web/src/types/database.types.ts` 덮어쓰기 → `cd web && npx tsc -b` 다시 통과 확인.
6. `supabase/scripts/poker_test.sql` 을 `execute_sql` 로 실행 → `TEST_RESULT … FAIL 0` 확인, 남은 행 0 확인. (가짜 사용자를 넣을 때 auth.users 필수 칸이 로컬 흉내와 다를 수 있음 — 실패하면 테스트 파일을 맞춘다.)
7. `notify` Edge Function 재배포 (`deploy_edge_function`).
8. 실제 동작 테스트: `npm run dev` + 개발자 로그인 dev1/dev2 로 한 판 끝까지 (열기 → 참가 → 레이즈/엿보기 → 콜·다이 → 결과·반잔권 → 다음 판 → 그만하기).
   - 꼭 확인: 진행 중인 판의 **내 카드가 실시간·REST 어디로도 안 오는지**(브라우저 네트워크 탭), 상대에게 `game` 알림이 가고 누르면 `/poker` 가 열리는지.
   - 동시성(선택): 테스트 파일 끝 주석의 "SQL 창 두 개" 절차.
9. 배포 `npm run deploy` — **반드시 DB 적용(3) 뒤에.** realtime.ts 가 같은 채널에서 poker 표를 구독하므로, DB 없이 화면만 배포하면 기존 실시간(일정·사진 등)까지 멈출 수 있다.
10. PLAN.md 진행 현황에 반영, 이 파일 상태 표 갱신.

## 정할 것 (사용자 결정 대기)
1. **카드 세기 방지 — 추천: 판마다 21장을 새로 섞기.** 지금은 덱 하나로 10판을 하고 끝난 판 카드는 공개되므로, 9~10번째 판에서 내 카드를 2~4장 중 하나로 좁힐 수 있다. 바꾸려면 `private.poker_deal` 이 매번 1..21 을 새로 섞어 2장을 뽑게 하고(`private.poker_decks` 는 필요 없어짐 — 표는 남겨 둬도 됨), 테스트의 덱 소진 항목을 고친다. 화면의 "덱 남은 카드" 표시가 있으면 뺀다.
2. **반잔권 소급 사용 막기 — 추천: 그 게임의 가장 최근 끝난 판에만.** 지금 `poker_use_half` 는 같은 게임의 아무 끝난 판에나, 끝난 게임에도 쓸 수 있다. (상대가 먼저 다음 판을 눌러도 직전 판에는 쓸 수 있어야 하므로 "현재 판"이 아니라 "가장 최근 done 판"으로 제한.)
3. git: 저장소에 커밋이 하나도 없다. 작업 전에 현재 상태를 첫 커밋으로 남길지.
