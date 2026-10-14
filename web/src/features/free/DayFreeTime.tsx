import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { fromKey, toTimeInput, todayKey, type DateKey } from '../../lib/dates'
import type { CalItem } from '../calendar/items'
import { blockMinutes, blocksPerson, busyIntervalOn, fmtDuration, fmtRange, subtract, type Block } from './freeTime'

// 하루 시간표에서 보여 줄 범위 (8시 ~ 24시)
const FROM_H = 8
const TO_H = 24
const MIN_FREE = 30 // 30분보다 짧은 틈은 빈 시간으로 치지 않는다
const MAX_SUGGEST = 120 // 빈 시간을 누르면 최대 2시간짜리 일정으로 연다

const pct = (t: number, start: number, end: number) => ((t - start) / (end - start)) * 100

// 날짜 창 안쪽: 나·상대가 바쁜 시간과 둘 다 비는 시간을 한 줄씩 그려서 한눈에
export function DayFreeTime({
  day,
  items,
  onPlan,
}: {
  day: DateKey
  items: CalItem[]
  // 빈 시간을 눌렀을 때 (튜토리얼은 실제 일정 화면 대신 연습 화면으로)
  onPlan?: (date: DateKey, start: string, minutes: number) => void
}) {
  const navigate = useNavigate()
  const { me, partner, couple } = useCoupleCtx()

  const data = useMemo(() => {
    const base = fromKey(day)
    const start = new Date(base).setHours(FROM_H, 0, 0, 0)
    const end = new Date(base).setHours(TO_H, 0, 0, 0)
    const people = partner ? [me, partner] : [me]
    const rows = people.map((p) => {
      const busy: [number, number, string][] = [] // 시작, 끝, 색(우리 일정은 우리 색)
      for (const item of items) {
        if (!blocksPerson(item, p.id)) continue
        const iv = busyIntervalOn(item, day)
        if (iv) busy.push([Math.max(iv[0], start), Math.min(iv[1], end), item.color])
      }
      return { person: p, busy: busy.filter(([s, e]) => e > s) }
    })
    // 오늘이면 지금(30분 단위 올림) 이후만 빈 시간으로
    const now = Date.now()
    const from = day === todayKey() ? Math.max(start, Math.ceil(now / 1_800_000) * 1_800_000) : start
    const free =
      from < end
        ? subtract({ start: new Date(from), end: new Date(end) }, rows.flatMap((r) => r.busy.map(([s, e]): [number, number] => [s, e]))).filter(
            (b) => blockMinutes(b) >= MIN_FREE,
          )
        : []
    // '우리' 일정은 바쁜 게 아니라 같이 보내는 시간 → 둘 다 줄에 따로 표시
    const together: { s: number; e: number; title: string; color: string }[] = []
    for (const item of items) {
      if (item.kind !== 'event' || item.ownerId !== null) continue
      const iv = busyIntervalOn(item, day)
      if (!iv) continue
      const s = Math.max(iv[0], start)
      const e = Math.min(iv[1], end)
      if (e > s) together.push({ s, e, title: item.title, color: item.color })
    }
    // 남은 시간이 전부 함께하는 시간인지
    const allTogether =
      together.length > 0 &&
      (from >= end || subtract({ start: new Date(from), end: new Date(end) }, together.map((t): [number, number] => [t.s, t.e])).length === 0)
    return { start, end, rows, free, together, allTogether, pastCut: from > start ? from : null }
  }, [day, items, me, partner])

  // 지난 날짜는 보여 주지 않는다
  if (day < todayKey()) return null

  const { start, end, rows, free, together, allTogether, pastCut } = data
  const hasWork = rows.some((r) => r.busy.some(([, , c]) => c === 'var(--color-busy)'))
  const togetherTitles = [...new Set(together.map((t) => t.title))].join(', ')
  const past = pastCut ? pct(pastCut, start, end) : 0
  const allDayBusy = free.length === 0

  function plan(b: Block) {
    const min = Math.min(blockMinutes(b), MAX_SUGGEST)
    if (onPlan) onPlan(day, toTimeInput(b.start), min)
    else navigate(`/event/new?date=${day}&start=${toTimeInput(b.start)}&min=${min}`)
  }

  return (
    <section data-tut="free-time" className="mb-4 rounded-3xl border-2 border-line bg-bg/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <h3 className="text-[15px]">{allTogether ? '함께하는 날 💞' : partner ? '둘 다 비는 시간' : '비는 시간'}</h3>
        {/* 색 설명 */}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-ink-soft">
          <Legend color={me.color} label="나" />
          {partner && <Legend color={partner.color} label={partner.nickname} />}
          <Legend color={couple.us_color} label="함께" />
          {hasWork && <Legend color="var(--color-busy)" label="회사" />}
          <Legend color="var(--color-free)" label="빈 시간" />
        </div>
      </div>

      {/* 시간표 */}
      <div className="flex flex-col gap-1.5">
        {rows.map(({ person, busy }) => (
          <TrackRow key={person.id} past={past} label={person.avatar} name={person.id === me.id ? '나' : person.nickname}>
            {busy.map(([s, e, color], i) => (
              <span
                key={i}
                className="absolute inset-y-0 rounded-full"
                style={{ left: `${pct(s, start, end)}%`, width: `${pct(e, start, end) - pct(s, start, end)}%`, backgroundColor: color }}
              />
            ))}
          </TrackRow>
        ))}
        <TrackRow label="💞" name="둘 다" highlight past={past}>
          {together.map((t, i) => {
            const w = pct(t.e, start, end) - pct(t.s, start, end)
            return (
              <span
                key={`t${i}`}
                className="absolute inset-y-0 flex items-center overflow-hidden rounded-full px-2 text-[10.5px] font-bold whitespace-nowrap"
                style={{ left: `${pct(t.s, start, end)}%`, width: `${w}%`, backgroundColor: t.color }}
              >
                {w > 18 && `함께 · ${t.title}`}
              </span>
            )
          })}
          {free.map((b) => (
            <button
              key={b.start.getTime()}
              type="button"
              onClick={() => plan(b)}
              aria-label={`${fmtRange(b)} 일정 만들기`}
              className="absolute inset-y-0 rounded-full bg-free active:scale-95"
              style={{
                left: `${pct(b.start.getTime(), start, end)}%`,
                width: `${pct(b.end.getTime(), start, end) - pct(b.start.getTime(), start, end)}%`,
              }}
            />
          ))}
        </TrackRow>
        <div className="relative ml-[4.25rem] h-4 text-[10px] text-ink-soft">
          {[8, 12, 16, 20, 24].map((h) => (
            <span
              key={h}
              className={`absolute whitespace-nowrap ${h === FROM_H ? '' : h === TO_H ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${((h - FROM_H) / (TO_H - FROM_H)) * 100}%` }}>
              {h}시
            </span>
          ))}
        </div>
      </div>

      {/* 빈 시간 목록 */}
      {allDayBusy ? (
        <p className="mt-2 px-1 text-sm text-ink-soft">
          {allTogether ? (
            <>
              하루 종일 함께해요 · <b className="text-ink">{togetherTitles}</b>
            </>
          ) : together.length > 0 ? (
            <>
              <b className="text-ink">{togetherTitles}</b> 말고는 같이 비는 시간이 없어요
            </>
          ) : (
            '이날은 같이 비는 시간이 없어요'
          )}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {free.map((b, i) => (
            <button
              key={b.start.getTime()}
              type="button"
              data-tut={i === 0 ? 'free-slot' : undefined}
              onClick={() => plan(b)}
              className="press-3d rounded-full border-2 border-free-deep/40 bg-surface px-3 py-1.5 text-left text-[13px] font-bold [--shade:var(--color-line)]"
            >
              {fmtRange(b)} <span className="font-normal text-ink-soft">· {fmtDuration(b)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function TrackRow({
  label,
  name,
  highlight,
  past,
  children,
}: {
  label: string
  name: string
  highlight?: boolean
  past: number // 오늘이면 지난 시간 비율(%)
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`flex w-16 shrink-0 items-center gap-1 truncate text-xs ${highlight ? 'font-bold' : 'text-ink-soft'}`}>
        <span className="text-sm">{label}</span>
        <span className="truncate">{name}</span>
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-line/50">
        {children}
        {/* 오늘의 지난 시간은 흐리게 */}
        {past > 0 && <span className="pointer-events-none absolute inset-y-0 left-0 bg-surface/70" style={{ width: `${past}%` }} />}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
