# 러브로그 — 작업 규칙

커플 둘(갤럭시 + 아이폰)이 쓰는 공유 캘린더 PWA. 기획·진행 현황은 [PLAN.md](PLAN.md).
UI 문구와 코드 주석은 **한국어**, 식별자는 영어.

**앱 이름은 "러브로그"** (2026-10-23 에 "우리달력"에서 변경). 화면·알림·설치 이름·문서의 한글 이름만 바꿨고, 아래 영문 식별자는 **일부러 `ourcal` 그대로 둔다** — 바꾸면 설치된 앱의 로그인·설정이 초기화되거나 일정이 중복된다.
- 주소 `ourcal-tau.vercel.app`, Vercel 프로젝트 `ourcal` (주소가 바뀌면 폰이 새 앱으로 인식 → 로그인·알림 구독 초기화)
- localStorage 키 `ourcal.*`, CSS 클래스 `ourcal-pin`, ICS 일정 UID `@ourcal`
- GitHub 저장소는 `plusultra-apps/couple-calendar`
- 아이폰은 홈 화면에 추가할 때 이름이 고정된다 → 이름을 바꾸면 아이콘을 지우고 다시 추가해야 한다. 안드로이드(크롬)는 보통 알아서 갱신.

## 구조
```
web/                       React 19 + Vite + TS + Tailwind v4 PWA
  src/app/                 앱 셸: session, 라우터, 하단 탭, 레이아웃
  src/components/          공용 UI (ui.tsx, Sheet.tsx 등)
  src/features/<기능>/      기능별 화면·쿼리 (auth, couple, calendar, events, anniversary, wish, free, settings, push, feed, external, install)
  src/lib/                 순수 로직 (dates, recurrence, holidays, anniversary, supabase)
  src/types/database.types.ts   자동 생성 — 직접 수정 금지
  src/types/database.ts         앱용 타입 별칭
supabase/migrations/       DB 변경 이력 (MCP apply_migration 으로 적용한 SQL 과 동일하게 저장)
supabase/functions/<이름>/  Edge Functions (Deno)
```

## 명령 (Windows, Bash 도구)
- Node 는 PATH 에 없을 수 있다: 명령 앞에 `export PATH="/c/Program Files/nodejs:$PATH";`
- 타입 검사: `cd web && npx tsc -b`  /  빌드: `npm run build`
- 개발 서버: `npm run dev` (개발자 로그인 버튼으로 dev1/dev2 계정 즉시 로그인)

## Supabase
- 프로젝트 ref: `yoouuwcyylqisnuaevdl` (서울). MCP 도구(`mcp__supabase__*`)로 작업한다.
- **DDL 은 `apply_migration`** 으로 적용하고, 같은 SQL 을 `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` 로 저장한다.
- 적용 후 반드시 `get_advisors(security)` 확인 → `generate_typescript_types` 결과로 `web/src/types/database.types.ts` 덮어쓰기.
- 모든 도메인 테이블은 `couple_id` 로 격리, RLS 필수. 정책 안에서는 `(select private.my_couple_id())`, `(select auth.uid())` 형태로 쓴다.
- `couple_id`, `user_id`, `created_by` 는 DB 기본값으로 채운다. 클라이언트에서 보내지 않는다.
- RLS 전용 헬퍼는 `private` 스키마(REST 비노출). 서버 전용 설정값은 `public.app_config` (RLS on, 정책 없음 → service role 만 접근).
- 데이터 검증 테스트는 `do $$ ... raise exception 'TEST_RESULT %', r; end $$` 패턴으로 **롤백되게** 실행한다. 실데이터를 남기지 않는다.

