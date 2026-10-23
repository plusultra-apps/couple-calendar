import { Compass, PlusSquare, Share } from 'lucide-react'
import type { ReactNode } from 'react'
import { isIOSSafari } from './platform'

// 아이폰 "홈 화면에 추가" 그림 안내 (설치 배너 시트 · 설정 화면에서 같이 쓴다)
export function IosInstallSteps() {
  const safari = isIOSSafari()
  return (
    <div className="flex flex-col gap-3">
      {!safari && (
        <div className="flex items-start gap-3 rounded-2xl bg-anniv/30 p-4 text-sm">
          <Compass className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            아이폰은 <b>사파리</b>에서만 홈 화면에 추가할 수 있어요. 카카오톡 등에서 열었다면 오른쪽 아래 메뉴에서{' '}
            <b>‘Safari로 열기’</b>를 먼저 눌러 주세요.
          </p>
        </div>
      )}
      <Step n={1} icon={<Share className="h-6 w-6" aria-hidden />} title="화면 아래 공유 버튼을 눌러요">
        네모에서 화살표가 위로 나온 모양이에요. 아이패드는 주소창 오른쪽에 있어요.
      </Step>
      <Step n={2} icon={<PlusSquare className="h-6 w-6" aria-hidden />} title="‘홈 화면에 추가’를 골라요">
        안 보이면 메뉴를 위로 조금 올려 보세요. 오른쪽 위 ‘추가’를 누르면 끝!
      </Step>
      <Step
        n={3}
        icon={<img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />}
        title="홈 화면의 러브로그 아이콘으로 열어요"
      >
        앱처럼 전체 화면으로 열리고, 알림도 받을 수 있어요 (iOS 16.4 이상).
      </Step>
    </div>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-bg p-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-sat shadow-sm">
        {icon}
        <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
          {n}
        </span>
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  )
}
