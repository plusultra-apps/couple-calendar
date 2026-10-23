# 러브로그 — 커플 공유 캘린더 기획서

> 둘의 시간을 한눈에. 계획은 같이, 기념일은 자동으로.

- 작성일: 2026-10-02
- 사용자: 2명 (나 – 갤럭시 / 애인 – 아이폰)
- 배포 형태: **PWA** (웹으로 만들고 홈 화면 아이콘으로 앱처럼 실행, 스토어 등록 없음)

---

## 1. 결정 사항 요약

| 항목 | 결정 | 비고 |
|---|---|---|
| 형태 | PWA | 삼성·아이폰 모두 홈 화면 추가로 설치. 필요해지면 나중에 Capacitor로 네이티브 앱 전환 |
| 언어 | TypeScript (+ DB는 SQL) | 화면·서버 함수 모두 TS |
| 프론트 | React + Vite + Tailwind CSS | 서버 렌더링 불필요 → Next.js 대신 Vite |
| DB/백엔드 | Supabase (Postgres, 클라우드, 무료) | 서울 리전. 설치 없음 |
| 로그인 | 이메일 + 비밀번호 | iOS 홈 화면 앱은 사파리와 저장공간이 분리 → 매직링크·OAuth 리다이렉트 사용 안 함 |
| 배포 | Vercel CLI (PC에서 직접 배포) | GitHub 계정 보류 중 → git은 로컬만 사용 |
| 디자인 | 파스텔·귀여운 | 비트윈 / TimeTree 느낌 |
| 시간대 | Asia/Seoul 고정 | |

---

## 2. MVP 기능

### 2-1. 기본 캘린더 (필수)
- 월간 화면이 메인. 날짜 칸 안에 일정 제목이 색 막대로 보임 (TimeTree 방식)
- 날짜를 누르면 하단 시트가 올라와 그날 일정 목록 표시
- **색 3개로 소유 구분**: 나 / 상대 / 우리(함께). 각자 색은 설정에서 변경 가능
- 일정 추가·수정·삭제, 종일/시간 일정, 반복 일정(매주·매월·매년)
- 일정 댓글과 이모지 반응
- **비공개 일정**: 상대에게는 제목 없이 "바쁨"으로만 표시
- 실시간 동기화: 상대가 추가하면 내 화면에 즉시 반영
- **푸시 알림**: 상대가 일정을 추가·수정·삭제하거나 댓글을 달면 알림

### 2-2. 기념일 / D-day 자동
- 커플 연결 시 **사귄 날** 입력 → 상단에 `D+423` 표시
- 100일 단위(100·200·300…일), 매년 주년을 자동으로 캘린더에 표시
- 생일 등록 (**음력 생일** 지원 → 매년 양력 날짜로 환산)
- 사용자 정의 기념일 (매년 반복 / 1회)
- 홈 상단에 "다음 기념일까지 N일" 카드

### 2-3. 위시리스트
- 가고 싶은 곳·하고 싶은 것 저장 (제목, 링크, 태그, 메모)
- 하나를 골라 **"일정으로 만들기"** → 일정과 연결되고 완료 처리
- 태그 예: 맛집, 카페, 여행, 영화, 전시

### 2-4. 기본 캘린더에 표시 (ICS 구독 피드 제공)
- 각자 **비밀 구독 주소**를 하나씩 발급
- 삼성 캘린더 / 구글 캘린더 / 아이폰 캘린더에서 이 주소를 구독하면 러브로그 일정이 자동으로 표시됨 (읽기 전용)
- 기본 캘린더 위젯으로 보이므로 PWA의 위젯 부재를 보완
- 주소 유출 시 재발급(기존 주소 무효화) 가능

### 2-5. 회사 일정 연동 (외부 캘린더 가져오기)
- 구글 캘린더의 "비공개 iCal 주소", 아웃룩의 "게시된 캘린더 ICS 주소"를 붙여 넣는 방식 (OAuth 없음)
- 서버가 주기적으로(30분) 읽어서 **시간만** 저장. 회사 일정 제목·내용은 저장하지 않음
- 캘린더에는 회색 "바쁨" 블록으로 표시 (본인은 제목 보기 옵션 고려)
- **둘 다 비는 날/시간 찾기**: 이번 주·이번 달 중 둘 다 일정이 없는 저녁·주말을 추천

