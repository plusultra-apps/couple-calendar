import { addDays, addYears, differenceInCalendarDays } from 'npm:date-fns@4'
import { fromKey, toKey, type DateKey } from './dates.ts'
import { lunarToSolar, solarToLunar } from './lunar.ts'

// 기념일 자동 계산. 행을 저장하지 않고 필요한 기간만 계산한다.
// ⚠ web/src/lib/anniversary.ts 의 복사본(같은 로직). 바꾸면 함께 바꿀 것.

export type AnnivKind = 'days' | 'years' | 'birthday' | 'custom'

export type AnnivItem = {
  key: string
  date: DateKey
  title: string
  emoji: string
  kind: AnnivKind
  sourceId?: string // 사용자 정의 기념일 id
}

// N일째 챙기는 방식: 주기(100일마다 / 1000일마다 / 안 챙김=null) + 특별한 날(예: 22일, 50일)
export type DayRule = { every: number | null; marks: number[] }

export type AnnivInput = {
  startedOn: DateKey | null
  coupleDays?: DayRule // 사귄 날 기준 (없으면 100일마다)
  members: { id: string; nickname: string; birthday: string | null; birthday_is_lunar: boolean }[]
  customs: {
    id: string
    title: string
    base_date: string
    is_lunar: boolean
    kind: string
    emoji: string
    day_every?: number | null
    day_marks?: number[] | null
    count_days?: boolean // 예전 옵션: 켜져 있으면 100일마다
  }[]
}

// 특별한 날 이름 (커플 사이에서 흔히 부르는 이름)
const DAY_NAMES: Record<number, string> = { 22: '22일 (투투)' }
export const dayLabel = (n: number) => DAY_NAMES[n] ?? `${n.toLocaleString()}일`

// 고를 수 있는 특별한 날
export const DAY_MARK_PRESETS = [22, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000]

// base 를 1일째로 셀 때, 기간 안에 드는 'N일째' 날들 (주기 + 특별한 날)
export function dayMilestones(base: DateKey, rule: DayRule, from: DateKey, to: DateKey): { n: number; date: DateKey }[] {
  const nFrom = Math.max(1, differenceInCalendarDays(fromKey(from), fromKey(base)) + 1)
  const nTo = differenceInCalendarDays(fromKey(to), fromKey(base)) + 1
  if (nTo < 1) return []
  const ns = new Set<number>()
  if (rule.every) {
    for (let n = Math.ceil(nFrom / rule.every) * rule.every; n <= nTo; n += rule.every) ns.add(n)
  }
  for (const n of rule.marks) if (n >= nFrom && n <= nTo) ns.add(n)
  return [...ns].sort((a, b) => a - b).map((n) => ({ n, date: dateOfDay(base, n) }))
}

// 이 날은 base 로부터 며칠째 (base = 1일째)
export const dayCountOn = (base: DateKey, date: DateKey) =>
  differenceInCalendarDays(fromKey(date), fromKey(base)) + 1

export const customDayRule = (c: AnnivInput['customs'][number]): DayRule => ({
  every: c.day_every ?? (c.count_days ? 100 : null),
  marks: c.day_marks ?? [],
})

// 사귄 날 = 1일째
export function daysTogether(startedOn: DateKey, today: Date = new Date()): number {
  return differenceInCalendarDays(today, fromKey(startedOn)) + 1
}

// N일째가 되는 날
export const dateOfDay = (startedOn: DateKey, n: number): DateKey => toKey(addDays(fromKey(startedOn), n - 1))

