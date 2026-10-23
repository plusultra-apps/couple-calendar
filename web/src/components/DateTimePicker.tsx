import { addDays, addMonths, isSameMonth, nextSaturday, startOfMonth } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
// 24시간제: 정각이면 '16시', 분이 있으면 '16:30'
export const timeLabel = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return m === 0 ? `${h}시` : `${h}:${String(m).padStart(2, '0')}`
}

export function TimeButton({
  value,
  onChange,
  title = '시간 고르기',
  placeholder = '시간 고르기',
  className = '',
  openSignal = 0,
  hint,
}: {
  value: string // 'HH:mm' ('' = 아직 안 고름)
  onChange: (t: string) => void
  title?: string
  placeholder?: string
  className?: string
  hint?: string // 아직 안 골랐을 때 시트 위에 보여 줄 안내
  // 값이 바뀔 때마다(0 제외) 시트를 바깥에서 열어 준다 (저장하려는데 시간을 안 골랐을 때 등)
  openSignal?: number
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (openSignal > 0) setOpen(true)
  }, [openSignal])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`font-display press-3d flex h-12 items-center gap-2 rounded-2xl border-2 bg-surface px-3.5 text-[17px] ${
          value ? 'border-line' : 'border-accent text-ink-soft'
        } ${className}`}
      >
        <Clock className="h-5 w-5 shrink-0 text-accent" />
        <span className="whitespace-nowrap">{value ? timeLabel(value) : placeholder}</span>
      </button>
      <TimePickerSheet open={open} onOpenChange={setOpen} value={value} onChange={onChange} title={title} hint={hint} />
    </>
  )
}

const QUICK_TIMES = [
  { label: '9시', t: '09:00' },
  { label: '12시', t: '12:00' },
  { label: '15시', t: '15:00' },
  { label: '19시', t: '19:00' },
  { label: '21시', t: '21:00' },
]
const HOURS24 = Array.from({ length: 24 }, (_, i) => i) // 0~23 (24시간제)

// 휠 한 칸 높이 · 위아래로 비워 가운데 정렬할 칸 수
const ITEM_H = 44
const PAD = 2
const WHEEL_H = (PAD * 2 + 1) * ITEM_H

// 세로로 톡톡 넘겨 고르는 휠(드럼). 스크롤이 멈추면 가장 가까운 칸으로 스냅하고 값을 올린다.
function Wheel({
  items,
  value,
  onChange,
  format = String,
  'aria-label': ariaLabel,
}: {
  items: number[]
  value: number
  onChange: (v: number) => void
  format?: (n: number) => string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<number | undefined>(undefined)

  // 열릴 때(마운트) 현재 값 위치로. 값 변화로는 다시 안 옮긴다(스크롤과 싸우지 않게).
  useLayoutEffect(() => {
    const el = ref.current
    const i = items.indexOf(value)
    if (el && i >= 0) el.scrollTop = i * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      if (Math.abs(el.scrollTop - i * ITEM_H) > 0.5) el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
      if (items[i] !== value) onChange(items[i])
    }, 110)
  }

  return (
    <div className="relative flex-1" style={{ height: WHEEL_H }} role="listbox" aria-label={ariaLabel}>
      {/* 가운데 선택 칸 표시 */}
      <div className="pointer-events-none absolute inset-x-0" style={{ top: PAD * ITEM_H, height: ITEM_H }}>
        <div className="mx-1 h-full rounded-2xl border-2 border-accent/40 bg-accent/10" />
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full snap-y snap-mandatory overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: PAD * ITEM_H }} />
        {items.map((n) => {
          const active = n === value
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                ref.current?.scrollTo({ top: items.indexOf(n) * ITEM_H, behavior: 'smooth' })
                onChange(n)
              }}
              className={`font-display flex w-full snap-center items-center justify-center transition ${
                active ? 'text-2xl text-ink' : 'text-lg text-ink-soft/50'
              }`}
              style={{ height: ITEM_H }}
            >
              {format(n)}
            </button>
          )
        })}
        <div style={{ height: PAD * ITEM_H }} />
      </div>
    </div>
  )
}

export function TimePickerSheet({
  open,
  onOpenChange,
  value,
  onChange,
  title,
  hint,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: string
  onChange: (t: string) => void
  title: string
  hint?: string
}) {
  // value '' = 아직 안 고름. 안 골랐으면 '완료'를 못 눌러 직접 고르도록 강제한다.
  const DEFAULT_HOUR = 12
  const [hour, setHourState] = useState(() => (value ? Number(value.split(':')[0]) : DEFAULT_HOUR))
  const [chosen, setChosen] = useState(value !== '')
  // 휠을 값 위치로 다시 그릴 때 쓰는 key (열림/‘지금’ 때만 remount, 스크롤 땐 유지)
  const [bump, setBump] = useState(0)
  const wheelKey = `${open}-${bump}`

  // 시트가 열릴 때 들어온 값으로 초기화
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setHourState(value ? Number(value.split(':')[0]) : DEFAULT_HOUR)
      setChosen(value !== '')
      setBump((b) => b + 1)
    }
  }

  const pick = (hh: number) => {
    setHourState(hh)
    setChosen(true)
    onChange(`${String(hh).padStart(2, '0')}:00`)
  }
  // 지금 시각 (그 시각의 정각)
  const now = () => {
    pick(new Date().getHours())
    setBump((b) => b + 1)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      handleOnly
      title={
        <span className="flex items-baseline gap-2">
          {title} <span className="text-accent-deep">{chosen ? `${hour}시` : '시간을 골라 주세요'}</span>
        </span>
      }
      footer={
        <button
          type="button"
          disabled={!chosen}
          onClick={() => onOpenChange(false)}
          className="font-display press-3d h-13 w-full rounded-full bg-accent text-lg text-white [--shade:var(--color-accent-deep)] disabled:opacity-50"
        >
          {chosen ? '완료' : '시간을 골라 주세요'}
        </button>
      }
    >
      {!chosen && hint && (
        <p className="mb-3 rounded-2xl border-2 border-accent/40 bg-accent/10 px-3 py-2 text-sm font-bold">{hint}</p>
      )}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={now}
          className="font-display press-3d shrink-0 rounded-full border-2 border-accent-deep bg-accent px-3.5 py-1.5 text-[15px] text-white [--shade:var(--color-accent-deep)]"
        >
          지금
        </button>
        {QUICK_TIMES.map((q) => (
          <button
            key={q.t}
            type="button"
            onClick={() => {
              setChosen(true)
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
        {/* 시 휠 (24시간제) */}
        <div key={wheelKey} className="flex justify-center">
          <Wheel items={HOURS24} value={hour} onChange={pick} format={(n) => `${n}시`} aria-label="시" />
        </div>
        <p className="text-center text-xs text-ink-soft">{chosen ? '위아래로 톡톡 넘겨 맞춰요' : '시간을 한 번 골라 주세요'}</p>
      </div>
    </Sheet>
  )
}