## 도메인 규칙
- 일정 소유: `owner_id` NULL = '우리', 값 = 그 사람. 색은 `profiles.color`(개인), `couples.us_color`(우리).
- 종일 일정은 `start_date`/`end_date`(date, 종료일 포함), 시간 일정은 `starts_at`/`ends_at`(timestamptz). 섞지 않는다.
- 공개 범위 3단계 (본인 일정만): 같이 보기 / 바쁨으로만(`is_private`) / 나만 보기(`hidden`). `hidden` 은 RLS 로 상대가 행 자체를 못 보고, 알림·상대의 구독 피드에서도 빠진다. `is_private` 와 동시에 켤 수 없다.
- 아바타: `profiles.avatar`(동물 이모지, 기본 🐻/나중에 들어온 사람 🐰). 달력 칩·목록·상세에 주인 표시. 우리 일정은 💞(`US_AVATAR`).
- 비공개 일정: `events.is_private = true` 면 `events.title` 은 빈 문자열이고 실제 제목·장소·메모는 `event_secrets`(소유자만 조회). 상대에게는 "바쁨"으로 보인다. 저장은 `save_event(jsonb)` RPC 로만.
- 반복: `events.rrule` 은 DTSTART 없는 RRULE 본문(`FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231`), 제외일은 `exdates date[]`. 전개는 `web/src/lib/recurrence.ts`.
- 음력: `profiles.birthday`, `anniversaries.base_date` 는 **항상 실제 양력 날짜**. `*_is_lunar` 가 true 면 그 날의 음력 월·일로 매년 계산한다. 입력은 `components/LunarDateInput`(음력 연·월·일·윤달 → 양력 변환).
- 반복 규칙 생성은 `buildRRule(preset, until, startKey)` — 29~31일 매월은 말일 보정, 2/29 매년은 평년 2/28.
- 화면 이동 후 돌아가기는 `app/navigation.ts` 의 `useGoBack(fallback)` (알림·새로고침으로 바로 연 화면 대비).
- N일째 챙기는 방식(`DayRule`): 주기 `day_every`(100·1000·null=안 챙김) + 특별한 날 `day_marks`(예: 22·50). 사귄 날은 `couples.day_*`, 직접 추가한 기념일은 `anniversaries.day_*`. `anniversaries.count_days` 는 예전 칸(남겨 둠) — `customDayRule()` 이 day_every 가 비면 count_days 를 100일마다로 읽는다. 기준일 = 1일째.
- 기념일 자동 계산(100일 단위·주년·생일·음력)은 행을 저장하지 않고 `web/src/lib/anniversary.ts` 에서 계산한다. Edge Function 에서도 같은 파일을 복사해 쓴다.
- 시간대는 Asia/Seoul. 날짜 키는 `yyyy-MM-dd` 문자열.
- "사귄 날 = 1일째" (커플 앱 관례).

