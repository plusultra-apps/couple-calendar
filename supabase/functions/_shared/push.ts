// 푸시 발송 공용: 알림함 기록 · 받는 사람 설정(종류별 끄기 · 조용한 시간) · web-push
import webpush from 'npm:web-push@3.6.7'
import { admin, getConfig } from './admin.ts'
import { toSeoulWall } from './seoul.ts'

export type Kind = 'event' | 'comment' | 'wish' | 'anniv' | 'photo' | 'like' | 'reminder' | 'update' | 'game'
export type Message = { title: string; body: string; tag: string; url: string }

let vapidReady = false
async function setupVapid() {
  if (vapidReady) return
  const c = await getConfig()
  webpush.setVapidDetails(c.vapid_subject, c.vapid_public, c.vapid_private)
  vapidReady = true
}

// 사용자 기기들로 발송. 만료된 구독(404/410)은 지운다. 성공한 기기 수를 돌려준다.
export async function sendToUsers(userIds: string[], msg: Message): Promise<number> {
  if (userIds.length === 0) return 0
  await setupVapid()
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (error) throw error

  const payload = JSON.stringify(msg)
  const expired: string[] = []
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 24,
          urgency: 'normal',
        })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) expired.push(s.id)
        else console.error('push 실패', code, (e as Error).message)
      }
    }),
  )
  if (expired.length) await admin.from('push_subscriptions').delete().in('id', expired)
  return sent
}

// 조용한 시간: 서울 밤 11시 ~ 아침 7시
export const isQuietNow = (now = new Date()) => {
  const h = toSeoulWall(now).getUTCHours()
  return h >= 23 || h < 7
}

// 한 사람에게 알림: 알림함에는 항상 남기고, 푸시는 설정에 따라
//  · 그 종류를 껐으면 보내지 않음
//  · 조용한 시간이면 미뤄 두었다가 아침 7시에 모아서 (remind 함수)
export async function deliver(userId: string, kind: Kind, msg: Message): Promise<'sent' | 'muted' | 'deferred' | 'skip'> {
  const { data: p } = await admin.from('profiles').select('couple_id, notify_off, quiet_hours').eq('id', userId).maybeSingle()
  if (!p?.couple_id) return 'skip'
  const muted = ((p.notify_off as string[] | null) ?? []).includes(kind)
  const deferred = !muted && p.quiet_hours && isQuietNow()
  const { error } = await admin.from('notifications').insert({
    user_id: userId,
    couple_id: p.couple_id,
    kind,
    title: msg.title,
    body: msg.body,
    url: msg.url,
    deferred,
  })
  if (error) console.error('알림함 기록 실패', error.message)
  if (muted) return 'muted'
  if (deferred) return 'deferred'
  await sendToUsers([userId], msg)
  return 'sent'
}
