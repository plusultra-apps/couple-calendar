// ICS 구독 피드 (PLAN.md 2-4, 6장)
// GET /functions/v1/feed?token=xxxx → 커플 일정 + 기념일을 iCalendar 로 반환
// verify_jwt = false (캘린더 앱은 토큰 쿼리만 보낸다. 토큰이 곧 인증)
import { admin } from '../_shared/admin.ts'
import { anniversariesBetween } from '../_shared/anniversary.ts'
import { addDaysKey } from '../_shared/dates.ts'
import { seoulDateKey } from '../_shared/seoul.ts'
import { escapeText, fold, icsDate, icsSeoul, icsUtc, VTIMEZONE_SEOUL } from './ics.ts'

type EventRow = {
  id: string
  owner_id: string | null
  title: string
  location: string | null
  memo: string | null
  all_day: boolean
  starts_at: string | null
  ends_at: string | null
  start_date: string | null
  end_date: string | null
  rrule: string | null
  exdates: string[] | null
  is_private: boolean
  created_at: string
  updated_at: string
  event_secrets: { user_id: string; title: string; location: string | null; memo: string | null } | null
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// events.rrule 의 UNTIL 은 앱에서 "서울 벽시계 시각"(floating)으로 해석한다(web/src/lib/recurrence.ts).
// iCalendar 규칙에 맞게 종일 일정은 DATE, 시간 일정은 UTC 로 바꾼다.
function rruleFor(rrule: string, allDay: boolean): string {
  return rrule.replace(/UNTIL=(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/, (_, y, mo, d, h = '00', mi = '00', s = '00') => {
    if (allDay) return `UNTIL=${y}${mo}${d}`
    const utc = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - 9 * 3600_000)
    return `UNTIL=${icsUtc(utc)}`
  })
}

function eventLines(e: EventRow, viewer: string, nick: (id: string | null) => string, stamp: string): string[] {
  const prefix = `[${nick(e.owner_id)}] `
  // 비공개 일정: 본인에게는 실제 내용, 상대에게는 '바쁨'만
  const mine = e.is_private && e.owner_id === viewer && e.event_secrets?.user_id === viewer
  const masked = e.is_private && !mine
  const title = masked ? '바쁨' : mine ? e.event_secrets!.title : e.title
  const location = masked ? null : mine ? e.event_secrets!.location : e.location
  const memo = masked ? null : mine ? e.event_secrets!.memo : e.memo

  const out = ['BEGIN:VEVENT', `UID:${e.id}@ourcal`, `DTSTAMP:${stamp}`]
  out.push(`LAST-MODIFIED:${icsUtc(new Date(e.updated_at))}`)
  if (e.all_day) {
    out.push(`DTSTART;VALUE=DATE:${icsDate(e.start_date!)}`)
    out.push(`DTEND;VALUE=DATE:${icsDate(addDaysKey(e.end_date!, 1))}`) // 종료일은 다음날(미포함)
  } else {
    // 반복 규칙이 서울 날짜 기준으로 전개되도록 TZID 로 쓴다 (UTC 로 쓰면 오전 9시 이전 일정의 '매월 N일'이 어긋남)
    out.push(`DTSTART;TZID=Asia/Seoul:${icsSeoul(new Date(e.starts_at!))}`)
    out.push(`DTEND;TZID=Asia/Seoul:${icsSeoul(new Date(e.ends_at!))}`)
  }
  if (e.rrule) {
    out.push(`RRULE:${rruleFor(e.rrule, e.all_day)}`)
    const ex = e.exdates ?? []
    if (ex.length) {
      if (e.all_day) out.push(`EXDATE;VALUE=DATE:${ex.map(icsDate).join(',')}`)
      else {
        // 그날의 발생 시작 시각 (서울 기준)
        const time = icsSeoul(new Date(e.starts_at!)).slice(8)
        out.push(`EXDATE;TZID=Asia/Seoul:${ex.map((k) => icsDate(k) + time).join(',')}`)
      }
    }
  }
  out.push(`SUMMARY:${escapeText(prefix + title)}`)
  if (location) out.push(`LOCATION:${escapeText(location)}`)
  if (memo) out.push(`DESCRIPTION:${escapeText(memo)}`)
  if (masked) out.push('CLASS:PRIVATE')
  out.push('END:VEVENT')
  return out
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return text('method not allowed', 405)
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{16,128}$/.test(token)) return text('not found', 404)

  try {
    const { data: ft } = await admin.from('feed_tokens').select('user_id').eq('token', token).maybeSingle()
    if (!ft) return text('not found', 404)
    const viewer = ft.user_id as string

    const { data: me } = await admin.from('profiles').select('couple_id').eq('id', viewer).maybeSingle()
    if (!me?.couple_id) return text('not found', 404)
    const coupleId = me.couple_id as string

    const [couple, members, events, customs] = await Promise.all([
      admin.from('couples').select('started_on, day_every, day_marks').eq('id', coupleId).single(),
      admin.from('profiles').select('id, nickname, birthday, birthday_is_lunar').eq('couple_id', coupleId),
      // 상대의 '나만 보기' 일정은 빼고 (service role 은 RLS 를 거치지 않으므로 직접 거른다)
      admin
        .from('events')
        .select('*, event_secrets(user_id, title, location, memo)')
        .eq('couple_id', coupleId)
        .or(`hidden.eq.false,owner_id.eq.${viewer}`),
      admin
        .from('anniversaries')
        .select('id, title, base_date, is_lunar, kind, emoji, count_days, day_every, day_marks')
        .eq('couple_id', coupleId),
    ])
    for (const r of [couple, members, events, customs]) if (r.error) throw r.error

    const memberRows = members.data ?? []
    const nick = (id: string | null) =>
      id ? (memberRows.find((m) => m.id === id)?.nickname || '알 수 없음') : '우리'
    const stamp = icsUtc(new Date())

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ourcal//러브로그//KO',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:러브로그',
      'X-WR-TIMEZONE:Asia/Seoul',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      ...VTIMEZONE_SEOUL,
    ]

    for (const e of (events.data ?? []) as EventRow[]) lines.push(...eventLines(e, viewer, nick, stamp))

    // 자동 기념일(100일·주년·생일) + 사용자 정의 기념일: 작년 ~ 2년 뒤
    const today = seoulDateKey()
    const annivs = anniversariesBetween(
      {
        startedOn: couple.data!.started_on,
        coupleDays: { every: couple.data!.day_every, marks: couple.data!.day_marks ?? [] },
        members: memberRows,
        customs: customs.data ?? [],
      },
      addDaysKey(today, -365),
      addDaysKey(today, 365 * 2),
    )
    for (const a of annivs) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:anniv-${coupleId}-${a.key}@ourcal`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(a.date)}`,
        `DTEND;VALUE=DATE:${icsDate(addDaysKey(a.date, 1))}`,
        `SUMMARY:${escapeText(`${a.emoji} ${a.title}`)}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      )
    }

    lines.push('END:VCALENDAR')
    const body = lines.map(fold).join('\r\n') + '\r\n'
    return new Response(req.method === 'HEAD' ? null : body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="ourcal.ics"',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    console.error('feed 오류', e)
    return text('server error', 500)
  }
})
