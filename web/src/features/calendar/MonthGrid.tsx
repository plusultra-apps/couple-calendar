import { isSameMonth } from 'date-fns'
import { EyeOff, Lock } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { US_AVATAR } from '../../app/couple'
import { toKey, todayKey, type DateKey } from '../../lib/dates'
import { holidayNames } from '../../lib/holidays'
import { compareItems, type CalItem } from './items'

const HEAD_H = 25 // 날짜 숫자 영역
const LANE_H = 18 // 일정 막대 한 줄
const MORE_H = 16 // 못 그린 일정 '+N' 한 줄
const MIN_PHOTO_H = 36 // 사진 보기에서 사진에 남겨 둘 최소 높이

// 사진 보기에서 칸을 채우는 그림. url(실제 사진) 또는 background+emoji(튜토리얼 연습용 그림). count = 그날 사진 수
export type DayPhoto = { url?: string; background?: string; emoji?: string; count?: number }

type Seg ={ item: CalItem; s: number; e: number; lane: number; contL: boolean; contR: boolean }

// 한 주(7일)에 걸치는 항목을 줄(lane)에 배치한다
function layoutWeek(keys: DateKey[], items: CalItem[]): Seg[] {
  const wStart = keys[0]
  const wEnd = keys[6]
  const segs = items
    .filter((i) => i.endKey >= wStart && i.startKey <= wEnd)
    .map((item) => ({
      item,
      s: item.startKey < wStart ? 0 : keys.indexOf(item.startKey),
      e: item.endKey > wEnd ? 6 : keys.indexOf(item.endKey),
      lane: 0,
      contL: item.startKey < wStart,
      contR: item.endKey > wEnd,
    }))
    .sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s) || compareItems(a.item, b.item))

  const laneEnds: number[] = []
  for (const seg of segs) {
    let lane = laneEnds.findIndex((end) => end < seg.s)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = seg.e
    seg.lane = lane
  }
  return segs
}