### 2-6. 넣지 않는 것
- 채팅 → 카톡과 중복이라 제외. (사진은 나중에 추가함: 날짜·일정·기념일에 붙는 사진, 인생네컷, 추억 탭 피드/그리드)

---

## 3. 화면 구성

```
┌─────────────────────────────┐
│ 러브로그        D+423 💕     │  ← 상단: D-day, 다음 기념일
│ ◀  2026년 10월  ▶   [필터]  │  ← 필터: 나 / 상대 / 우리 / 회사
├─────────────────────────────┤
│ 일  월  화  수  목  금  토   │
│        1   2   3   4   5    │
│           ■회의 ■데이트      │  ← 색 막대 = 소유자 색
│ ...                         │
├─────────────────────────────┤
│  [캘린더] [위시] [기념일] [설정] │  ← 하단 탭
└─────────────────────────────┘
                         (＋)    ← 플로팅 추가 버튼 (기본값 '우리')
```

| 화면 | 내용 |
|---|---|
| 로그인 / 회원가입 | 이메일 + 비밀번호 |
| 커플 연결 | 내 초대 코드 6자리 표시 / 상대 코드 입력 / 사귄 날 입력 |
| 캘린더 (메인) | 월간 그리드 + 하단 시트(그날 일정) |
| 일정 편집 | 제목, 소유(나/상대/우리), 종일, 시작·종료, 반복, 장소, 메모, 비공개 |
| 일정 상세 | 내용 + 댓글 + 이모지 반응 |
| 위시리스트 | 카드 목록, 태그 필터, 일정으로 만들기 |
| 기념일 | D-day 카드, 다가오는 기념일 목록, 생일·기념일 관리 |
| 비는 날 찾기 | 이번 주·이번 달 중 둘 다 비는 날 목록 |
| 설정 | 내 색상, 닉네임, 알림, 구독 주소(ICS) 복사, 회사 캘린더 주소 등록, 데이터 내보내기 |
| 설치 안내 | 아이폰 사파리일 때 "공유 → 홈 화면에 추가" 그림 안내 |

### UX 원칙
- 한 손 조작: 주요 버튼은 화면 아래쪽
- 일정 추가는 3번의 터치 안에 끝냄 (+ → 제목 → 저장)
- 색만 보고 누구 일정인지 알 수 있어야 함
- 파스텔 톤 + 둥근 모서리 + 이모지 포인트

### 기본 색상 (파스텔, 사용자 변경 가능)
| 구분 | 색 |
|---|---|
| 사용자 A | `#A7C7E7` 하늘 |
| 사용자 B | `#F8B4C4` 핑크 |
| 우리 | `#C3B1E1` 라벤더 |
| 회사(바쁨) | `#D9D9D9` 회색 |
| 기념일 | `#FFD59E` 살구 |

---

## 4. 기술 스택

```
언어        TypeScript
화면        React + Vite
스타일      Tailwind CSS
PWA         vite-plugin-pwa (manifest + Service Worker)
하단 시트    vaul
날짜        date-fns, rrule (반복 일정)
음력        korean-lunar-calendar
서버 데이터  @supabase/supabase-js + TanStack Query
DB/백엔드   Supabase: Postgres + RLS + Realtime + Auth + Edge Functions + pg_cron
푸시        Web Push (VAPID) — Edge Function에서 발송
배포        Vercel CLI
버전관리     로컬 git (GitHub는 계정 복구 후 연결)
```

### 필요한 계정
- Supabase: 이메일로 가입 (카드 불필요)
- Vercel: 이메일로 가입 (GitHub 불필요)

---

## 5. DB 설계

### 테이블