- 자주 쓰는 일정(도장): `quick_templates` (커플 공용). `features/quick/` — 편집 화면의 ⚡빠른 선택 칩, 달력의 🪄도장 찍기(날짜 탭 → 생성/다시 탭 → 삭제), 최근 120일 일정에서 2번 이상 한 것을 자동 추천.
- 도장은 주인별로 나눠 보인다: 도장 쟁반 탭 '내 도장 / 우리 도장 / 상대'(휴대폰마다 localStorage `ourcal.stamp.tab`), 관리 목록도 같은 묶음. 도장 편집 시트는 `Sheet handleOnly`(손잡이로만 닫힘 — 입력·스크롤하다 닫히던 문제).
- 푸시: 같은 사람이 같은 제목 일정을 2분 안에 연달아 추가하면 첫 알림만 보낸다(도장 연속 찍기), 2분 안에 만든 일정을 지우면 알리지 않는다 — `private.notify_webhook()`.
- 알림 대상: 일정(추가·수정·삭제) · 댓글 · 반응 · 위시 담기/이루기(done→true) · 기념일 추가 · 사진 올리기 · 사진 하트. 사진·위시 담기는 연달아 하면 첫 번째만 트리거되고 notify 함수가 20초 기다렸다 2분 안 개수를 세서 "N장/N개" 한 번만. 하트도 2분 안 연속은 첫 번째만. 일정 수정은 제목·날짜·시간·장소·주인·공개 범위·반복이 바뀔 때만(메모 수정은 조용히). 나만 보기 일정에 붙인 사진은 알리지 않는다.
- 알림 발송은 Edge Function 공용 `_shared/push.ts deliver(userId, kind, msg)`: 알림함 `notifications`(받는 사람별, 쓰기는 서버만, 60일 보관)에 항상 남기고, `profiles.notify_off`(끈 종류: event·comment·wish·anniv·photo·like·reminder) 면 푸시 안 함, `profiles.quiet_hours` 이고 서울 23~7시면 `deferred=true` 로 미뤘다가 아침 7시에 "밤사이 알림 N개" 한 번.
- 미리 알림: pg_cron `daily-reminders`(22:00 UTC = 07:00 서울) → Edge Function `remind`. 밤사이 알림 보내기 → 오늘 시작하는 '우리' 일정(반복 포함, floating 계산) · 기념일 D-7·D-1·당일 · 생일 D-3·D-1·당일(본인 생일은 당일 축하만) → 오래된 알림 정리. 시험할 땐 body `{"couple_id": "<dev 커플>"}` 로 그 커플만(밤사이·정리 건너뜀). **실제 사용자 커플로 시험 금지.**
- 1시간 전 알림: pg_cron `remind-soon`(*/10분) → Edge Function `remind-soon`. 시작 60분 안으로 들어온 **시간 일정**을 알린다 — '우리' 일정은 두 사람, 개인 일정은 그 주인에게만(상대 개인 일정 제외), 종일 제외. 반복은 회차별로 한 번(`public.event_reminders` = (event_id, occ_key) 중복방지, RLS on·정책 없음, 이틀 뒤 자동 정리). 종류는 `reminder`(⏰ 미리 알림 토글·조용한 시간 공유). 시험은 body `{"couple_id": "<dev 커플>"}` 로 그 커플만. **실제 사용자 커플로 시험 금지.**
- 무료 플랜 일시 정지 방지: pg_cron `keepalive-ping`(19:00 UTC = 04:00 서울) → Edge Function `keepalive` 가 앱과 분리된 `public.keepalive` 표(앱 사용자 접근 불가, 트리거·실시간·내보내기 없음)에 임시 한 줄 넣고 30일 지난 줄 정리. 사용자 데이터·알림에는 닿지 않는다.
- 알림함 화면 `features/notifications/NotificationsPage`(`/notifications`), 캘린더 머리의 🔔 + 안 읽은 수. 들어오면 모두 읽음. 설정 → 알림 카드에 종류별 켜기/끄기 · 조용한 시간(`push/PushSettings NotifyPrefs`).
- 알림 작은 아이콘(badge)은 흰색 실루엣 `public/badge-96x96.png`(`badge.svg` 에서 생성). 안드로이드는 투명도만 쓰므로 컬러 아이콘을 넣으면 네모·동그라미로 보인다.
- 시트(vaul) 안에서 body 로 포털한 화면(사진 크게 보기 등)은 `pointer-events-auto` 를 줘야 눌린다(시트가 열리면 body 가 pointer-events: none).
- 장소: `components/PlaceSearchSheet` → Edge Function `place-search`(카카오 로컬 키워드 검색, 키는 `app_config.kakao_rest_key`). 위시 담기·일정 장소 칸에서 사용. 안드로이드는 manifest `share_target` → `/share`(SharePage) → `/wish?add=1&title&url&memo` 로 공유받기. 공유 글 파싱은 `lib/place.ts parseShared`.
- 장소 사진·후기: 카카오맵 별점·리뷰·업체 사진은 공개 API 가 없다 → Edge Function `place-info` 가 다음 이미지·블로그 검색으로 대신 보여 주고, 별점은 '카카오맵 리뷰' 버튼으로 원본 페이지를 연다(`components/PlaceInfo`). 위시에는 `place_*` 와 대표 사진 `photo_url`(카카오 썸네일) 저장. 카카오맵 페이지 스크래핑·iframe 삽입은 하지 않는다(카카오가 막음).
- 카카오 지도 JS SDK(`lib/kakaoMap.ts`, `components/KakaoMap.tsx` 의 KakaoMap·Roadview): 키 `VITE_KAKAO_JS_KEY`(공개 키). **카카오 콘솔에 사이트 도메인 등록 필요**(localhost:5173, :5199, 배포 주소). 장소 창(PlaceInfoSheet)의 지도·거리 사진(로드뷰)에 쓴다. 위시 탭 지도 보기는 쓸모가 적어 뺐다. 핀은 DOM 으로 만든다(innerHTML 금지 — 사용자 입력).
- 사진: 비공개 Storage 버킷 `photos`, 경로 `{couple_id}/{uuid}.jpg`(+`_t.jpg` 작은 사진). Storage·`photos` 테이블 모두 커플만 접근(RLS). 올리기 전에 폰에서 줄인다(1600px·480px JPEG, `lib/photos.ts`). 보여 줄 때는 1시간 서명 링크(`useSignedUrls`). `taken_on` 으로 달력 날짜·기념일과 연결, `event_id` 로 일정에 첨부, `kind='fourcut'` 인생네컷. 커버 `couples.cover_path`, 프로필 `profiles.photo_path`. 사진 행을 지울 때 파일도 지운다. 상대의 '나만 보기' 일정에 붙은 사진은 RLS 로 숨겨진다.
- 추억 탭(`features/photos/MemoriesPage`): 인스타처럼 피드(같은 일정 또는 같은 날·같은 종류 사진을 게시물 하나로, 넘기기·두 번 탭 하트·한 줄 캡션=첫 사진 caption) / 그리드. 좋아요는 `photo_likes`(`features/photos/likes.ts`, 키 `photo-likes`).
- 달력 칸 막대: 맨 앞에 주인 아바타(🐻/🐰, 우리 💞)를 붙여 누구 일정인지 구분.
- 달력 사진 보기: 보기 줄 끝 📷(`calendar/PhotoModeButton`, 휴대폰마다 localStorage `ourcal.cal.photoMode`). 켜면 날짜·일정 막대 아래 남은 칸에 날짜별 대표 사진(작은 사진 `_t.jpg`). 사진 있는 날이 낀 주는 사진 자리(최소 36px)를 남기려고 막대를 1~2줄로 줄이고 못 그린 일정 수는 막대 바로 아래 줄에 +N(사진은 그 아래부터). 그날 사진이 여러 장이면 사진 귀퉁이에 어두운 알약으로 나머지 장수 +N(일정 +N 과 구분). 끄면 사진 있는 날만 날짜 옆 점. 서명 링크는 켰을 때만 받는다.
- 대표 사진 = 그날 사진 순서의 맨 앞(`photos/queries byDayOrder`: `photos.day_order` → 인생네컷 → 일정에 붙은 사진 → 먼저 올린 사진). 날짜 창 사진을 꾹(0.3초) 눌러 끌면 순서가 바뀌고 0..n-1 로 저장(`PhotoGrid onReorder`, `useReorderPhotos`). 맨 앞에 '대표' 표시. 추억 피드 순서는 건드리지 않는다(첫 사진 caption = 한 줄 글이라).
- 날짜 창의 "둘 다 비는 시간"(`features/free/DayFreeTime`): 보기 필터와 무관하게 전체 일정으로 8–24시 시간표(나/상대/둘 다)를 그리고, 30분 이상 빈 시간을 누르면 `/event/new?date&start=HH:mm&min=N`(최대 2시간)으로 연다. 바쁨 판정은 `freeTime.ts blocksPerson` 과 같다(종일 일정은 하루 전체 바쁨). 단 '우리' 일정은 둘 다 줄에 "함께" 구간으로 그리고, 남은 시간이 전부 우리 일정이면 "함께하는 날"로 보여 준다.
- 카카오맵 앱 열기: `lib/place.ts openKakaoPlace` (`kakaomap://place?id=` → 1.2초 안에 앱이 안 열리면 웹).
- 인디언 포커(`features/poker/`, `/poker` 로비 · `/poker/play` 게임): 덱 1~20 + 조커(21), 술 단위 q = ¼잔(`model.ts glassText`). 쓰기는 전부 RPC(`poker_open/join/next_round/act/peek/use_half/end`, security definer), 클라이언트는 select 만. **진행 중인 판의 내 카드는 RLS 로 못 읽는다**(`poker_hands`: 상대 카드이거나 판이 done 일 때만), 카드는 판마다 21장을 새로 섞는다(남은 덱 없음 — 카드 세기 방지), 엿보기 결과(`poker_peeks`, 3·4·5의 배수 / 외톨이 숫자)는 본인만. 반잔권은 같은 게임의 지난 판 어디에나 쓸 수 있다(2026-10-14 결정, 그대로 둠). 새 게임을 열면 상대에게 `game` 알림. 규칙 원본은 migration `20261014000035_poker.sql`. 2026-10-14 DB 적용·배포 완료 — 기록은 [docs/poker/HANDOFF.md](docs/poker/HANDOFF.md).
- Edge Function 공용 코드 `supabase/functions/_shared/{dates,lunar,anniversary}.ts` 는 `web/src/lib` 복사본. lib 를 바꾸면 복사본도 바꾸고 `feed` 를 다시 배포한다.

