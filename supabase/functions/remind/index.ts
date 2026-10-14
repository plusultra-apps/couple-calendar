// 매일 아침 7시(서울) cron 이 부른다 (x-cron-secret 인증, verify_jwt = false)
// 1) 조용한 시간(밤 11시~아침 7시)에 미뤄 둔 알림을 사람마다 한 번으로 모아 보낸다
// 2) 미리 알림: 오늘 시작하는 '우리' 일정 · 기념일 D-7·D-1·당일 · 생일 D-3·D-1·당일
// 3) 60일 지난 알림함 기록 정리
import * as rrulePkg from 'npm:rrule@2.8.1'
import { admin, getConfig } from '../_shared/admin.ts'
import { anniversariesBetween } from '../_shared/anniversary.ts'
import { addDaysKey } from '../_shared/dates.ts'
import { json, safeEqual } from '../_shared/http.ts'
import { deliver, sendToUsers, type Message } from '../_shared/push.ts'
import { fmtDayKey, seoulDateKey, toSeoulWall } from '../_shared/seoul.ts'

// rrule 은 CommonJS 라 Deno 에서는 이름 있는 export 가 없다 → default 안에서 꺼낸다
const { RRule } = ((rrulePkg as unknown as { default?: typeof rrulePkg }).default ?? rrulePkg) as typeof rrulePkg

// ── 1) 밤사이 알림 모아 보내기 ──
async function flushDeferred() {
  const { data, error } = await admin
    .from('notifications')
    .select('id, user_id, title, body, url')
    .eq('deferred', true)
    .order('created_at')
  if (error) throw error
  const byUser = new Map<string, NonNullable<typeof data>>()
  for (const n of data ?? []) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n])

  for (const [userId, list] of byUser) {
    const first = list[0]
    const msg: Message =
      list.length === 1
        ? { title: first.title, body: first.body, tag: 'overnight', url: first.url }
        : {
            title: `🌙 밤사이 알림 ${list.length}개`,
            body: list.slice(0, 2).map((n) => n.title).join(' · ') + (list.length > 2 ? ` 외 ${list.length - 2}개` : ''),
            tag: 'overnight',
            url: '/notifications',
          }
    await sendToUsers([userId], msg)
    await admin.from('notifications').update({ deferred: false }).in('id', list.map((n) => n.id))
  }
  return byUser.size
}

// ── 2) 미리 알림 ──

