// Asia/Seoul(UTC+9, 서머타임 없음) 날짜·시각 표시. Edge 런타임은 UTC 라 직접 9시간을 더한다.

const KST_MS = 9 * 60 * 60 * 1000
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// UTC 기준 필드가 서울 벽시계 값이 되도록 옮긴 Date
export const toSeoulWall = (d: Date) => new Date(d.getTime() + KST_MS)

const pad = (n: number) => String(n).padStart(2, '0')

// 서울 기준 'yyyy-MM-dd'
export function seoulDateKey(d: Date = new Date()): string {
  const w = toSeoulWall(d)
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`
}

// 'yyyy-MM-dd' → '10월 5일 (일)'
export function fmtDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}월 ${d}일 (${WEEK[wd]})`
}

// ISO 시각 → '10월 5일 (일) 오후 7:00'
export function fmtDateTime(iso: string): string {
  const w = toSeoulWall(new Date(iso))
  const h = w.getUTCHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${fmtDayKey(seoulDateKey(new Date(iso)))} ${ampm} ${h12}:${pad(w.getUTCMinutes())}`
}