## UI 규칙
- 디자인 톤: "몽글몽글 게임풍" — 제목·숫자 주아체(`font-display`, h1~h3 자동), 본문 나눔스퀘어라운드, 입체 버튼(`press-3d` + `--shade`), 두꺼운 테두리 카드(`Card`), 마스코트(`components/Mascot`), 축하 효과(`lib/celebrate`).
- 모바일 우선(폭 360~430px). 주요 버튼은 화면 아래. 안전 영역 `env(safe-area-inset-*)` 고려.
- 파스텔 테마 토큰(`web/src/index.css` @theme): `me / partner / us / busy / anniv / holiday / bg / surface / ink / ink-soft / line / accent`. 임의 색 하드코딩 금지(사용자 색은 profiles.color 인라인 스타일 예외).
- 화면 테마(딸기우유·하늘·민트·모카·심플): `app/theme.ts` + `index.css` 의 `:root[data-theme=...]` 블록이 `bg / ink / ink-soft / line / line-deep / accent / accent-deep / partner`(UI 강조색 겸용)를 덮어쓴다. 휴대폰마다 localStorage 에 저장(`main.tsx` 에서 첫 그리기 전에 적용). 새 색을 쓸 땐 토큰으로 써야 테마를 따라간다. 어두운 테마는 파스텔 칩+진한 글씨 구조라 넣지 않았다.
- 날짜·시간 입력은 브라우저 기본 `<input type="date|time">` 대신 `components/DateTimePicker` 의 `DateButton`·`TimeButton`(미니 달력·톡톡 시간 시트, 빠른 칩)을 쓴다.
- 공용 컴포넌트(`components/ui.tsx`의 Button, Field, Card, ErrorText, `components/Sheet.tsx`, `app/PageHeader`)를 우선 사용.
- 서버 데이터는 TanStack Query. 쿼리 키는 `features/<기능>/queries.ts` 에 모은다. 변경 후 관련 키 invalidate. 실시간 반영은 `app/realtime.ts` 가 테이블 변경 시 invalidate 한다.
- 에러는 `toMessage()` 로 한국어 변환해 보여준다. 빈 상태·로딩 상태 문구를 반드시 둔다.
- 라우트 단위 화면은 `React.lazy` 로 분할한다(번들 크기).
- 설치 안내: `features/install/InstallIntro` 가 브라우저로 처음 열면 화면 가득 안내(안드로이드 설치 버튼·메뉴 안내 / 아이폰 사파리 단계 / 카톡 등 앱 안 브라우저는 외부 브라우저로 / PC 는 QR). "웹에서 둘러볼게요"는 3일 숨김. 작은 배너 `InstallPrompt` 는 탭 화면 맨 위(아래 버튼에 가리지 않게).
- 튜토리얼 `features/tutorial/`: `/tutorial` 전체 화면 연습 모드. 커플 연결 후 처음 `/` 로 오면 자동(휴대폰마다 localStorage `ourcal.tutorial.done`), 설정 → 사용법 / 캘린더 ? 버튼으로 다시. **실제 데이터를 쓰지 않는다**: 가짜 데이터(`demoData.ts`)와 순수 컴포넌트(MonthGrid·ItemRow·DayFreeTime `onPlan`)만 쓰고 쿼리·뮤테이션 훅 금지. 단계는 `steps.ts`(target = `data-tut`, 달력 날짜는 `day:YYYY-MM-DD` → `data-day`), `Coach.tsx` 가 어둡게 덮고 대상만 누를 수 있게 한다. 새 기능을 만들면 튜토리얼 단계도 추가한다.
- 업데이트 소식 알림: 배포가 성공하면 **매번** `scripts/deploy.mjs` 가 notify 함수(`x-release-secret` = `.env.local RELEASE_SECRET` = `app_config.release_secret`)로 커플이 있는 모든 사용자에게 "🆕 러브로그가 업데이트됐어요" (종류 `update`, 각자 설정·조용한 시간 따름). 문구는 `npm run deploy -- --notes "바뀐 점"`(없으면 "자잘한 부분을 다듬었어요"), 보내지 않으려면 `-- --quiet`. 배포 때는 바뀐 점을 짧게 `--notes` 로 쓴다.
- 업데이트: `npm run deploy` 만 하면 된다. SW 는 skipWaiting+clientsClaim, `app/pwaUpdate.ts` 가 앱으로 돌아올 때마다 새 버전을 확인하고 바뀌면 자동 새로고침(일정 편집 화면이면 나갈 때까지 미룸). DB 변경은 배포 전에 적용하고, 옛 화면도 잠깐 동작하도록 칸 삭제·이름 변경은 피한다.
