import { addDays, addMonths, isSameMonth, nextSaturday, startOfMonth } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { fmt, fromKey, monthGrid, toKey, todayKey, type DateKey } from '../lib/dates'
import { holidayNames } from '../lib/holidays'
import { Sheet } from './Sheet'

// ─────────────────────────────────────────────
// 날짜 버튼 + 미니 달력 시트
// ─────────────────────────────────────────────
export function DateButton({
  value,
  onChange,
  min,
  max,
  placeholder = '날짜 고르기',
  title = '날짜 고르기',
  quick = true,
  className = '',
}: {
  value: DateKey | ''
  onChange: (key: DateKey) => void
  min?: DateKey
  max?: DateKey
  placeholder?: string
  title?: string
  quick?: boolean // 오늘·내일 같은 빠른 칩
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`font-display press-3d flex h-12 min-w-0 items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3.5 text-left text-[17px] ${className}`}
      >
        <CalendarDays className="h-5 w-5 shrink-0 text-accent" />
        <span className={`truncate ${value ? '' : 'text-ink-soft'}`}>
          {value ? fmt(fromKey(value), value.slice(0, 4) === todayKey().slice(0, 4) ? 'M월 d일 (EEE)' : 'yyyy년 M월 d일') : placeholder}
        </span>
      </button>
      <DatePickerSheet
        open={open}
        onOpenChange={setOpen}
        value={value}
        min={min}
        max={max}
        title={title}
        quick={quick}
        onChange={(k) => {
          onChange(k)
          setOpen(false)
        }}
      />
    </>
  )
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function DatePickerSheet({
  open,
  onOpenChange,
  value,
  onChange,
  min,
  max,
  title,
  quick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: DateKey | ''
  onChange: (key: DateKey) => void
  min?: DateKey
  max?: DateKey
  title: string
  quick: boolean
}) {
  const [view, setView] = useState(() => startOfMonth(value ? fromKey(value) : new Date()))
  const [mode, setMode] = useState<'days' | 'months'>('days')
  const [wasOpen, setWasOpen] = useState(open)
  // 열릴 때마다 선택된 날짜의 달로 돌아간다
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setView(startOfMonth(value ? fromKey(value) : new Date()))
      setMode('days')
    }
  }

  const today = todayKey()
  const allowed = (k: DateKey) => (!min || k >= min) && (!max || k <= max)
  const quickChips: { label: string; key: DateKey }[] = [
    { label: '오늘', key: today },
    { label: '내일', key: toKey(addDays(new Date(), 1)) },
    { label: '이번 토요일', key: toKey(new Date().getDay() === 6 ? new Date() : nextSaturday(new Date())) },
    { label: '일주일 뒤', key: toKey(addDays(value ? fromKey(value) : new Date(), 7)) },
  ].filter((c) => allowed(c.key))

  // 좌우 스와이프로 달 이동
  const [touchX, setTouchX] = useState<number | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {quick && quickChips.length > 0 && (
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {quickChips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onChange(c.key)}
              className={`font-display press-3d shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[15px] ${
                c.key === value ? 'border-accent-deep bg-accent text-white [--shade:var(--color-accent-deep)]' : 'border-line bg-surface'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-[26px] border-2 border-line bg-cream p-3">
        <div className="mb-2 flex items-center">
          <button
            type="button"
            aria-label={mode === 'days' ? '이전 달' : '이전 해'}
            onClick={() => setView((v) => addMonths(v, mode === 'days' ? -1 : -12))}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'days' ? 'months' : 'days'))}
            className="font-display flex-1 rounded-full py-1 text-xl active:scale-95"
          >
            {mode === 'days' ? fmt(view, 'yyyy년 M월') : fmt(view, 'yyyy년')}
            <span className="ml-1 text-sm text-ink-soft">{mode === 'days' ? '▾' : '▴'}</span>
          </button>
          <button
            type="button"
            aria-label={mode === 'days' ? '다음 달' : '다음 해'}
            onClick={() => setView((v) => addMonths(v, mode === 'days' ? 1 : 12))}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {mode === 'months' ? (
          <div className="grid grid-cols-4 gap-2 py-2">
            {Array.from({ length: 12 }, (_, m) => {
              const d = new Date(view.getFullYear(), m, 1)
              const active = value && isSameMonth(d, fromKey(value))
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setView(d)
                    setMode('days')
                  }}
                  className={`font-display h-12 rounded-2xl text-lg transition active:scale-90 ${
                    active ? 'bg-accent text-white' : 'bg-surface'
                  }`}
                >
                  {m + 1}월
                </button>
              )
            })}
          </div>
        ) : (
          <div
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX === null) return
              const dx = e.changedTouches[0].clientX - touchX
              setTouchX(null)
              if (Math.abs(dx) > 50) setView((v) => addMonths(v, dx < 0 ? 1 : -1))
            }}
          >
            <div className="font-display mb-1 grid grid-cols-7 text-center text-sm text-ink-soft">
              {WEEKDAYS.map((w, i) => (
                <span key={w} className={i === 0 ? 'text-holiday' : i === 6 ? 'text-sat' : ''}>
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(view).map((d, i) => {
                const key = toKey(d)
                const inMonth = isSameMonth(d, view)
                const selected = key === value
                const holiday = holidayNames(key)[0]
                const red = i % 7 === 0 || !!holiday
                const ok = allowed(key)
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!ok}
                    onClick={() => onChange(key)}
                    aria-label={key}
                    aria-pressed={selected}
                    className={`flex h-12 flex-col items-center justify-center rounded-full transition active:scale-90 disabled:opacity-25 ${
                      inMonth ? '' : 'opacity-35'
                    }`}
                  >
                    <span
                      className={`font-display flex h-9 w-9 items-center justify-center rounded-full text-[17px] ${
                        selected
                          ? 'animate-pop bg-accent text-white shadow-[0_3px_0_var(--color-accent-deep)]'
                          : key === today
                            ? 'ring-2 ring-accent ring-inset'
                            : ''
                      } ${!selected && red ? 'text-holiday' : !selected && i % 7 === 6 ? 'text-sat' : ''}`}
                    >
                      {d.getDate()}
                    </span>
                    <span className="h-2 max-w-full truncate text-[8px] leading-none text-holiday">{holiday && inMonth ? holiday.slice(0, 4) : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ─────────────────────────────────────────────
// 시간 버튼 + 톡톡 시간 고르기 시트
// ─────────────────────────────────────────────
export const timeLabel = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}

export function TimeButton({
  value,
  onChange,
  title = '시간 고르기',
  className = '',
}: {
  value: string // 'HH:mm'
  onChange: (t: string) => void
  title?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`font-display press-3d flex h-12 items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3.5 text-[17px] ${className}`}
      >
        <Clock className="h-5 w-5 shrink-0 text-accent" />
        <span className="whitespace-nowrap">{timeLabel(value)}</span>
      </button>
      <TimePickerSheet open={open} onOpenChange={setOpen} value={value} onChange={onChange} title={title} />
    </>
  )
}

const QUICK_TIMES = [
  { label: '아침 9시', t: '09:00' },
  { label: '점심 12시', t: '12:00' },
  { label: '오후 3시', t: '15:00' },
  { label: '저녁 7시', t: '19:00' },
  { label: '밤 9시', t: '21:00' },
]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export function TimePickerSheet({
  open,
  onOpenChange,
  value,
  onChange,
  title,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: string
  onChange: (t: string) => void
  title: string
}) {
  const [h, m] = value.split(':').map(Number)
  const pm = h >= 12
  const h12 = h % 12 === 0 ? 12 : h % 12
  const set = (hour24: number, minute: number) =>
    onChange(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  const to24 = (hour12: number, isPm: boolean) => (hour12 % 12) + (isPm ? 12 : 0)

  const cell = (active: boolean) =>
    `font-display h-12 rounded-2xl text-lg transition active:scale-90 ${
      active ? 'animate-pop bg-accent text-white shadow-[0_3px_0_var(--color-accent-deep)]' : 'bg-surface border-2 border-line'
    }`

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-baseline gap-2">
          {title} <span className="text-accent-deep">{timeLabel(value)}</span>
        </span>
      }
      footer={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="font-display press-3d h-13 w-full rounded-full bg-accent text-lg text-white [--shade:var(--color-accent-deep)]"
        >
          완료
        </button>
      }
    >
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {QUICK_TIMES.map((q) => (
          <button
            key={q.t}
            type="button"
            onClick={() => {
              onChange(q.t)
              onOpenChange(false)
            }}
            className="font-display press-3d shrink-0 rounded-full border-2 border-line bg-surface px-3.5 py-1.5 text-[15px]"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[26px] border-2 border-line bg-cream p-3">
        <div className="grid grid-cols-2 gap-2">
          {[false, true].map((isPm) => (
            <button key={String(isPm)} type="button" onClick={() => set(to24(h12, isPm), m)} className={cell(pm === isPm)}>
              <span className="inline-flex items-center justify-center gap-1.5">
                {isPm ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5" aria-hidden />}
                {isPm ? '오후' : '오전'}
              </span>
            </button>
          ))}
        </div>
        <div>
          <p className="mb-1.5 px-1 text-sm font-bold text-ink-soft">시</p>
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((hh) => (
              <button key={hh} type="button" onClick={() => set(to24(hh, pm), m)} className={cell(hh === h12)}>
                {hh}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 px-1 text-sm font-bold text-ink-soft">분</p>
          <div className="grid grid-cols-6 gap-1.5">
            {MINUTES.map((mm) => (
              <button key={mm} type="button" onClick={() => set(h, mm)} className={cell(mm === m)}>
                {String(mm).padStart(2, '0')}
              </button>
            ))}
          </div>
          {!MINUTES.includes(m) && <p className="mt-1 px-1 text-xs text-ink-soft">지금 {m}분이에요</p>}
        </div>
      </div>
    </Sheet>
  )
}
