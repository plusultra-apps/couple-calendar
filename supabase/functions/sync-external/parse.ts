// 외부 캘린더(ICS) → 바쁜 시간 목록. 제목·장소 등 내용은 버리고 시간만 남긴다.
import ICAL from 'npm:ical.js@2'

type Time = InstanceType<typeof ICAL.Time>
type Component = InstanceType<typeof ICAL.Component>
type ICalEvent = InstanceType<typeof ICAL.Event>

export type Busy = {
  all_day: boolean
  starts_at: string | null
  ends_at: string | null
  start_date: string | null
  end_date: string | null // 종료일 포함
}

const KST_MS = 9 * 3600_000
const MAX_ITER = 20_000 // 반복 일정 하나당 최대 전개 횟수 (오래된 매일 반복 대비)
const MAX_ROWS = 5_000

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (t: Time) => `${t.year}-${pad(t.month)}-${pad(t.day)}`
const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// 서울 표준시. ICS 에 VTIMEZONE 이 없을 때를 대비해 등록해 둔다.
const SEOUL_VTZ = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Seoul',
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0900',
  'TZOFFSETTO:+0900',
  'TZNAME:KST',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n')

// 시각 → Date. 시간대를 알 수 없는(floating 또는 미등록 TZID) 시각은 서울 시각으로 본다.
function toDate(t: Time): Date {
  const tzid = t.zone?.tzid
  if (!tzid || tzid === 'floating') {
    return new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - KST_MS)
  }
  return new Date(t.toUnixTime() * 1000)
}

// 숨길 일정: 취소됨, 또는 '한가함'으로 표시된 시간 일정
// (구글은 종일 일정을 기본값 '한가함'으로 내보내므로 종일 일정은 TRANSP 와 관계없이 바쁨으로 본다)
function skip(c: Component, allDay: boolean): boolean {
  const status = String(c.getFirstPropertyValue('status') ?? '').toUpperCase()
  if (status === 'CANCELLED') return true
  const transp = String(c.getFirstPropertyValue('transp') ?? '').toUpperCase()
  return !allDay && transp === 'TRANSPARENT'
}

// window: 서울 날짜 키 [fromKey, toKey] (포함)
export function parseBusy(text: string, fromKey: string, toKey: string): Busy[] {
  const root = new ICAL.Component(ICAL.parse(text))
  if (!ICAL.TimezoneService.has('Asia/Seoul')) {
    ICAL.TimezoneService.register(new ICAL.Component(ICAL.parse(SEOUL_VTZ)))
  }
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz)
    } catch {
      // 깨진 VTIMEZONE 은 무시 (서울 시각으로 처리됨)
    }
  }

  const windowStart = new Date(Date.parse(`${fromKey}T00:00:00Z`) - KST_MS)
  const windowEnd = new Date(Date.parse(`${addDaysKey(toKey, 1)}T00:00:00Z`) - KST_MS)
  const out: Busy[] = []

  const push = (start: Time, end: Time | null, comp: Component) => {
    const allDay = start.isDate
    if (skip(comp, allDay)) return
    if (allDay) {
      const s = keyOf(start)
      // DTEND 는 미포함이므로 하루 뺀다
      const e = end && end.compare(start) > 0 ? addDaysKey(keyOf(end), -1) : s
      if (e < fromKey || s > toKey) return
      out.push({ all_day: true, starts_at: null, ends_at: null, start_date: s, end_date: e < s ? s : e })
    } else {
      const s = toDate(start)
      let e = end ? toDate(end) : s
      if (e < s) e = s
      if (e < windowStart || s >= windowEnd) return
      out.push({ all_day: false, starts_at: s.toISOString(), ends_at: e.toISOString(), start_date: null, end_date: null })
    }
  }

  // UID 별로 원본과 예외(RECURRENCE-ID)를 묶는다
  const masters = new Map<string, Component>()
  const exceptions: Component[] = []
  for (const v of root.getAllSubcomponents('vevent')) {
    if (v.hasProperty('recurrence-id')) exceptions.push(v)
    else masters.set(String(v.getFirstPropertyValue('uid') ?? crypto.randomUUID()), v)
  }

  const events = new Map<string, ICalEvent>()
  for (const [uid, comp] of masters) events.set(uid, new ICAL.Event(comp))
  for (const exc of exceptions) {
    const master = events.get(String(exc.getFirstPropertyValue('uid')))
    if (master?.isRecurring()) {
      try {
        master.relateException(exc)
        continue
      } catch {
        // 연결할 수 없으면 단독 일정으로 처리
      }
    }
    const e = new ICAL.Event(exc)
    if (e.startDate) push(e.startDate, e.endDate, exc)
  }

  for (const ev of events.values()) {
    if (out.length >= MAX_ROWS) break
    if (!ev.startDate) continue
    if (!ev.isRecurring()) {
      push(ev.startDate, ev.endDate, ev.component)
      continue
    }
    // 반복 전개 (EXDATE 는 iterator 가, RECURRENCE-ID 예외는 getOccurrenceDetails 가 처리)
    const it = ev.iterator()
    for (let i = 0, next = it.next(); next && i < MAX_ITER; i++, next = it.next()) {
      const occ = ev.getOccurrenceDetails(next)
      if (next.isDate ? keyOf(next) > toKey : toDate(next) >= windowEnd) break
      push(occ.startDate, occ.endDate, occ.item.component)
    }
  }

  return out.slice(0, MAX_ROWS)
}
