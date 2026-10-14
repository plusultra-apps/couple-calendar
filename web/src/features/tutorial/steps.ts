// 튜토리얼 단계. target = 화면 요소의 data-tut 값.
// action: next(말풍선의 '다음') / tap(반짝이는 곳을 눌러야 넘어감) / dbltap(두 번 톡톡)
// tap·dbltap 단계는 연습 화면이 emit(waitFor ?? target) 을 부르면 넘어간다.
export type Step = {
  section?: string
  title: string
  body: string
  target?: string
  action: 'next' | 'tap' | 'dbltap'
  waitFor?: string
  cta?: string
}

export function makeSteps(n: { me: string; partner: string; meAvatar: string; partnerAvatar: string }): Step[] {
  return [
    // ── 시작 ──
    {
      title: '우리달력에 온 걸 환영해요!',
      body: `지금부터 하나씩 직접 눌러 보면서 사용법을 알려 드릴게요.\n\n여기 나오는 일정·사진은 전부 연습용이라 실제로 저장되지 않고, ${n.partner}에게 알림도 가지 않아요. 마음껏 눌러 보세요.`,
      action: 'next',
      cta: '시작하기',
    },
    {
      section: '둘러보기',
      title: '아래 탭으로 화면을 옮겨 다녀요',
      body: '캘린더 · 위시 · 추억 · 기념일 · 설정, 다섯 칸이에요. 하나씩 다 가 볼 거예요.',
      target: 'tabbar',
      action: 'next',
    },

    // ── 캘린더 ──
    {
      section: '캘린더',
      title: '누구 일정인지 얼굴로 구분해요',
      body: `일정 막대 맨 앞의 얼굴을 보세요.\n${n.meAvatar} = ${n.me}(나)   ${n.partnerAvatar} = ${n.partner}   💞 = 우리 둘이 함께\n색도 사람마다 달라요. 설정에서 바꿀 수 있어요.`,
      target: 'cal-grid',
      action: 'next',
    },
    {
      section: '캘린더',
      title: '보고 싶은 일정만 골라 볼 수 있어요',
      body: "'우리'를 눌러 둘이 함께하는 약속만 모아 볼게요.",
      target: 'filter-us',
      action: 'tap',
    },
    {
      section: '캘린더',
      title: '함께하는 약속만 남았어요',
      body: "'나'를 누르면 내 일정만, 상대 이름을 누르면 상대 일정만 보여요.\n이제 다시 '전체'를 눌러 볼까요?",
      target: 'filter-all',
      action: 'tap',
    },
    {
      section: '캘린더',
      title: '달력을 사진으로 볼 수도 있어요',
      body: '날짜 옆 작은 점은 그날 사진이 있다는 표시예요.\n📷 버튼을 눌러 사진 보기로 바꿔 볼까요?',
      target: 'photo-mode',
      waitFor: 'photo-mode-on',
      action: 'tap',
    },
    {
      section: '캘린더',
      title: '한 달이 사진 일기가 됐어요',
      body: '일정 아래 남은 칸에 그날 대표 사진이 보여요.\n날짜를 누르면 그날 사진을 모두 볼 수 있고, 사진을 꾹 눌러 끌어서 맨 앞에 두면 그 사진이 대표가 돼요.',
      target: 'cal-grid',
      action: 'next',
    },
    {
      section: '캘린더',
      title: '다시 일정 보기로',
      body: '📷 버튼을 한 번 더 누르면 원래 달력으로 돌아와요.',
      target: 'photo-mode',
      waitFor: 'photo-mode-off',
      action: 'tap',
    },
    {
      section: '캘린더',
      title: '🔔 알림함',
      body: `${n.partner}가 일정·사진·댓글을 남기거나 기념일이 다가오면 종에 숫자가 떠요. 눌러서 모아 볼 수 있어요.\n받을 알림은 설정에서 고르고, 밤 11시~아침 7시엔 울리지 않고 모았다가 아침에 알려 줘요.`,
      target: 'bell',
      action: 'next',
    },
    {
      section: '캘린더',
      title: '날짜를 눌러 그날을 자세히 봐요',
      body: '반짝이는 날짜를 눌러 보세요.',
      target: 'demo-day',
      action: 'tap',
    },
    {
      section: '날짜 창',
      title: '둘 다 비는 시간이 한눈에 보여요',
      body: `${n.meAvatar} 내 줄, ${n.partnerAvatar} ${n.partner} 줄에 바쁜 시간이 색 막대로 나와요.\n💞 둘 다 줄의 민트색이 둘 다 비는 시간이에요. 데이트 시간 잡을 때 딱이죠.\n\n우리 일정(보라색)은 '함께'로 따로 보여요.`,
      target: 'free-time',
      action: 'next',
    },
    {
      section: '날짜 창',
      title: '빈 시간을 누르면 바로 약속 잡기',
      body: '이 시간 버튼을 누르면 시작 시간이 채워진 채로 새 일정 화면이 열려요.',
      target: 'free-slot',
      action: 'tap',
    },

    // ── 일정 만들기 ──
    {
      section: '일정 만들기',
      title: '시간이 이미 채워져 있어요',
      body: '방금 고른 빈 시간이 시작 시간으로 들어왔어요. 시간·날짜 버튼을 누르면 미니 달력과 톡톡 시간판으로 쉽게 바꿀 수 있어요.',
      target: 'ed-time',
      action: 'next',
    },
    {
      section: '일정 만들기',
      title: '자주 하는 일정은 칩 한 번으로',
      body: "운동처럼 자주 하는 일정은 '빠른 선택'에 모여 있어요. 제목·누구 일정·시간이 한 번에 채워져요.\n'데이트'를 눌러 보세요.",
      target: 'ed-quick',
      action: 'tap',
    },
    {
      section: '일정 만들기',
      title: '누구의 일정인가요?',
      body: `우리(💞) · ${n.me} · ${n.partner} 중에 골라요.\n둘이 함께하는 약속은 '우리', 혼자 하는 건 내 이름으로 하면 달력에서 구분돼요.`,
      target: 'ed-owner',
      action: 'next',
    },
    {
      section: '일정 만들기',
      title: '공개 범위도 정할 수 있어요',
      body: `내 일정일 때 고를 수 있어요.\n• 같이 보기: ${n.partner}도 다 봐요\n• 바쁨으로만: 시간만 '바쁨'으로 보이고 제목·장소는 숨겨요\n• 나만 보기: ${n.partner}에게 아예 안 보여요 (내 달력에만 기록)`,
      target: 'ed-visibility',
      action: 'next',
    },
    {
      section: '일정 만들기',
      title: '장소는 카카오맵에서 찾아요',
      body: '장소 찾기를 누르면 카카오맵 검색으로 가게를 고를 수 있어요. 고른 장소는 사진·블로그 후기·길찾기까지 볼 수 있어요.',
      target: 'ed-place',
      action: 'next',
    },
    {
      section: '일정 만들기',
      title: '저장해 볼까요?',
      body: `저장하면 ${n.partner}에게 알림이 가요. (지금은 연습이라 안 가요)`,
      target: 'ed-save',
      action: 'tap',
    },
    {
      section: '캘린더',
      title: '달력에 새 약속이 생겼어요!',
      body: '💞 데이트가 들어간 게 보이죠? 일정을 누르면 상세 화면에서 댓글·반응·사진도 남길 수 있어요.',
      target: 'demo-day',
      action: 'next',
    },

    // ── 도장 ──
    {
      section: '도장 찍기',
      title: '매일 하는 일정은 도장으로 쾅쾅',
      body: '운동처럼 여러 날에 같은 일정을 넣을 땐 도장이 편해요. 도장 버튼을 눌러 보세요.',
      target: 'stamp-btn',
      action: 'tap',
    },
    {
      section: '도장 찍기',
      title: '찍을 도장을 골라요',
      body: "도장은 '내 도장 · 우리 도장 · 상대' 탭으로 나뉘어 있어요. 자주 한 일정은 자동으로 추천돼요.\n'운동' 도장을 골라 보세요.",
      target: 'stamp-pick',
      action: 'tap',
    },
    {
      section: '도장 찍기',
      title: '날짜를 톡 누르면 쾅!',
      body: '반짝이는 날짜를 눌러 보세요.',
      target: 'stamp-day-1',
      action: 'tap',
    },
    {
      section: '도장 찍기',
      title: '하나 더 찍어 볼까요?',
      body: '같은 날을 다시 누르면 도장이 지워져요.',
      target: 'stamp-day-2',
      action: 'tap',
    },
    {
      section: '도장 찍기',
      title: '다 찍었으면 완료',
      body: '완료를 누르면 도장 모드가 끝나요.',
      target: 'stamp-done',
      action: 'tap',
    },
    {
      section: '캘린더',
      title: '일반 일정은 + 버튼으로',
      body: '날짜를 먼저 누르고 [일정 추가]를 눌러도 되고, 이 + 버튼을 눌러도 돼요. 반복(매주·매월)·종일·여러 날 일정도 다 돼요.',
      target: 'fab',
      action: 'next',
    },

    // ── 위시 ──
    {
      section: '위시',
      title: '위시 탭으로 가 볼까요?',
      body: '가고 싶은 곳, 하고 싶은 걸 담아 두는 곳이에요.',
      target: 'tab-wish',
      action: 'tap',
    },
    {
      section: '위시',
      title: '둘의 버킷리스트',
      body: '맛집·여행·하고 싶은 것을 담아 두면 둘 다 볼 수 있어요. 장소를 고르면 사진이 자동으로 붙어요.\n다 해낸 건 체크해서 추억으로 남겨요.',
      target: 'wish-list',
      action: 'next',
    },
    {
      section: '위시',
      title: '새 위시를 담아 볼게요',
      body: '+ 버튼을 눌러 보세요.',
      target: 'wish-add',
      action: 'tap',
    },
    {
      section: '위시',
      title: '장소 찾기',
      body: '가게 이름으로 카카오맵에서 검색해요. 눌러 보세요.',
      target: 'wish-place',
      action: 'tap',
    },
    {
      section: '위시',
      title: '검색 결과에서 골라요',
      body: '주소·분류·카카오맵 링크가 한 번에 들어가요.',
      target: 'wish-result',
      action: 'tap',
    },
    {
      section: '위시',
      title: '담기!',
      body: '담기를 눌러 보세요.',
      target: 'wish-save',
      action: 'tap',
    },
    {
      section: '위시',
      title: '위시에서 바로 약속 잡기',
      body: "위시 카드의 '날짜 잡기'를 누르면 이 장소로 일정이 바로 만들어져요.\n\n💡 안드로이드는 카카오맵 앱에서 장소 → 공유 → 우리달력을 고르면 바로 위시에 담겨요.",
      target: 'wish-plan',
      action: 'next',
    },

    // ── 추억 ──
    {
      section: '추억',
      title: '추억 탭으로!',
      body: '둘이 찍은 사진을 인스타처럼 모아 보는 곳이에요.',
      target: 'tab-memories',
      action: 'tap',
    },
    {
      section: '추억',
      title: '사진을 두 번 톡톡 → 하트',
      body: '같은 날·같은 데이트 사진은 게시물 하나로 묶여요. 옆으로 넘겨 볼 수 있어요.\n사진을 두 번 톡톡 눌러 보세요.',
      target: 'post-photo',
      action: 'dbltap',
      waitFor: 'post-like',
    },
    {
      section: '추억',
      title: '누가 좋아했는지 보여요',
      body: "아래에 한 줄 글도 남길 수 있어요. 데이트 일정에 붙은 사진이면 말풍선을 눌러 댓글로 이어져요.",
      target: 'post-footer',
      action: 'next',
    },
    {
      section: '추억',
      title: '모아 보기',
      body: '격자 버튼을 누르면 인스타 프로필처럼 사진만 쭉 모아 봐요.',
      target: 'mem-grid',
      action: 'tap',
    },
    {
      section: '추억',
      title: '사진 올리기',
      body: '이 버튼으로 날짜를 고르고 여러 장을 한 번에 올려요. 인생네컷도 따로 모아져요.\n달력 날짜 창의 [사진] 버튼으로도 그날 사진을 올릴 수 있어요.',
      target: 'mem-upload',
      action: 'next',
    },

    // ── 기념일 ──
    {
      section: '기념일',
      title: '기념일 탭으로 가요',
      body: '',
      target: 'tab-anniv',
      action: 'tap',
    },
    {
      section: '기념일',
      title: '우리가 함께한 날',
      body: '사귄 날부터 며칠째인지 보여요. 사귄 날이 1일째예요.\n배경과 프로필 사진은 카톡처럼 눌러서 바꿀 수 있어요.',
      target: 'an-hero',
      action: 'next',
    },
    {
      section: '기념일',
      title: '챙기는 방식은 우리 마음대로',
      body: '100일마다 챙길지, 1000일마다 챙길지, 안 챙길지 골라요. 22일·50일 같은 특별한 날도 더할 수 있어요.\n다가오는 날은 달력에도 자동으로 나와요.',
      target: 'an-rule',
      action: 'next',
    },
    {
      section: '기념일',
      title: '날짜 계산기',
      body: "'1000일째는 언제?', '이 날은 며칠째?'를 바로 계산해요.",
      target: 'an-calc',
      action: 'next',
    },
    {
      section: '기념일',
      title: '우리만의 기념일',
      body: '처음 만난 날, 결혼기념일처럼 먼 미래 날짜도 등록돼요. 음력도 되고, 매년 반복할지도 골라요.\n생일은 설정의 프로필에 넣으면 자동으로 챙겨져요.',
      target: 'an-add',
      action: 'next',
    },

    // ── 설정 ──
    {
      section: '설정',
      title: '마지막으로 설정!',
      body: '',
      target: 'tab-settings',
      action: 'tap',
    },
    {
      section: '설정',
      title: '알림 켜기',
      body: `${josa(n.partner, '이', '가')} 일정을 추가하거나 댓글을 달면 알림이 와요.\n아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요.`,
      target: 'set-push',
      action: 'next',
    },
    {
      section: '설정',
      title: '화면 테마',
      body: '핑크가 부담스러우면 하늘·민트·모카·심플로 바꿔요. 휴대폰마다 따로라 서로 다른 테마를 써도 돼요.',
      target: 'set-theme',
      action: 'next',
    },
    {
      section: '설정',
      title: '회사 캘린더 연결',
      body: "구글 캘린더 같은 회사 일정을 연결하면 '바쁨'으로만 보여요. 내용은 안 보이고 시간만 막혀서 빈 시간 찾기에 반영돼요.",
      target: 'set-external',
      action: 'next',
    },
    {
      section: '설정',
      title: '🃏 같이 놀기',
      body: `술 한잔할 때 ${josa(n.partner, '과', '와')} 몽글 인디언 포커를 해 봐요. 내 카드는 나만 몰라요!\n여기서 게임을 열면 ${n.partner}에게 초대 알림이 가요.`,
      target: 'set-poker',
      action: 'next',
    },
    {
      section: '설정',
      title: '튜토리얼은 언제든 다시',
      body: '헷갈리면 여기 [사용법 다시 보기]를 누르면 처음부터 다시 볼 수 있어요.',
      target: 'set-tutorial',
      action: 'next',
    },
    {
      title: '준비 끝! 🎉',
      body: `이제 ${josa(n.partner, '과', '와')} 진짜 일정을 채워 볼까요?\n연습으로 만든 일정·위시·사진은 사라지고, 실제 달력으로 돌아가요.`,
      action: 'next',
      cta: '우리달력 시작하기',
    },
  ]
}

// 이름 뒤 조사: 받침 있으면 a(이·과), 없으면 b(가·와). 한글이 아니면 b
function josa(name: string, a: string, b: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  const has = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${name}${has ? a : b}`
}
