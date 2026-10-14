// 새 버전 배포 → 폰에 깔린 앱도 알아서 바뀌게
// - 앱으로 돌아올 때(화면 켜짐)마다 새 버전이 있는지 확인 (폰은 앱을 잘 안 끄니까)
// - 새 버전이 자리 잡으면 다시 불러온다. 일정 쓰는 중(/event/…)이면 화면을 떠날 때까지 기다린다.
export function setupPwaUpdate() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  // 처음 설치될 때는 다시 불러올 필요 없음
  const hadController = !!navigator.serviceWorker.controller
  let pending = false

  const busy = () => location.pathname.startsWith('/event/')
  const reload = () => {
    pending = false
    location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    if (document.visibilityState === 'hidden' || !busy()) reload()
    else pending = true
  })

  let lastCheck = 0
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      if (pending) reload()
      return
    }
    if (Date.now() - lastCheck < 60_000) return
    lastCheck = Date.now()
    const reg = await navigator.serviceWorker.getRegistration()
    reg?.update().catch(() => {})
  })

  // 일정 화면에서 나가면 미뤄 둔 새로고침
  window.addEventListener('popstate', () => pending && !busy() && reload())
}
