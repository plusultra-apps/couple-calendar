import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'

// 날짜 키: 'yyyy-MM-dd' (로컬 = Asia/Seoul 기준)
export type DateKey = string

export const toKey = (d: Date): DateKey => format(d, 'yyyy-MM-dd')

// 'yyyy-MM-dd' → 로컬 자정
export const fromKey = (k: DateKey): Date => parseISO(k)

export const todayKey = () => toKey(new Date())

export const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: ko })

// 24시간제: 정각이면 '15시', 분이 있으면 '15:30'
export const fmtTime = (d: Date) => {
  const h = d.getHours()
  const m = d.getMinutes()
  return m === 0 ? `${h}시` : `${h}:${String(m).padStart(2, '0')}`
}

// 10월 2일 (목)
export const fmtDay = (d: Date) => fmt(d, 'M월 d일 (EEE)')

export const addDaysKey = (k: DateKey, n: number) => toKey(addDays(fromKey(k), n))

export const diffDays = (a: DateKey, b: DateKey) => differenceInCalendarDays(fromKey(a), fromKey(b))

// 월간 달력 6주(42칸), 일요일 시작
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

// 두 키 사이(포함)의 모든 날짜 키
export function eachKey(start: DateKey, end: DateKey): DateKey[] {
  const n = diffDays(end, start)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addDaysKey(start, i))
}

// 시간 일정의 종료일 키: 다음날 0시에 끝나면 전날로 본다
export function endKeyOf(start: Date, end: Date): DateKey {
  if (end.getTime() <= start.getTime()) return toKey(start)
  return toKey(new Date(end.getTime() - 1))
}

// <input type="date"> / <input type="time"> 값 변환
export const toTimeInput = (d: Date) => format(d, 'HH:mm')
export function combine(dateKey: DateKey, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = fromKey(dateKey)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}
