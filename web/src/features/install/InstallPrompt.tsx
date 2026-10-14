import { Download, Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button } from '../../components/ui'
import { IosInstallSteps } from './IosInstallSteps'
import { isDismissed, isIOS, isStandalone, promptInstall, rememberDismiss, useCanInstall } from './platform'

// 화면 맨 위에 뜨는 "홈 화면에 추가" 안내 배너.
// 홈 화면 앱으로 실행 중이거나, 7일 안에 닫았으면 보이지 않는다.
export function InstallPrompt() {
  const canInstall = useCanInstall()
  const [hidden, setHidden] = useState(() => isStandalone() || isDismissed())
  const [guideOpen, setGuideOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const ios = isIOS()

  if (hidden || (!ios && !canInstall)) return null

  const dismiss = () => {
    rememberDismiss()
    setHidden(true)
  }

  async function install() {
    setInstalling(true)
    try {
      if (await promptInstall()) setHidden(true)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <>
      <div className="shrink-0 px-3 pt-2 pb-1">
        <div className="flex items-center gap-3 rounded-[24px] border-2 border-partner bg-surface p-3 shadow-[0_4px_0_var(--color-line)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-partner/30">
            <Smartphone className="h-5 w-5" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            홈 화면에 추가하면 앱처럼 쓰고 <b>알림</b>도 받을 수 있어요
          </p>
          {ios ? (
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="h-9 shrink-0 rounded-full bg-accent px-3.5 text-sm font-bold text-white active:brightness-95"
            >
              방법 보기
            </button>
          ) : (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 text-sm font-bold text-white active:brightness-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />앱 설치
            </button>
          )}
          <button
            type="button"
            aria-label="안내 닫기 (7일 동안 숨김)"
            onClick={dismiss}
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft active:bg-line"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {ios && (
        <Sheet
          open={guideOpen}
          onOpenChange={setGuideOpen}
          title="홈 화면에 추가하기"
          footer={<Button onClick={() => setGuideOpen(false)}>알겠어요</Button>}
        >
          <IosInstallSteps />
        </Sheet>
      )}
    </>
  )
}