```
couples              커플 단위 (모든 데이터의 격리 기준)
  id uuid PK
  started_on date              사귄 날
  invite_code text UNIQUE      6자리 초대 코드
  created_at timestamptz

profiles             사용자 (auth.users 1:1)
  id uuid PK → auth.users
  couple_id uuid → couples
  nickname text
  color text                   소유자 색
  birthday date
  birthday_is_lunar boolean

events               일정
  id uuid PK
  couple_id uuid → couples
  owner_id uuid NULL           NULL = '우리' 일정, 값 = 해당 사용자 일정
  title text
  location text
  memo text
  all_day boolean
  starts_at timestamptz        시간 일정용
  ends_at timestamptz
  start_date date              종일 일정용 (시간대로 날짜가 밀리는 버그 방지)
  end_date date
  rrule text NULL              반복 규칙 (예: FREQ=WEEKLY;BYDAY=TU)
  is_private boolean           true면 상대에게 '바쁨'으로만 표시
  wish_id uuid NULL            위시에서 만들어진 경우
  created_by uuid
  created_at, updated_at timestamptz

event_comments       댓글
  id, event_id, user_id, body, created_at

event_reactions      이모지 반응
  event_id, user_id, emoji   (PK: event_id + user_id + emoji)

anniversaries        사용자 정의 기념일
  id, couple_id, title, base_date, is_lunar,
  kind  'yearly' | 'once'

wishes               위시리스트
  id, couple_id, title, url, tag, memo,
  done boolean, created_by, created_at

push_subscriptions   푸시 받을 기기 (사용자당 여러 대 가능)
  id, user_id, endpoint UNIQUE, p256dh, auth, created_at

feed_tokens          ICS 구독 주소 비밀키
  user_id PK, token text UNIQUE, created_at

external_calendars   회사 캘린더 (ICS 주소)
  id, user_id, name, ics_url, last_synced_at, last_error

external_busy        회사 캘린더에서 가져온 바쁜 시간 (제목 저장 안 함)
  id, external_calendar_id, starts_at, ends_at, all_day
```

### 설계 원칙
- **RLS(행 단위 보안)**: 모든 테이블에 "내 couple_id와 같은 행만" 정책을 건다. 앱 코드가 실수해도 DB가 막는다.
- **비공개 일정 마스킹**: RLS는 행 단위라 컬럼을 숨길 수 없음 → 상대가 볼 때 제목·메모를 가리는 **뷰(또는 RPC 함수)**로 조회한다. 앱은 events 테이블을 직접 읽지 않고 이 뷰를 읽는다.
- **자동 기념일(100일 단위·주년·생일)은 행을 만들지 않고** 화면을 그릴 때 계산한다. 사용자 정의 기념일만 저장한다.
- **종일 일정은 date 컬럼**에 저장한다. timestamptz에 저장하면 시간대 변환으로 하루 밀릴 수 있다.
- 반복 일정은 원본 1행 + rrule로 저장하고, 화면에서 기간만큼 전개한다. (MVP에서는 "이 일정만 수정" 같은 예외 처리를 하지 않고 시리즈 전체 수정만 지원)
- 회사 캘린더는 시간만 저장하고 제목은 버린다.

---

## 6. 서버 동작 흐름

### 푸시 알림
```
일정/댓글 INSERT·UPDATE·DELETE
  → DB 트리거 (Database Webhook)
  → Edge Function `notify`
  → 상대의 push_subscriptions 조회
  → Web Push 발송 (VAPID)
  → 만료된 구독(410 응답)은 삭제
```
- 아이폰은 **홈 화면에 추가한 상태에서만** 푸시 수신 가능 (iOS 16.4+)

### ICS 구독 피드
```
GET /functions/v1/feed?token=xxxx
  → feed_tokens로 사용자 확인
  → 커플 일정 + 기념일을 iCalendar 형식으로 반환
  → 상대의 비공개 일정은 '바쁨'으로 출력
```

### 회사 캘린더 동기화
```
pg_cron (30분마다)
  → Edge Function `sync-external`
  → 각 ics_url 다운로드 → 향후 90일 일정만 파싱
  → external_busy 갈아끼우기 (해당 캘린더 분만)
```

