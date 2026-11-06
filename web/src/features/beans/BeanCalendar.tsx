import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fmt, fmtTime, fromKey, toKey, todayKey, type DateKey } from '../../lib/dates'
import type { BeanType } from './model'
import type { Bean } from './queries'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 콩 기록 달력: 날짜마다 콩 색 점. 날짜를 누르면 그날 콩이 아래에 나온다.
export function BeanCalendar({
  beans,
  typeOf,
  onRemove,
}: {
  beans: Bean[]
  typeOf: (b: Bean) => BeanType
  onRemove: (b: Bean) => void
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [picked, setPicked] = useState<DateKey>(todayKey())
  const [showAll, setShowAll] = useState(false) // 하루 기록이 많을 때 더보기

  const byDay = useMemo(() => {
    const m = new Map<string, Bean[]>()
    for (const b of beans) m.set(b.taken_on, [...(m.get(b.taken_on) ?? []), b])
    return m
  }, [beans])

  const days = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) })
  const today = todayKey()
  const dayBeans = byDay.get(picked) ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <button type="button" aria-label="이전 달" onClick={() => setMonth((m) => addMonths(m, -1))} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <p className="font-display flex-1 text-center text-xl">{fmt(month, 'yyyy년 M월')}</p>
        <button type="button" aria-label="다음 달" onClick={() => setMonth((m) => addMonths(m, 1))} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-bold text-ink-soft">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={i === 0 ? 'text-holiday' : i === 6 ? 'text-sat' : ''}>
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const key = toKey(d)
          const items = byDay.get(key) ?? []
          const inMonth = isSameMonth(d, month)
          const selected = key === picked
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPicked(key)
                setShowAll(false)
              }}
              aria-label={`${key} 콩 ${items.length}개`}
              aria-pressed={selected}
              className={`flex h-14 flex-col items-center gap-0.5 rounded-2xl pt-1.5 transition active:scale-90 ${selected ? 'bg-partner/35' : ''} ${inMonth ? '' : 'opacity-35'}`}
            >
              <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm ${key === today ? 'bg-accent font-bold text-white' : ''}`}>{d.getDate()}</span>
              <span className="flex max-w-full items-center justify-center gap-[3px]">
                {items.slice(0, 3).map((b) => (
                  <span key={b.id} className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: typeOf(b).color }} aria-hidden />
                ))}
                {items.length > 3 && <span className="text-[9px] font-bold leading-none text-ink-soft">+{items.length - 3}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1 border-t-2 border-dashed border-line pt-3">
        <p className="font-bold">{fmt(fromKey(picked), 'M월 d일 (EEE)')}</p>
        {dayBeans.length === 0 ? (
          <p className="py-2 text-sm text-ink-soft">기록이 없어요</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {(showAll ? dayBeans : dayBeans.slice(0, 5)).map((b) => {
              const t = typeOf(b)
              return (
                <li key={b.id} className="flex items-center gap-3 py-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ backgroundColor: t.color }} aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="flex-1 font-bold">{t.label}</span>
                  <span className="text-xs text-ink-soft">{fmtTime(new Date(b.created_at))}</span>
                  <button
                    type="button"
                    aria-label="이 콩 빼기"
                    onClick={() => onRemove(b)}
                    disabled={b.id.startsWith('tmp-')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft active:bg-line disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {!showAll && dayBeans.length > 5 && (
          <button type="button" onClick={() => setShowAll(true)} className="font-display mt-1 self-center rounded-full border-2 border-line bg-surface px-4 py-1.5 text-sm active:scale-95">
            더보기 ({dayBeans.length - 5}개)
          </button>
        )}
      </div>
    </div>
  )
}
