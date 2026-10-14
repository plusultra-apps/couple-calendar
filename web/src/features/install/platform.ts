import { useSyncExternalStore } from 'react'

// 설치(홈 화면 추가) 관련 환경 판별과 Android/Chrome 설치 이벤트 보관.
// 이 모듈은 앱 시작 시 Layout → InstallPrompt 를 통해 바로 불러와지므로,
// 로그인 전에 발생한 beforeinstallprompt 도 놓치지 않는다.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const hasWindow = typeof window !== 'undefined'

// 홈 화면 앱으로 실행 중인지
export function isStandalone(): boolean {
  if (!hasWindow) return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function isIOS(): boolean {
  if (!hasWindow) return false
  const ua = navigator.userAgent
  // iPadOS 13+ 는 맥으로 보이므로 터치 지원 여부로 구분
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// iOS 의 사파리인지 (크롬·카카오톡 등 앱 안 브라우저 제외)
export function isIOSSafari(): boolean {
  if (!isIOS()) return false
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua)
}

// ── Android/Chrome 설치 이벤트 ──
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (hasWindow) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// 설치 가능하면 true (브라우저가 beforeinstallprompt 를 보냈을 때)
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  )
}

// 브라우저 설치 창을 띄운다. 설치하면 true.
export async function promptInstall(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  // 한 번 쓴 이벤트는 다시 쓸 수 없다
  deferred = null
  emit()
  return outcome === 'accepted'
}

// ── 배너 닫기 기억 (7일) ──
const DISMISS_KEY = 'ourcal.install.dismissedAt'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export function isDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return !!at && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

export function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // 저장소를 못 쓰는 환경이면 이번 실행 동안만 숨긴다
  }
}