### 무료 플랜 대비
- 7일 미접속 시 프로젝트 일시정지 → 매일 사용하면 해당 없음
- 자동 백업 없음 → 설정 화면에 **데이터 내보내기(JSON)** 버튼 제공

---

## 7. 진행 단계

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **P0 뼈대** | Vite + React + TS + Tailwind + PWA 설정, 로컬 git, 폴더 구조 | PC 브라우저에서 빈 화면 + 설치 가능 |
| **P1 로그인·커플 연결** | Supabase 프로젝트, 회원가입·로그인, 초대 코드 연결, 사귄 날 입력 | 두 계정이 같은 커플로 묶임 |
| **P2 캘린더** | 월간 그리드, 하단 시트, 일정 CRUD, 소유자 색, 실시간 동기화 | 한쪽에서 추가 → 다른 쪽에 즉시 표시 |
| **P3 배포** | Vercel CLI 배포, 두 폰에 홈 화면 설치 | 실제 폰 두 대에서 사용 |
| **P4 기념일** | D-day, 100일 단위, 주년, 생일(음력), 사용자 기념일 | 캘린더와 기념일 탭에 표시 |
| **P5 푸시** | Web Push 구독, notify 함수, 알림 설정 | 상대가 추가하면 내 폰에 알림 |
| **P6 일정 상세** | 반복 일정, 비공개 일정, 댓글, 반응 | |
| **P7 위시리스트** | 목록, 태그, 일정으로 만들기 | |
| **P8 ICS 구독 피드** | feed 함수, 구독 주소 발급·재발급 | 삼성·아이폰 기본 캘린더에 표시 |
| **P9 회사 일정** | 외부 ICS 등록, 동기화, 비는 날 찾기 | |
| **P10 마감** | iOS 설치 안내, 데이터 내보내기, 빈 화면·오류 처리 | |

> P3(배포)를 앞쪽에 둔 이유: 실제 폰 두 대에서 일찍 써 봐야 UX 문제가 빨리 드러난다.

---

## 8. 폴더 구조 (예정)

```
applications/
├─ PLAN.md                 이 문서
├─ web/                    PWA 프론트엔드
│  ├─ src/
│  │  ├─ app/              라우팅, 레이아웃, 하단 탭
│  │  ├─ features/
│  │  │  ├─ auth/
│  │  │  ├─ couple/
│  │  │  ├─ calendar/
│  │  │  ├─ anniversary/
│  │  │  ├─ wish/
│  │  │  └─ settings/
│  │  ├─ lib/              supabase 클라이언트, 날짜 유틸, 음력 변환
│  │  └─ types/            DB 자동 생성 타입
│  └─ public/              아이콘, manifest 리소스
└─ supabase/
   ├─ migrations/          테이블·RLS·트리거 SQL (변경 이력)
   └─ functions/           notify, feed, sync-external
```

---

## 9. 진행 현황 (2026-10-14 기준)

