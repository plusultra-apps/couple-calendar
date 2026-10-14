// 둘 다 비는 시간 계산 (순수 함수). 화면은 FreeTimePage.tsx
import { addDays } from 'date-fns'
import { eachKey, fromKey, type DateKey } from '../../lib/dates'
import { isHoliday } from '../../lib/holidays'

// 계산에 필요한 항목 정보 (features/calendar/items.ts 의 CalItem 과 호환)
export type BusySource = {
  kind: 'event' | 'anniv' | 'busy'
  allDay: boolean
  start: Date
  end: Date
  startKey: DateKey
  endKey: DateKey // 포함
  ownerId: string | null
}

export type FreeMode = 'evening' | 'allday'

export type Block = { start: Date; end: Date }

export type FreeDay = {
  key: DateKey
  offDay: boolean // 주말·공휴일
  window: Block | null // 찾아본 시간대 (지난 시간이면 null)
  fullWindow: boolean // 오늘이라 앞부분이 잘리지 않았는지
  blocks: Block[] // 최소 길이 이상의 공통 빈 시간, 긴 순
}

const MIN = 60_000
export const DEFAULT_MIN_MINUTES = 120

const at = (key: DateKey, hour: number) => {
  const d = fromKey(key)
  d.setHours(hour, 0, 0, 0)
  return d
}

export function isOffDay(key: DateKey) {
  const dow = fromKey(key).getDay()
  return dow === 0 || dow === 6 || isHoliday(key)
}

// 그날 찾아볼 시간대. 저녁 모드: 평일 18–22시, 주말·공휴일 10–22시 / 하루 종일 모드: 10–22시
// 오늘이면 지금 이후(30분 단위 올림)부터.
export function windowOf(key: DateKey, mode: FreeMode, now: Date): { window: Block | null; full: boolean } {
  const startHour = mode === 'evening' && !isOffDay(key) ? 18 : 10
  let start = at(key, startHour)
  const end = at(key, 22)
  let full = true
  if (now.getTime() > start.getTime()) {
    const t = Math.ceil(now.getTime() / (30 * MIN)) * 30 * MIN
    start = new Date(t)
    full = false
  }
  if (end.getTime() - start.getTime() <= 0) return { window: null, full: false }
  return { window: { start, end }, full }
}

// 이 항목이 그 사람을 바쁘게 하는지
// - 일정: 본인 소유 또는 '우리'(ownerId null) → 바쁨
// - 회사 일정(busy): 해당 사람만
// - 기념일: 바쁘지 않음
export function blocksPerson(item: BusySource, personId: string): boolean {
  if (item.kind === 'anniv') return false
  if (item.kind === 'busy') return item.ownerId === personId
  return item.ownerId === null || item.ownerId === personId
}

// 그날 [dayStart, nextDayStart) 안에서 항목이 차지하는 구간
export function busyIntervalOn(item: BusySource, key: DateKey): [number, number] | null {
  if (item.startKey > key || item.endKey < key) return null
  const dayStart = fromKey(key).getTime()
  const dayEnd = addDays(fromKey(key), 1).getTime()
  if (item.allDay) return [dayStart, dayEnd]
  const s = Math.max(item.start.getTime(), dayStart)
  const e = Math.min(item.end.getTime(), dayEnd)
  // 0분 일정(시작=종료)은 막지 않는다
  return e > s ? [s, e] : null
}

// 창에서 바쁜 구간을 뺀 빈 구간들 (시간 순)
export function subtract(window: Block, busy: [number, number][]): Block[] {
  const sorted = [...busy].sort((a, b) => a[0] - b[0])
  const out: Block[] = []
  let cursor = window.start.getTime()
  const end = window.end.getTime()
  for (const [s, e] of sorted) {
    if (e <= cursor) continue
    if (s >= end) break
    if (s > cursor) out.push({ start: new Date(cursor), end: new Date(Math.min(s, end)) })
    cursor = Math.max(cursor, e)
    if (cursor >= end) break
  }
  if (cursor < end) out.push({ start: new Date(cursor), end: new Date(end) })
  return out
}

export const blockMinutes = (b: Block) => Math.round((b.end.getTime() - b.start.getTime()) / MIN)

export function computeFreeDays({
  items,
  from,
  to,
  people,
  mode,
  now,
  minMinutes = DEFAULT_MIN_MINUTES,
}: {
  items: BusySource[]
  from: DateKey
  to: DateKey
  people: string[] // 보통 [나, 상대]
  mode: FreeMode
  now: Date
  minMinutes?: number
}): FreeDay[] {
  const relevant = items.filter((i) => people.some((p) => blocksPerson(i, p)))
  const out: FreeDay[] = []
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  for (const key of eachKey(from, to)) {
    if (fromKey(key).getTime() < todayStart.getTime()) continue // 지난 날짜 제외
    const { window, full } = windowOf(key, mode, now)
    const day: FreeDay = { key, offDay: isOffDay(key), window, fullWindow: full, blocks: [] }
    if (window) {
      const busy: [number, number][] = []
      for (const item of relevant) {
        const iv = busyIntervalOn(item, key)
        if (iv) busy.push(iv)
      }
      day.blocks = subtract(window, busy)
        .filter((b) => blockMinutes(b) >= minMinutes)
        .sort((a, b) => blockMinutes(b) - blockMinutes(a) || a.start.getTime() - b.start.getTime())
    }
    out.push(day)
  }
  return out
}

// ── 문구 ──────────────────────────────────────

// 시각을 '오전 10시', '오후 2시 30분', '저녁 7시', '밤 10시' 처럼
function period(h: number) {
  if (h < 6) return '새벽'
  if (h < 12) return '오전'
  if (h === 12) return '낮'
  if (h < 18) return '오후'
  if (h < 21) return '저녁'
  return '밤'
}

function clock(d: Date, withPeriod = true): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  const text = `${h12}시${m ? ` ${m}분` : ''}`
  // 끝나는 시각 자정은 '새벽 12시'보다 '밤 12시'가 자연스럽다
  if (h === 0 && m === 0) return withPeriod ? '밤 12시' : text
  return withPeriod ? `${period(h)} ${text}` : text
}

export function fmtClock(d: Date) {
  return clock(d)
}

// '오후 2시–6시', '오후 3시–저녁 7시'
export function fmtRange(b: Block): string {
  const endPeriod = b.end.getHours() === 0 && b.end.getMinutes() === 0 ? '밤' : period(b.end.getHours())
  const samePeriod = period(b.start.getHours()) === endPeriod
  return `${clock(b.start)}–${clock(b.end, !samePeriod)}`
}

export function fmtDuration(b: Block): string {
  const min = blockMinutes(b)
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

// 대표 문구: '하루 종일 비어요' / '저녁 내내 비어요' / '저녁 7시부터 비어요' / '오후 2시–6시 비어요'
export function describeBlock(b: Block, day: FreeDay): string {
  const w = day.window
  if (w) {
    const startsAtWindow = b.start.getTime() === w.start.getTime()
    const endsAtWindow = b.end.getTime() === w.end.getTime()
    if (startsAtWindow && endsAtWindow) {
      if (day.fullWindow) return w.start.getHours() >= 18 ? '저녁 내내 비어요' : '하루 종일 비어요'
      return `${clock(b.start)}부터 쭉 비어요`
    }
    if (endsAtWindow) return `${clock(b.start)}부터 비어요`
  }
  return `${fmtRange(b)} 비어요`
}
