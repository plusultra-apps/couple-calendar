import { RRule } from 'rrule'
import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { endKeyOf, fromKey, toKey, type DateKey } from './dates'

// events.rrule 은 DTSTART 없는 RRULE 본문만 저장한다. (예: FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959Z)
// rrule 라이브러리는 UTC 로 계산하므로, 로컬 시각을 "같은 숫자의 UTC" 로 바꿔 계산한 뒤 되돌린다(floating time).

export type RepeatPreset = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export const REPEAT_LABELS: Record<RepeatPreset, string> = {
  none: '반복 안 함',
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  yearly: '매년',
}

const PRESET_RULE: Record<Exclude<RepeatPreset, 'none'>, string> = {
  daily: 'FREQ=DAILY;INTERVAL=1',
  weekly: 'FREQ=WEEKLY;INTERVAL=1',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY;INTERVAL=1',
  yearly: 'FREQ=YEARLY;INTERVAL=1',
}

// startKey: 시작일. 29~31일 매월 반복은 짧은 달에 말일로, 2/29 매년 반복은 평년에 2/28 로 오게 한다.
// (RFC 5545 기본은 그 날이 없는 달을 건너뛰지만 커플 일정에선 기대와 다르다)
export function buildRRule(preset: RepeatPreset, until?: DateKey | null, startKey?: DateKey): string | null {
  if (preset === 'none') return null
  let rule = PRESET_RULE[preset]
  if (startKey) {
    const month = Number(startKey.slice(5, 7))
    const day = Number(startKey.slice(8, 10))
    const upTo = (from: number) => Array.from({ length: day - from + 1 }, (_, i) => from + i).join(',')
    if (preset === 'monthly' && day > 28) rule += `;BYMONTHDAY=${upTo(28)};BYSETPOS=-1`
    if (preset === 'yearly' && month === 2 && day === 29) rule += ';BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1'
  }
  return until ? `${rule};UNTIL=${until.replaceAll('-', '')}T235959Z` : rule
}

// UNTIL 을 뺀 규칙 본문 (반복 방식이 바뀌었는지 비교용)
export const ruleBody = (rrule: string | null) => rrule?.replace(/;?UNTIL=[^;]*/, '') ?? null

export function parseRRule(rrule: string | null): { preset: RepeatPreset; until: DateKey | null } {
  if (!rrule) return { preset: 'none', until: null }
  const preset =
    (Object.entries(PRESET_RULE).find(([, r]) => rrule.startsWith(r))?.[0] as RepeatPreset | undefined) ?? 'weekly'
  const m = rrule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/)
  return { preset, until: m ? `${m[1]}-${m[2]}-${m[3]}` : null }
}

export function describeRRule(rrule: string | null): string {
  if (!rrule) return ''
  const { preset, until } = parseRRule(rrule)
  const label = REPEAT_LABELS[preset]
  return until ? `${label} 반복 · ${until.replaceAll('-', '.')}까지` : `${label} 반복`
}

const toFloating = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()))
const fromFloating = (d: Date) =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())

// 일정 시간 정보 (events / external_busy 공통)
export type TimeSpec = {
  all_day: boolean
  starts_at: string | null
  ends_at: string | null
  start_date: string | null
  end_date: string | null
  rrule?: string | null
  exdates?: string[] | null
}

export type Span = {
  start: Date // 시간 일정: 실제 시작, 종일: 시작일 0시
  end: Date // 시간 일정: 실제 종료, 종일: 종료일 0시 (포함)
  startKey: DateKey
  endKey: DateKey // 포함
}

function baseSpan(t: TimeSpec): Span {
  if (t.all_day) {
    const start = fromKey(t.start_date!)
    const end = fromKey(t.end_date!)
    return { start, end, startKey: t.start_date!, endKey: t.end_date! }
  }
  const start = new Date(t.starts_at!)
  const end = new Date(t.ends_at!)
  return { start, end, startKey: toKey(start), endKey: endKeyOf(start, end) }
}

function shift(base: Span, newStart: Date, allDay: boolean): Span {
  if (allDay) {
    const len = differenceInCalendarDays(base.end, base.start)
    const end = addDays(newStart, len)
    return { start: newStart, end, startKey: toKey(newStart), endKey: toKey(end) }
  }
  const end = new Date(newStart.getTime() + (base.end.getTime() - base.start.getTime()))
  return { start: newStart, end, startKey: toKey(newStart), endKey: endKeyOf(newStart, end) }
}

// [fromKey, toKey] 기간(포함)에 걸치는 발생 목록
export function expand(t: TimeSpec, from: DateKey, to: DateKey): Span[] {
  const base = baseSpan(t)
  if (!t.rrule) return base.endKey >= from && base.startKey <= to ? [base] : []

  const lenDays = differenceInCalendarDays(fromKey(base.endKey), fromKey(base.startKey))
  const options = RRule.parseString(t.rrule)
  const rule = new RRule({ ...options, dtstart: toFloating(base.start) })
  const windowStart = toFloating(addDays(fromKey(from), -lenDays))
  const windowEnd = toFloating(addDays(fromKey(to), 1))
  const exdates = new Set(t.exdates ?? [])

  return rule
    .between(windowStart, windowEnd, true)
    .map((d) => shift(base, fromFloating(d), t.all_day))
    .filter((s) => !exdates.has(s.startKey) && s.endKey >= from && s.startKey <= to)
}

// 반복 종료일을 특정 날짜 전날로 자르기 ("이후 일정 삭제"용)
export function truncateRRule(rrule: string, beforeKey: DateKey): string {
  const until = format(addDays(fromKey(beforeKey), -1), 'yyyyMMdd')
  const body = rrule.replace(/;?UNTIL=[^;]*/, '').replace(/;?COUNT=[^;]*/, '')
  return `${body};UNTIL=${until}T235959Z`
}
