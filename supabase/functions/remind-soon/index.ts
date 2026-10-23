// 1시간 전 알림: 10분마다 cron 이 부른다 (x-cron-secret 인증, verify_jwt = false)
// '우리'(같이 하는) 시간 일정 + 개인 시간 일정이 시작 1시간 안으로 들어오면 알린다.
//  · '우리' 일정 → 두 사람 모두 / 개인 일정 → 그 주인에게만 (상대 개인 일정은 안 보냄)
//  · 반복 일정도 회차별로 한 번만 (public.event_reminders 로 중복 방지)
//  · 받는 사람 설정(⏰ 미리 알림 끄기·조용한 시간)은 _shared/push.ts deliver 가 따른다
import * as rrulePkg from 'npm:rrule@2.8.1'
import { admin, getConfig } from '../_shared/admin.ts'
import { json, safeEqual } from '../_shared/http.ts'
import { deliver, type Message } from '../_shared/push.ts'
import { seoulDateKey } from '../_shared/seoul.ts'

// rrule 은 CommonJS 라 Deno 에서는 이름 있는 export 가 없다 → default 안에서 꺼낸다
const { RRule } = ((rrulePkg as unknown as { default?: typeof rrulePkg }).default ?? rrulePkg) as typeof rrulePkg

const KST_MS = 9 * 60 * 60 * 1000
const WINDOW_MIN = 60 // 시작 몇 분 전까지 당겨서 알릴지

type Row = {
  id: string
  couple_id: string
  owner_id: string | null
  title: string
  is_private: boolean
  starts_at: string | null
  rrule?: string | null
  exdates?: string[] | null
  event_secrets?: { title: string } | null
}

// 서울 벽시계 Date(UTC 필드가 서울 값) → '오후 7:00'
function hhmm(wall: Date): string {
  const h = wall.getUTCHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(wall.getUTCMinutes()).padStart(2, '0')}`
}
const keyOf = (wall: Date) => wall.toISOString().slice(0, 10)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const c = await getConfig()
    if (!safeEqual(req.headers.get('x-cron-secret'), c.cron_secret)) return json({ error: 'unauthorized' }, 401)

    // 시험용: { couple_id } 를 주면 그 커플만 (오래된 기록 정리는 건너뜀)
    const only = ((await req.json().catch(() => ({}))) as { couple_id?: string }).couple_id

    const now = new Date()
    const windowEnd = new Date(now.getTime() + WINDOW_MIN * 60_000)

    // 커플 구성원 (couple_id → [user ids])
    let pq = admin.from('profiles').select('id, couple_id').not('couple_id', 'is', null)
    if (only) pq = pq.eq('couple_id', only)
    const { data: profs, error: pErr } = await pq
    if (pErr) throw pErr
    const members = new Map<string, string[]>()
    for (const p of profs ?? []) members.set(p.couple_id!, [...(members.get(p.couple_id!) ?? []), p.id])

    // 1) 반복 없는 시간 일정: 다가오는 60분 안
    let q1 = admin
      .from('events')
      .select('id, couple_id, owner_id, title, is_private, starts_at, event_secrets(title)')
      .eq('all_day', false)
      .is('rrule', null)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', windowEnd.toISOString())
    if (only) q1 = q1.eq('couple_id', only)
    const { data: oneShot, error: e1 } = await q1
    if (e1) throw e1

    // 2) 반복 시간 일정: 전부 가져와 다음 회차가 창 안인지 계산
    let q2 = admin
      .from('events')
      .select('id, couple_id, owner_id, title, is_private, starts_at, rrule, exdates, event_secrets(title)')
      .eq('all_day', false)
      .not('rrule', 'is', null)
    if (only) q2 = q2.eq('couple_id', only)
    const { data: recurring, error: e2 } = await q2
    if (e2) throw e2

    type Hit = { ev: Row; start: Date; occKey: string }
    const hits: Hit[] = []

    for (const ev of (oneShot ?? []) as Row[]) {
      const start = new Date(ev.starts_at!)
      hits.push({ ev, start, occKey: seoulDateKey(start) })
    }

    // 반복은 서울 벽시계 기준(앱과 같은 floating)으로 회차를 편다
    const fromWall = new Date(now.getTime() + KST_MS)
    const toWall = new Date(windowEnd.getTime() + KST_MS)
    for (const ev of (recurring ?? []) as Row[]) {
      if (!ev.starts_at || !ev.rrule) continue
      const baseWall = new Date(new Date(ev.starts_at).getTime() + KST_MS)
      const rule = new RRule({ ...RRule.parseString(ev.rrule), dtstart: baseWall })
      const ex = new Set(ev.exdates ?? [])
      for (const occWall of rule.between(fromWall, toWall, true)) {
        if (ex.has(keyOf(occWall))) continue
        hits.push({ ev, start: new Date(occWall.getTime() - KST_MS), occKey: keyOf(occWall) })
      }
    }

    let sent = 0
    for (const { ev, start, occKey } of hits) {
      const recipients = ev.owner_id ? [ev.owner_id] : (members.get(ev.couple_id) ?? [])
      if (recipients.length === 0) continue

      // 중복 방지: 이 (일정, 회차) 를 먼저 '보냄'으로 찜한다. 이미 있으면(23505) 건너뛴다.
      const { error: insErr } = await admin.from('event_reminders').insert({ event_id: ev.id, occ_key: occKey })
      if (insErr) {
        if ((insErr as { code?: string }).code !== '23505') console.error('event_reminders insert 실패', insErr.message)
        continue
      }

      const wall = new Date(start.getTime() + KST_MS)
      const mins = Math.round((start.getTime() - now.getTime()) / 60_000)
      const soon = mins >= 50 ? '1시간 뒤' : mins >= 15 ? `${Math.round(mins / 5) * 5}분 뒤` : '곧'
      const title = ev.is_private ? (ev.event_secrets?.title ?? '바쁨') : ev.title || '일정'
      const whose = ev.owner_id ? '내' : '우리'
      const msg: Message = {
        title: `⏰ ${soon} ${whose} 일정`,
        body: `${hhmm(wall)} · ${title}`,
        tag: `soon-${ev.id}-${occKey}`,
        url: `/event/${ev.id}`,
      }
      for (const uid of recipients) if ((await deliver(uid, 'reminder', msg)) === 'sent') sent++
    }

    // 오래된 기록 정리 (이틀 지난 것)
    if (!only) await admin.from('event_reminders').delete().lt('sent_at', new Date(now.getTime() - 2 * 86_400_000).toISOString())

    console.log(`remind-soon ${now.toISOString()}: 대상 ${hits.length}건 · 발송 ${sent}`)
    return json({ checked: hits.length, sent })
  } catch (e) {
    console.error('remind-soon 오류', e)
    return json({ error: (e as Error).message }, 500)
  }
})
