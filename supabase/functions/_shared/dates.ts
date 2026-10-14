import { addDays, format, parseISO } from 'npm:date-fns@4'

// web/src/lib/dates.ts 중 기념일 계산에 필요한 부분만 복사.
// ⚠ web/src/lib/dates.ts 와 같은 로직. 바꾸면 함께 바꿀 것.
// Edge 런타임의 로컬 시간대는 UTC 지만, 날짜 키끼리만 계산하므로 결과는 같다.

// 날짜 키: 'yyyy-MM-dd'
export type DateKey = string

export const toKey = (d: Date): DateKey => format(d, 'yyyy-MM-dd')

// 'yyyy-MM-dd' → 로컬 자정
export const fromKey = (k: DateKey): Date => parseISO(k)

export const addDaysKey = (k: DateKey, n: number) => toKey(addDays(fromKey(k), n))
