/// <reference lib="webworker" />
// 서비스워커: 오프라인 캐시(precache) + 푸시 알림 수신
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// 새 버전은 바로 적용 (registerType: 'autoUpdate')
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: 모든 화면 이동은 index.html 로 (API 는 다른 출처라 영향 없음)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

type PushPayload = { title?: string; body?: string; tag?: string; url?: string }

self.addEventListener('push', (event) => {
  let p: PushPayload = {}
  try {
    p = event.data?.json() ?? {}
  } catch {
    p = { body: event.data?.text() }
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(p.title || '우리달력', {
        body: p.body ?? '',
        icon: '/pwa-192x192.png',
        // 안드로이드 상단 작은 아이콘은 모양(투명도)만 쓴다 → 흰색 달력 실루엣 (컬러 아이콘이면 네모·동그라미로 보임)
        badge: '/badge-96x96.png',
        tag: p.tag,
        data: { url: p.url || '/' },
      }),
      // 업데이트 알림을 받으면 그 자리에서 새 버전을 확인한다 → 앱이 떠 있으면 거의 바로 갱신
      p.tag === 'app-update' ? self.registration.update().catch(() => {}) : Promise.resolve(),
    ]),
  )
})

// 알림을 누르면 열려 있는 앱 창을 앞으로 가져와 해당 화면으로 이동, 없으면 새 창
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string } | null)?.url || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin)
      if (win) {
        await win.focus()
        await win.navigate(url).catch(() => undefined)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