// 'yyyy-MM-dd' ↔ 같은 숫자의 UTC 자정 (반복 계산은 서울 벽시계 숫자를 UTC 로 두고 한다 — 앱과 같은 floating 방식)
const utcOf = (key: string) => new Date(`${key}T00:00:00Z`)
const keyOf = (d: Date) => d.toISOString().slice(0, 10)
const timeLabel = (d: Date) => {
  const h = d.getUTCHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

type EventRow = {
  title: string
  all_day: boolean
  starts_at: string | null
  start_date: string | null
  rrule: string | null
  exdates: string[] | null
}

// 그 일정이 오늘 '시작'하면 시작 시각(종일은 null)을, 아니면 undefined
function startsToday(e: EventRow, today: string): { time: Date | null } | undefined {
  const exdates = new Set(e.exdates ?? [])
  // 서울 벽시계 기준 시작 (종일: 그날 0시)
  const base = e.all_day ? utcOf(e.start_date!) : toSeoulWall(new Date(e.starts_at!))
  if (!e.rrule) return keyOf(base) === today ? { time: e.all_day ? null : base } : undefined
  const rule = new RRule({ ...RRule.parseString(e.rrule), dtstart: base })
  const hit = rule.between(utcOf(today), new Date(utcOf(today).getTime() + 86_400_000 - 1), true)[0]
  if (!hit || exdates.has(keyOf(hit))) return undefined
  return { time: e.all_day ? null : hit }
}

// 받침 있으면 '이에요', 없으면 '예요'
function ieyo(word: string): string {
  const last = [...word].reverse().find((ch) => ch >= '가' && ch <= '힣')
  if (!last) return '이에요'
  return (last.charCodeAt(0) - 0xac00) % 28 === 0 ? '예요' : '이에요'
}

async function remindCouple(couple: { id: string; started_on: string | null; day_every: number | null; day_marks: number[] | null }, today: string) {
  const [members, events, customs] = await Promise.all([
    admin.from('profiles').select('id, nickname, birthday, birthday_is_lunar').eq('couple_id', couple.id),
    admin
      .from('events')
      .select('title, all_day, starts_at, start_date, rrule, exdates')
      .eq('couple_id', couple.id)
      .is('owner_id', null)
      .eq('hidden', false),
    admin
      .from('anniversaries')
      .select('id, title, base_date, is_lunar, kind, emoji, count_days, day_every, day_marks')
      .eq('couple_id', couple.id),
  ])
  for (const r of [members, events, customs]) if (r.error) throw r.error
  const people = members.data ?? []
  if (people.length === 0) return 0
  let count = 0

  // 오늘 시작하는 우리 일정 (종일 먼저, 그다음 시간 순)
  const todays = ((events.data ?? []) as EventRow[])
    .map((e) => ({ e, hit: startsToday(e, today) }))
    .filter((x): x is { e: EventRow; hit: { time: Date | null } } => !!x.hit)
    .sort((a, b) => (a.hit.time?.getTime() ?? 0) - (b.hit.time?.getTime() ?? 0))
  if (todays.length > 0) {
    const line = ({ e, hit }: (typeof todays)[number]) => `${hit.time ? timeLabel(hit.time) : '종일'} ${e.title}`
    const msg: Message = {
      title: todays.length === 1 ? `💕 오늘 우리 일정: ${todays[0].e.title}` : `💕 오늘 우리 일정 ${todays.length}개`,
      body: todays.length === 1 ? line(todays[0]) : todays.map(line).join(' · '),
      tag: `today-${today}`,
      url: `/?d=${today}`,
    }
    for (const m of people) if ((await deliver(m.id, 'reminder', msg)) === 'sent') count++
  }

  // 다가오는 기념일 (7일 안)
  const annivs = anniversariesBetween(
    {
      startedOn: couple.started_on,
      coupleDays: { every: couple.day_every, marks: couple.day_marks ?? [] },
      members: people,
      customs: customs.data ?? [],
    },
    today,
    addDaysKey(today, 7),
  )
  for (const a of annivs) {
    const left = Math.round((utcOf(a.date).getTime() - utcOf(today).getTime()) / 86_400_000)
    const when = a.kind === 'birthday' ? [3, 1, 0] : [7, 1, 0]
    if (!when.includes(left)) continue
    for (const m of people) {
      let msg: Message
      if (a.kind === 'birthday' && a.sourceId === m.id) {
        // 내 생일은 미리 알리지 않고(깜짝 준비는 상대 몫), 당일에만 축하
        if (left !== 0) continue
        msg = { title: '🎂 생일 축하해요!', body: '오늘은 내 생일이에요 💕', tag: `anniv-${a.key}`, url: '/anniv' }
      } else if (left === 0) {
        msg = { title: `${a.emoji} 오늘은 ${a.title}${ieyo(a.title)}`, body: '축하해요! 💕', tag: `anniv-${a.key}`, url: '/anniv' }
      } else {
        msg = {
          title: `${a.emoji} ${a.title} D-${left}`,
          body: `${fmtDayKey(a.date)} · ${left === 1 ? '내일이에요' : `${left}일 남았어요`}`,
          tag: `anniv-${a.key}`,
          url: '/anniv',
        }
      }
      if ((await deliver(m.id, 'reminder', msg)) === 'sent') count++
    }
  }
  return count
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const c = await getConfig()
    if (!safeEqual(req.headers.get('x-cron-secret'), c.cron_secret)) return json({ error: 'unauthorized' }, 401)

    // 시험용: { couple_id } 를 주면 그 커플만 미리 알림 (밤사이 알림 보내기·정리는 건너뜀)
    const only = ((await req.json().catch(() => ({}))) as { couple_id?: string }).couple_id
    const overnight = only ? 0 : await flushDeferred()

    const today = seoulDateKey()
    let q = admin.from('couples').select('id, started_on, day_every, day_marks')
    if (only) q = q.eq('id', only)
    const { data: couples, error } = await q
    if (error) throw error
    let reminders = 0
    for (const couple of couples ?? []) {
      try {
        reminders += await remindCouple(couple, today)
      } catch (e) {
        console.error('미리 알림 실패', couple.id, e)
      }
    }

    // 오래된 알림함 정리
    if (!only) await admin.from('notifications').delete().lt('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString())

    console.log(`remind ${today}: 밤사이 ${overnight}명 · 미리 알림 ${reminders}건`)
    return json({ today, overnight, reminders })
  } catch (e) {
    console.error('remind 오류', e)
    return json({ error: (e as Error).message }, 500)
  }
})
