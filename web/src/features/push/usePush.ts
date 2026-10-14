import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// 푸시 구독 상태
// - unsupported:  브라우저가 웹 푸시를 지원하지 않음
// - needs-install: iOS 에서 홈 화면 앱으로 실행하지 않음 (iOS 16.4+ 는 홈 화면 앱에서만 푸시 가능)
// - denied:       알림 권한 거부됨
// - off / on:     구독 안 함 / 구독 중
export type PushStatus = 'loading' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_KEY

// base64url → Uint8Array (applicationServerKey)
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function initialStatus(): PushStatus {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!isSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'loading'
}

// 구독 정보를 DB 에 저장한다. 같은 endpoint 가 있으면 지우고 다시 넣는다(재구독 대비).
// user_id 는 DB 기본값(auth.uid()).
async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const { error: delError } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  if (delError) throw delError
  return supabase.from('push_subscriptions').insert({
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    user_agent: navigator.userAgent.slice(0, 300),
  })
}

// 서비스워커 준비 대기 (개발 서버는 서비스워커가 없으므로 시간 제한)
function swReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('앱이 아직 준비되지 않았어요. 새로고침 후 다시 시도해 주세요')), 8000),
    ),
  ])
}

const subscribe = (reg: ServiceWorkerRegistration) =>
  reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY!) })

export function usePush() {
  const [status, setStatus] = useState<PushStatus>(initialStatus)
  const [busy, setBusy] = useState(false)

  // 현재 기기 구독 여부 확인. 구독이 있으면 DB 에도 있도록 맞춘다.
  useEffect(() => {
    if (status !== 'loading') return
    let alive = true
    ;(async () => {
      const reg = await swReady()
      const sub = await reg.pushManager.getSubscription()
      if (sub) await saveSubscription(sub).catch(() => undefined)
      if (alive) setStatus(sub ? 'on' : 'off')
    })().catch(() => alive && setStatus('off'))
    return () => {
      alive = false
    }
  }, [status])

  const enable = useCallback(async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await swReady()
      let sub = (await reg.pushManager.getSubscription()) ?? (await subscribe(reg))
      let { error } = await saveSubscription(sub)
      // 이 기기의 endpoint 가 다른 계정에 묶여 있으면 새 endpoint 로 다시 구독한다
      if (error?.code === '23505') {
        await sub.unsubscribe()
        sub = await subscribe(reg)
        ;({ error } = await saveSubscription(sub))
      }
      if (error) throw error
      setStatus('on')
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await swReady()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        if (error) throw error
        await sub.unsubscribe()
      }
      setStatus('off')
    } finally {
      setBusy(false)
    }
  }, [])

  // 내 기기들로 테스트 알림 보내기. 보낸 기기 수를 돌려준다.
  const sendTest = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke<{ sent: number }>('notify', { body: { type: 'test' } })
    if (error) throw error
    return data?.sent ?? 0
  }, [])

  return { status, busy, enable, disable, sendTest, isIOS: isIOS() }
}
