import KoreanLunarCalendar from 'korean-lunar-calendar'

// 지원 범위 1000~2050년.

// 음력 → 양력. 그 해에 해당 날짜가 없으면 null.
export function lunarToSolarExact(year: number, month: number, day: number, leap = false): Date | null {
  const cal = new KoreanLunarCalendar()
  if (!cal.setLunarDate(year, month, day, leap)) return null
  const s = cal.getSolarCalendar()
  return new Date(s.year, s.month - 1, s.day)
}

// 매년 챙기는 용도: 그 해에 그 날이 없으면(작은달 30일) 하루 당긴다. 윤달 기념일은 평달로 챙긴다.
export function lunarToSolar(year: number, month: number, day: number): Date | null {
  return lunarToSolarExact(year, month, day) ?? (day > 1 ? lunarToSolarExact(year, month, day - 1) : null)
}

// 양력 → 음력
export function solarToLunar(date: Date): { year: number; month: number; day: number; leap: boolean } | null {
  const cal = new KoreanLunarCalendar()
  if (!cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())) return null
  const l = cal.getLunarCalendar()
  return { year: l.year, month: l.month, day: l.day, leap: !!l.intercalation }
}