export function MonthGrid({
  month,
  days,
  items,
  selected,
  onSelect,
  photos,
  photoMode = false,
}: {
  month: Date
  days: Date[]
  items: CalItem[]
  selected: DateKey | null
  onSelect: (key: DateKey, el: HTMLElement) => void
  // 사진이 있는 날. 평소엔 날짜 옆 작은 점, 사진 보기(photoMode)에선 일정 막대 아래 남은 칸에 사진
  photos?: Partial<Record<DateKey, DayPhoto>>
  photoMode?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [rowH, setRowH] = useState(88)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setRowH(entry.contentRect.height / 6))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 줄 수: 칸 높이에 맞춰서. 사진 보기에선 사진 자리를 남기고 일정은 1~2줄 (+N 줄 자리도 남긴다)
  const maxLanes = Math.max(1, Math.floor((rowH - HEAD_H - 2) / LANE_H))
  const photoLanes = Math.min(2, Math.max(1, Math.floor((rowH - HEAD_H - MORE_H - MIN_PHOTO_H - 2) / LANE_H)))
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7)), [days])
  const today = todayKey()

  return (
    <div ref={ref} className="grid min-h-0 flex-1 grid-rows-6">
      {weeks.map((week) => {
        const keys = week.map(toKey)
        const segs = layoutWeek(keys, items)
        const overflow = segs.some((s) => s.lane >= maxLanes)
        // 사진 자리를 남기는 건 사진 있는 날이 낀 주만
        const photoWeek = photoMode && keys.some((k) => photos?.[k])
        const visibleLanes = photoWeek ? photoLanes : overflow ? maxLanes - 1 : maxLanes
        const hidden = keys.map((_, col) => segs.filter((s) => s.lane >= visibleLanes && s.s <= col && s.e >= col).length)
        // 사진 보기: 그날 보이는 일정 막대(+N 줄) 바로 아래부터 사진
        const photoTop = keys.map((_, col) => {
          const lanes = Math.max(0, ...segs.filter((s) => s.lane < visibleLanes && s.s <= col && s.e >= col).map((s) => s.lane + 1))
          return HEAD_H + (hidden[col] > 0 ? visibleLanes * LANE_H + MORE_H : lanes * LANE_H)
        })

        return (
          <div key={keys[0]} className="relative min-h-0 border-t-2 border-dashed border-line/70 first:border-t-0">
            <div className="grid h-full grid-cols-7">
              {week.map((d, col) => {
                const key = keys[col]
                const holidays = holidayNames(key)
                const red = col === 0 || holidays.length > 0
                const isToday = key === today
                const photo = photos?.[key]
                const showPhoto = photoMode && photo
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => onSelect(key, e.currentTarget)}
                    aria-label={key}
                    data-day={key}
                    className={`relative flex h-full min-w-0 flex-col items-stretch rounded-2xl px-0.5 pt-0.5 text-left transition active:scale-95 ${
                      selected === key ? (photoMode ? 'ring-3 ring-accent ring-inset' : 'bg-partner/20') : 'active:bg-line/60'
                    } ${isSameMonth(d, month) ? '' : 'opacity-35'}`}
                  >
                    {showPhoto && <PhotoFill photo={photo} top={photoTop[col]} />}
                    <span className="flex h-[22px] min-w-0 items-center gap-0.5">
                      <span
                        className={`font-display flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1 text-[13px] ${
                          isToday
                            ? 'bg-accent text-white shadow-[0_2px_0_var(--color-accent-deep)]'
                            : red
                              ? 'text-holiday'
                              : col === 6
                                ? 'text-sat'
                                : ''
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      {holidays.length > 0 && (
                        <span className="min-w-0 overflow-hidden whitespace-nowrap text-[9px] leading-none text-holiday">
                          {holidays[0] === '대체공휴일' ? '대체휴일' : holidays[0]}
                        </span>
                      )}
                      {/* 평소 보기: 사진 있는 날 표시 */}
                      {!photoMode && photo && (
                        <span aria-hidden className="mr-0.5 ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="pointer-events-none absolute inset-x-0" style={{ top: HEAD_H }}>
              {segs
                .filter((s) => s.lane < visibleLanes)
                .map((seg) => (
                  <Bar key={`${seg.item.key}-${keys[0]}`} seg={seg} />
                ))}
              {hidden.map((n, col) =>
                n > 0 ? (
                  <span
                    key={col}
                    className="absolute truncate px-1 text-[10px] font-semibold leading-4 text-ink-soft"
                    style={{ left: `calc(${col} * 100% / 7)`, width: 'calc(100% / 7)', top: visibleLanes * LANE_H }}
                  >
                    +{n}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 사진 보기: 일정 막대 아래(top) 남은 칸에 대표 사진. 서명 링크를 받는 동안은 연한 자리만.
// 그날 사진이 여러 장이면 귀퉁이에 나머지 장수(+N)
function PhotoFill({ photo, top }: { photo: DayPhoto; top: number }) {
  const more = (photo.count ?? 1) - 1
  const [loaded, setLoaded] = useState(false)
  return (
    <span
      aria-hidden
      className="absolute inset-x-0.5 bottom-0.5 flex items-center justify-center overflow-hidden rounded-xl bg-line/60 text-xl"
      style={{ top, ...(photo.background ? { background: photo.background } : {}) }}
    >
      {photo.emoji}
      {photo.url && (
        <img
          src={photo.url}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {more > 0 && (
        <span className="absolute right-0.5 bottom-0.5 rounded-full bg-ink/60 px-1 text-[10px] leading-4 font-semibold text-white">
          +{more}
        </span>
      )}
    </span>
  )
}

function Bar({ seg }: { seg: Seg }) {
  const { item, s, e, lane, contL, contR } = seg
  const filled = item.allDay || e > s || item.kind !== 'event' || item.endKey !== item.startKey
  const style = {
    left: `calc(${s} * 100% / 7 + ${contL ? 0 : 2}px)`,
    width: `calc(${e - s + 1} * 100% / 7 - ${(contL ? 0 : 2) + (contR ? 0 : 2)}px)`,
    top: lane * LANE_H,
    height: LANE_H - 2,
  }
  // 칸이 좁아 말줄임(…) 대신 잘라서 한 글자라도 더 보이게 한다
  // 누구 일정인지: 주인 아바타를 맨 앞에 (우리 일정은 💞)
  const avatar = item.kind === 'anniv' ? null : (item.avatar ?? US_AVATAR)
  const label = (
    <>
      {avatar && (
        <span className="-ml-0.5 flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full bg-white/85 text-[8.5px] leading-none">
          {avatar}
        </span>
      )}
      {item.hidden && <EyeOff className="h-2.5 w-2.5 shrink-0" />}
      {item.masked && <Lock className="h-2.5 w-2.5 shrink-0" />}
      {item.emoji && <span className="shrink-0">{item.emoji}</span>}
      <span className="min-w-0 overflow-hidden whitespace-nowrap">{item.title}</span>
    </>
  )

  if (!filled) {
    // 하루 안의 시간 일정: 연한 색 스티커
    return (
      <span
        className="absolute flex items-center gap-0.5 overflow-hidden rounded-full px-1 text-[10.5px] font-bold leading-4"
        style={{ ...style, backgroundColor: `color-mix(in srgb, ${item.color} 38%, white)` }}
      >
        {label}
      </span>
    )
  }

  // 종일·여러 날 일정: 진한 색 알약 (이어지는 쪽은 각지게)
  return (
    <span
      className={`absolute flex items-center gap-0.5 overflow-hidden px-1.5 text-[10.5px] font-bold leading-4 ${
        contL ? 'rounded-l-none' : 'rounded-l-full'
      } ${contR ? 'rounded-r-none' : 'rounded-r-full'} ${item.kind === 'busy' ? 'text-ink-soft' : ''}`}
      style={{ ...style, backgroundColor: item.color }}
    >
      {label}
    </span>
  )
}