// 매년 반복 날짜를 기간 안에서 찾는다.
// base 는 항상 실제 양력 날짜. isLunar 면 그 날의 음력 월·일로 매년 계산한다.
function yearlyDates(base: DateKey, isLunar: boolean, from: DateKey, to: DateKey): { date: DateKey; years: number }[] {
  let [by, bm, bd] = base.split('-').map(Number)
  if (isLunar) {
    const l = solarToLunar(fromKey(base))
    if (!l) return []
    ;[by, bm, bd] = [l.year, l.month, l.day]
  }
  const out: { date: DateKey; years: number }[] = []
  const fromY = Number(from.slice(0, 4)) - 1
  const toY = Number(to.slice(0, 4))
  for (let y = Math.max(fromY, by); y <= toY; y++) {
    let date: DateKey | null
    if (isLunar) {
      const s = lunarToSolar(y, bm, bd)
      date = s ? toKey(s) : null
    } else {
      // 2월 29일은 평년엔 2월 28일
      const d = new Date(y, bm - 1, bd)
      date = d.getMonth() === bm - 1 ? toKey(d) : toKey(new Date(y, bm - 1, 28))
    }
    if (date && date >= from && date <= to) out.push({ date, years: y - by })
  }
  return out
}

export function anniversariesBetween(input: AnnivInput, from: DateKey, to: DateKey): AnnivItem[] {
  const items: AnnivItem[] = []

  if (input.startedOn) {
    const s = input.startedOn
    // N일째 (고른 방식대로)
    for (const { n, date } of dayMilestones(s, input.coupleDays ?? { every: 100, marks: [] }, from, to)) {
      items.push({ key: `days-${n}`, date, title: dayLabel(n), emoji: n % 1000 === 0 ? '🎊' : '💯', kind: 'days' })
    }
    // 주년
    for (let y = 1; ; y++) {
      const date = toKey(addYears(fromKey(s), y))
      if (date > to) break
      if (date >= from) items.push({ key: `years-${y}`, date, title: `${y}주년`, emoji: '💍', kind: 'years' })
    }
  }

  for (const m of input.members) {
    if (!m.birthday) continue
    for (const { date } of yearlyDates(m.birthday, m.birthday_is_lunar, from, to)) {
      items.push({ key: `bday-${m.id}-${date}`, date, title: `${m.nickname} 생일`, emoji: '🎂', kind: 'birthday', sourceId: m.id })
    }
  }

  for (const c of input.customs) {
    // N일째 (기준일 = 1일째, 고른 방식대로)
    for (const { n, date } of dayMilestones(c.base_date, customDayRule(c), from, to)) {
      items.push({
        key: `custom-${c.id}-d${n}`,
        date,
        title: `${c.title} ${dayLabel(n)}`,
        emoji: n % 1000 === 0 ? '🎊' : c.emoji,
        kind: 'custom',
        sourceId: c.id,
      })
    }
    if (c.kind === 'once') {
      if (c.base_date >= from && c.base_date <= to) {
        items.push({ key: `custom-${c.id}`, date: c.base_date, title: c.title, emoji: c.emoji, kind: 'custom', sourceId: c.id })
      }
      continue
    }
    for (const { date, years } of yearlyDates(c.base_date, c.is_lunar, from, to)) {
      const title = years > 0 ? `${c.title} (${years}주년)` : c.title
      items.push({ key: `custom-${c.id}-${date}`, date, title, emoji: c.emoji, kind: 'custom', sourceId: c.id })
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date))
}

// 오늘 이후 가장 가까운 기념일들
// years: 얼마나 먼 미래까지 볼지 (먼 미래의 결혼기념일 등도 잡히게 넉넉히)
export function upcomingAnniversaries(input: AnnivInput, limit = 10, today: Date = new Date(), years = 10): AnnivItem[] {
  const from = toKey(today)
  const to = toKey(addYears(today, years))
  return anniversariesBetween(input, from, to).slice(0, limit)
}

// D-day 표시: 오늘 = 'D-DAY', 미래 = 'D-3'
export function dday(date: DateKey, today: Date = new Date()): string {
  const n = differenceInCalendarDays(fromKey(date), today)
  if (n === 0) return 'D-DAY'
  return n > 0 ? `D-${n}` : `D+${-n}`
}
