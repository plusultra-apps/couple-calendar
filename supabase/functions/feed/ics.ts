// iCalendar(RFC 5545) 작성 도우미

// TEXT 값 이스케이프: \ ; , 줄바꿈
export const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// 한 줄을 75 옥텟 단위로 접는다 (UTF-8 글자를 중간에서 자르지 않는다)
export function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let curLen = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    // 이어지는 줄은 앞에 공백 1옥텟이 붙으므로 74 옥텟까지
    const limit = parts.length === 0 ? 75 : 74
    if (curLen + n > limit) {
      parts.push(cur)
      cur = ''
      curLen = 0
    }
    cur += ch
    curLen += n
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

// 'yyyy-MM-dd' → 'yyyyMMdd'
export const icsDate = (key: string) => key.replaceAll('-', '')

// Date → 'yyyyMMddTHHmmssZ' (UTC)
export const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// 서울 벽시계 시각 'yyyyMMddTHHmmss' (TZID=Asia/Seoul 용)
export function icsSeoul(d: Date): string {
  return icsUtc(new Date(d.getTime() + 9 * 3600_000)).slice(0, 15)
}

// 서울 표준시 (서머타임 없음)
export const VTIMEZONE_SEOUL = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Seoul',
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0900',
  'TZOFFSETTO:+0900',
  'TZNAME:KST',
  'END:STANDARD',
  'END:VTIMEZONE',
]
