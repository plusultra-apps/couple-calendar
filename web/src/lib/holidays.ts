import { addDays } from 'date-fns'
import { fromKey, toKey, type DateKey } from './dates'
import { lunarToSolar } from './lunar'

// 대한민국 공휴일 계산 (관공서의 공휴일에 관한 규정 기준, 2023 개정 대체공휴일 반영)
// - 양력 고정 공휴일 + 음력 공휴일(설날·부처님오신날·추석) + 선거일
// - 대체공휴일:
//   · 설날·추석 연휴: 일요일 또는 다른 공휴일과 겹치면 연휴 다음 첫 평일
//   · 삼일절·어린이날·광복절·개천절·한글날·부처님오신날·성탄절: 토·일 또는 다른 공휴일과 겹치면 다음 첫 평일
//   · 신정·현충일: 대체 없음
// 임시공휴일은 정부 발표 때마다 EXTRA 에 추가한다.

type Base = { date: DateKey; name: string; sub: 'none' | 'weekend' }

const FIXED: [string, string, Base['sub']][] = [
  ['01-01', '신정', 'none'],
  ['03-01', '삼일절', 'weekend'],
  ['05-05', '어린이날', 'weekend'],
  ['06-06', '현충일', 'none'],
  ['08-15', '광복절', 'weekend'],
  ['10-03', '개천절', 'weekend'],
  ['10-09', '한글날', 'weekend'],
  ['12-25', '성탄절', 'weekend'],
]

// 선거일·임시공휴일
const EXTRA: Record<DateKey, string> = {
  '2025-06-03': '대통령선거',
  '2026-06-03': '지방선거',
  '2028-04-12': '국회의원선거',
}

const cache = new Map<number, Map<DateKey, string[]>>()

export function holidaysOfYear(year: number): Map<DateKey, string[]> {
  const hit = cache.get(year)
  if (hit) return hit

  const map = new Map<DateKey, string[]>()
  const add = (date: DateKey, name: string) => map.set(date, [...(map.get(date) ?? []), name])

  const bases: Base[] = FIXED.map(([md, name, sub]) => ({ date: `${year}-${md}`, name, sub }))
  const buddha = lunarToSolar(year, 4, 8)
  if (buddha) bases.push({ date: toKey(buddha), name: '부처님오신날', sub: 'weekend' })
  for (const b of bases) add(b.date, b.name)

  // 설날·추석 연휴(3일)
  const periods: { name: string; days: DateKey[] }[] = []
  const seol = lunarToSolar(year, 1, 1)
  if (seol) periods.push({ name: '설날', days: [-1, 0, 1].map((n) => toKey(addDays(seol, n))) })
  const chuseok = lunarToSolar(year, 8, 15)
  if (chuseok) periods.push({ name: '추석', days: [-1, 0, 1].map((n) => toKey(addDays(chuseok, n))) })
  for (const p of periods) for (const d of p.days) add(d, p.name)

  for (const [date, name] of Object.entries(EXTRA)) if (date.startsWith(`${year}-`)) add(date, name)

  // 대체공휴일: 다음 첫 평일(공휴일 아님)
  const nextFree = (from: DateKey) => {
    let d = addDays(fromKey(from), 1)
    while (d.getDay() === 0 || d.getDay() === 6 || map.has(toKey(d))) d = addDays(d, 1)
    return toKey(d)
  }

  for (const p of periods) {
    const hasSunday = p.days.some((d) => fromKey(d).getDay() === 0)
    const overlaps = p.days.some((d) => (map.get(d) ?? []).some((n) => n !== p.name))
    if (hasSunday || overlaps) add(nextFree(p.days[2]), '대체공휴일')
  }

  // 같은 날 여러 공휴일이 겹치면 대체공휴일은 (겹친 수 - 평일이면 1)개
  const subDates = [...new Set(bases.filter((b) => b.sub === 'weekend').map((b) => b.date))].sort()
  for (const date of subDates) {
    const dow = fromKey(date).getDay()
    const names = map.get(date) ?? []
    const eligible = bases.filter((b) => b.date === date && b.sub === 'weekend').length
    const weekend = dow === 0 || dow === 6
    const needed = weekend ? eligible : Math.min(eligible, names.length - 1)
    let cursor = date
    for (let i = 0; i < needed; i++) {
      cursor = nextFree(cursor)
      add(cursor, '대체공휴일')
    }
  }

  cache.set(year, map)
  return map
}

export function holidayNames(key: DateKey): string[] {
  return holidaysOfYear(Number(key.slice(0, 4))).get(key) ?? []
}

export const isHoliday = (key: DateKey) => holidayNames(key).length > 0
