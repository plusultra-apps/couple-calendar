import { Copy, Download, EllipsisVertical, Globe, PlusSquare, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { Mascot } from '../../components/Mascot'
import { IosInstallSteps } from './IosInstallSteps'
import { isIOS, isStandalone, promptInstall, useCanInstall } from './platform'

// 웹으로 처음 들어오면 화면 가득 "휴대폰에 설치하세요" 안내.
// 홈 화면 앱으로 열었으면 안 보이고, '웹에서 둘러볼게요'를 누르면 3일 동안 숨긴다.
const KEY = 'ourcal.install.introAt'
const HIDE_MS = 3 * 24 * 60 * 60 * 1000

function seenRecently() {
  try {
    const at = Number(localStorage.getItem(KEY))
    return !!at && Date.now() - at < HIDE_MS
  } catch {
    return false
  }
}

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
const isAndroid = /Android/i.test(ua)
const inAppBrowser = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps/i.test(ua)
const isMobile = isAndroid || isIOS()

export function InstallIntro() {
  const [open, setOpen] = useState(() => !isStandalone() && !seenRecently())
  const canInstall = useCanInstall()
  const [installing, setInstalling] = useState(false)

  if (!open) return null

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* 이번만 숨김 */
    }
    setOpen(false)
  }

  async function install() {
    setInstalling(true)
    try {
      if (await promptInstall()) setOpen(false)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="flex flex-col items-center text-center">
          <Mascot size={150} />
          <h1 className="mt-3 text-[26px] leading-tight">
            우리달력은
            <br />
            <span className="text-accent-deep">휴대폰 앱</span>으로 써 주세요
          </h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            홈 화면에 추가하면 앱처럼 열리고
            <br />
            일정·댓글 <b className="text-ink">알림</b>도 받을 수 있어요. 앱스토어는 필요 없어요!
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {!isMobile ? (
            <DesktopQr />
          ) : inAppBrowser ? (
            <InAppGuide />
          ) : isIOS() ? (
            <IosInstallSteps />
          ) : canInstall ? (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="font-display press-3d flex h-16 items-center justify-center gap-2 rounded-full bg-accent text-xl text-white [--shade:var(--color-accent-deep)] disabled:opacity-60"
            >
              <Download className="h-6 w-6" /> 앱 설치하기
            </button>
          ) : (
            <AndroidSteps />
          )}
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-auto pt-8 text-center text-sm text-ink-soft underline underline-offset-4"
        >
          웹에서 먼저 둘러볼게요
        </button>
      </div>
    </div>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-[0_3px_0_var(--color-line)]">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bg text-sat">
        {icon}
        <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
          {n}
        </span>
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold">{title}</p>
        {children && <p className="mt-0.5 text-sm text-ink-soft">{children}</p>}
      </div>
    </div>
  )
}

// 삼성 인터넷 등 설치 창이 바로 안 뜨는 브라우저
function AndroidSteps() {
  return (
    <>
      <Step n={1} icon={<EllipsisVertical className="h-6 w-6" />} title="브라우저 메뉴를 열어요">
        크롬은 오른쪽 위 ⋮, 삼성 인터넷은 오른쪽 아래 ≡ 버튼이에요.
      </Step>
      <Step n={2} icon={<PlusSquare className="h-6 w-6" />} title="‘홈 화면에 추가’ 또는 ‘앱 설치’">
        삼성 인터넷은 ‘현재 페이지 추가 → 홈 화면’이에요.
      </Step>
      <Step n={3} icon={<img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />} title="홈 화면의 우리달력 아이콘으로 열어요" />
    </>
  )
}

// 카카오톡 등 앱 안에서 연 경우: 진짜 브라우저로 옮겨야 설치된다
function InAppGuide() {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.origin)
      setCopied(true)
    } catch {
      /* 복사 못 하면 안내만 */
    }
  }
  return (
    <>
      <div className="rounded-2xl bg-anniv/35 p-4 text-[15px]">
        지금은 <b>카카오톡 같은 앱 안의 브라우저</b>예요. 여기서는 설치가 안 돼서{' '}
        <b>{isIOS() ? 'Safari' : '크롬·삼성 인터넷'}</b>으로 열어야 해요.
      </div>
      <Step n={1} icon={<EllipsisVertical className="h-6 w-6" />} title={isIOS() ? '오른쪽 아래 ⋯ 메뉴' : '오른쪽 위 ⋮ 메뉴'}>
        {isIOS() ? '‘Safari로 열기’를 눌러요.' : '‘다른 브라우저로 열기’를 눌러요.'}
      </Step>
      <Step n={2} icon={<Globe className="h-6 w-6" />} title="열린 브라우저에서 다시 안내를 따라요" />
      <button
        type="button"
        onClick={copy}
        className="font-display press-3d flex h-13 items-center justify-center gap-2 rounded-full border-2 border-line bg-surface text-lg"
      >
        <Copy className="h-5 w-5" /> {copied ? '주소를 복사했어요!' : '주소 복사하기'}
      </button>
    </>
  )
}

// PC 로 열었을 때: 휴대폰 카메라로 찍을 QR
function DesktopQr() {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(location.origin, { width: 440, margin: 1, color: { dark: '#4B3A4F', light: '#FFFFFF' } })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [])
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] border-2 border-line bg-surface p-5 shadow-[0_5px_0_var(--color-line)]">
      <p className="font-display flex items-center gap-1.5 text-lg">
        <Smartphone className="h-5 w-5 text-accent" /> 휴대폰 카메라로 찍어 주세요
      </p>
      {src ? <img src={src} alt="우리달력 주소 QR 코드" className="h-56 w-56 rounded-2xl" /> : <div className="h-56 w-56 rounded-2xl bg-line/50" />}
      <p className="text-sm break-all text-ink-soft">{location.origin}</p>
      <p className="text-center text-xs text-ink-soft">
        갤럭시는 크롬·삼성 인터넷, 아이폰은 사파리로 열고
        <br />
        ‘홈 화면에 추가’를 하면 돼요.
      </p>
    </div>
  )
}