| 단계 | 상태 | 비고 |
|---|---|---|
| P0 뼈대 | ✅ | |
| P1 로그인·커플 연결 | ✅ | 개발자 로그인 dev1/dev2 (개발 모드 전용) |
| P2 캘린더 | ✅ | 월간·하단 시트·편집·실시간(0.8초 반영 확인)·공휴일/대체공휴일·음력 표시 |
| P3 배포 | ✅ 2026-10-02 | https://ourcal-tau.vercel.app (Vercel 계정 kkd06155@gmail.com, 팀 plus-ultra-code). 다시 배포: `cd web && npm run deploy` |
| P4 기념일 | ✅ | 100일 단위·주년·생일(음력 포함)·사용자 기념일 |
| P5 푸시 | ✅ (서버) | 실제 폰 수신은 배포 후 확인 필요 |
| P6 일정 상세 | ✅ | 반복(이 날만/이후/전체 삭제)·비공개·댓글·반응 |
| P7 위시리스트 | ✅ | 태그·완료·일정으로 만들기 |
| P8 구독 피드(ICS) | ✅ | 아이폰 webcal 구독, 갤럭시는 구글 캘린더 경유 |
| P9 회사 일정 | ✅ | iCal 주소 등록·30분 동기화·비는 날 찾기 |
| P10 마감 | ✅ | 설치 안내·데이터 내보내기·오류/빈 상태·번들 분할 |
| 추가: 몽글몽글 디자인 | ✅ | 주아체·입체 버튼·마스코트·축하 효과 |
| 추가: 자주 하는 일(도장) | ✅ | 빠른 선택 칩·🪄도장 찍기·자동 추천 · 내 도장/우리 도장 탭 (10-12) |
| 추가: 달력 사진 보기 | ✅ 10-07 | 📷 켜면 일정 아래 대표 사진, 날짜 창에서 끌어서 대표 고르기 |
| 추가: 알림 확장 | ✅ 10-12 | 사진·하트·위시 이루기 알림, 알림함(🔔), 종류별 끄기·조용한 시간, 아침 7시 미리 알림, 업데이트 소식, 알림 아이콘 |
| 추가: 무료 플랜 정지 방지 | ✅ 10-12 | 매일 새벽 4시 `keepalive` (앱과 분리된 표) |
| 추가: 인디언 포커 | ✅ 10-14 배포 | DB 적용·테스트 77개 통과·dev 커플로 실제 한 게임·배포. 판마다 새로 섞기, 반잔권은 지난 판 어디에나 ([docs/poker/HANDOFF.md](docs/poker/HANDOFF.md)) |

### 배포 (P3)
1. `cd web` → `npx vercel login` (브라우저로 이메일 로그인, 처음 한 번)
   - 배포 주소가 나오면 카카오 콘솔(QuarterBack 앱) → 플랫폼 → Web 사이트 도메인에 그 주소를 추가 (지도·로드뷰용)
2. `npm run deploy` → https://ourcal-tau.vercel.app (PC 이름이 한글이라 생기는 CLI 오류는 `scripts/ascii-host.cjs` 로 자동 우회)
3. 두 폰에서 주소 열기 → 홈 화면에 추가 → 설정에서 알림 켜기

### 실사용 전 체크리스트
- [ ] Supabase 대시보드 → Authentication → Email → **Confirm email 끄기**
- [ ] `supabase/scripts/remove_dev_accounts.sql` 실행 (개발 계정·샘플 데이터 삭제)
- [ ] `web/.env.local` 에서 `VITE_DEV_PASSWORD` 줄 삭제
- [x] `app_config.vapid_subject` = `https://ourcal-tau.vercel.app` (2026-10-02, 배포 주소로 설정)
- [ ] (선택) Authentication → 유출 비밀번호 차단(leaked password protection) 켜기
- [x] 카카오 REST API 키 등록 (장소 검색용, 2026-10-02 등록 완료 · QuarterBack 앱) — developers.kakao.com → 내 애플리케이션 → 앱 추가 → 앱 키의 REST API 키,
      (제품 설정에 '카카오맵' 사용 설정이 있으면 ON) → SQL Editor:
      `insert into public.app_config (key, value) values ('kakao_rest_key', '<키>') on conflict (key) do update set value = excluded.value;`

- Supabase 프로젝트 ref: `yoouuwcyylqisnuaevdl` (서울), MCP 설정은 루트 `.mcp.json`
- 마이그레이션: `supabase/migrations/` 000001~000022 (모두 적용됨)
- Edge Functions: `notify`, `feed`, `sync-external` (verify_jwt=false, 함수 안에서 인증)

## 10. 미결 사항
- [ ] GitHub 계정 복구 후 원격 저장소 연결
- [ ] 도메인 구매 여부 (기본은 `*.vercel.app` 무료 주소)
- [ ] 앱 아이콘을 마스코트로 교체할지
- [ ] 회사 캘린더 일정을 본인에게는 제목까지 보여줄지
- [ ] 둘 중 한 명이 해외에 있을 때 시간대 처리 (지금은 각 폰의 시간대 기준)
- [ ] '이 일정만 삭제'로 반복 일정의 마지막 회차를 지우면 빈 행이 남음 (화면엔 안 보임)
