import { addDays, endOfMonth, endOfWeek, startOfWeek } from 'date-fns'
import { ChevronRight, Info, Moon, Sparkles, Sun } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { PageHeader } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { Button, EmptyState, Segmented, Spinner } from '../../components/ui'
import { fmt, fmtDay, fromKey, toKey, type DateKey } from '../../lib/dates'
import { holidayNames } from '../../lib/holidays'
import { toMessage } from '../../lib/supabase'
import type { Wish } from '../../types/database'
import { useCalendarItems } from '../calendar/items'
import { tagEmoji, useWishes } from '../wish/queries'
import { computeFreeDays, describeBlock, fmtDuration, type FreeDay, type FreeMode } from './freeTime'

type RangePreset = 'thisWeek' | 'nextWeek' | 'twoWeeks' | 'thisMonth'

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: 'thisWeek', label: '이번 주' },
  { value: 'nextWeek', label: '다음 주' },
  { value: 'twoWeeks', label: '2주' },
  { value: 'thisMonth', label: '이번 달' },
]

const MODE_OPTIONS: { value: FreeMode; label: ReactNode }[] = [
  { value: 'evening', label: <><Moon className="h-4 w-4" aria-hidden /> 저녁</> },
  { value: 'allday', label: <><Sun className="h-4 w-4" aria-hidden /> 하루 종일</> },
]

const WEEK = { weekStartsOn: 1 as const } // 월요일 시작 (주말을 한 주로 묶는다)

function rangeOf(preset: RangePreset, today: Date): { from: DateKey; to: DateKey } {
  switch (preset) {
    case 'thisWeek':
      return { from: toKey(today), to: toKey(endOfWeek(today, WEEK)) }
    case 'nextWeek': {
      const mon = addDays(startOfWeek(today, WEEK), 7)
      return { from: toKey(mon), to: toKey(addDays(mon, 6)) }
    }
    case 'twoWeeks':
      return { from: toKey(today), to: toKey(addDays(today, 13)) }
    case 'thisMonth':
      return { from: toKey(today), to: toKey(endOfMonth(today)) }
  }
}

function weekLabel(weekStart: Date, today: Date) {
  const thisMon = startOfWeek(today, WEEK)
  const diff = Math.round((weekStart.getTime() - thisMon.getTime()) / (7 * 86_400_000))
  if (diff === 0) return '이번 주'
  if (diff === 1) return '다음 주'
  return `${fmt(weekStart, 'M월 d일')}부터 한 주`
}

export function FreeTimePage() {
  const { partner } = useCoupleCtx()
  return (
    <div className="flex min-h-full flex-col pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <PageHeader title="둘 다 비는 날 찾기" back />
      {partner ? (
        <FreeTimeFinder partnerId={partner.id} />
      ) : (
        <EmptyState emoji="💌" title="아직 상대와 연결되지 않았어요">
          두 사람의 일정을 함께 봐야 비는 날을 찾을 수 있어요.
          <br />
          설정에서 초대 코드를 보내 연결해 주세요.
        </EmptyState>
      )}
    </div>
  )
}

function FreeTimeFinder({ partnerId }: { partnerId: string }) {
  const navigate = useNavigate()
  const { me, partner } = useCoupleCtx()
  const [preset, setPreset] = useState<RangePreset>('twoWeeks')
  const [mode, setMode] = useState<FreeMode>('evening')
  const [showHard, setShowHard] = useState(false)
  const [pickDay, setPickDay] = useState<DateKey | null>(null)
  const [now] = useState(() => new Date())

  const { from, to } = useMemo(() => rangeOf(preset, now), [preset, now])
  const { items, isLoading, error } = useCalendarItems(from, to)
  const wishes = useWishes()
  const openWishes = useMemo(() => (wishes.data ?? []).filter((w) => !w.done), [wishes.data])

  const days = useMemo(
    () => computeFreeDays({ items, from, to, people: [me.id, partnerId], mode, now }),
    [items, from, to, me.id, partnerId, mode, now],
  )
  const goodCount = days.filter((d) => d.blocks.length > 0).length
  const hardCount = days.length - goodCount

  // 주(월요일 시작) 단위로 묶기
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; days: FreeDay[] }>()
    for (const d of days) {
      if (!showHard && d.blocks.length === 0) continue
      const ws = startOfWeek(fromKey(d.key), WEEK)
      const k = toKey(ws)
      if (!map.has(k)) map.set(k, { label: weekLabel(ws, now), days: [] })
      map.get(k)!.days.push(d)
    }
    return [...map.values()]
  }, [days, showHard, now])

  return (
    <div className="flex flex-col gap-4 px-4">
      <section className="flex flex-col gap-3 rounded-[28px] border-2 border-line shadow-[0_5px_0_var(--color-line)] bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">언제 중에서</span>
          <Segmented value={preset} options={RANGE_OPTIONS} onChange={setPreset} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">어느 시간대로</span>
          <Segmented value={mode} options={MODE_OPTIONS} onChange={setMode} />
          <p className="text-xs text-ink-soft">
            {mode === 'evening'
              ? '평일은 저녁 6시–10시, 주말·공휴일은 오전 10시–밤 10시 중에서 찾아요.'
              : '매일 오전 10시–밤 10시 중에서 찾아요.'}{' '}
            2시간 이상 함께 빌 때만 보여 드려요.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-2 px-1 text-xs text-ink-soft">
        <Dot color={me.color} /> 나
        <Dot color={partner!.color} /> {partner!.nickname}
        <span>· 우리 일정 · 회사 캘린더까지 함께 봤어요</span>
      </div>

      {error && (
        <p className="rounded-2xl bg-holiday/10 px-4 py-3 text-sm text-holiday">
          일정을 불러오지 못했어요. {toMessage(error)}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : days.length === 0 ? (
        <EmptyState emoji="🗓️" title="찾아볼 날짜가 없어요">
          다른 기간을 골라 보세요.
        </EmptyState>
      ) : (
        <>
          <p className="px-1 font-semibold">
            {goodCount > 0 ? (
              <>
                둘 다 비는 날을 <span className="text-accent">{goodCount}일</span> 찾았어요
              </>
            ) : (
              '이 기간엔 둘 다 비는 날이 없어요'
            )}
          </p>

          {goodCount === 0 && !showHard && (
            <EmptyState emoji="🌧️" title="조금 바쁜 시기네요">
              다른 기간이나 ‘하루 종일’로 바꿔서 찾아볼까요?
            </EmptyState>
          )}

          {groups.map((g) => (
            <section key={g.label} className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-bold text-ink-soft">{g.label}</h2>
              <ul className="flex flex-col gap-2">
                {g.days.map((d) => (
                  <li key={d.key}>
                    <DayRow
                      day={d}
                      hasWishes={openWishes.length > 0}
                      onPlan={() => navigate(`/event/new?date=${d.key}`)}
                      onPickWish={() => setPickDay(d.key)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {hardCount > 0 && (
            <button
              type="button"
              aria-pressed={showHard}
              onClick={() => setShowHard((v) => !v)}
              className="mx-auto rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink-soft shadow-sm active:bg-line"
            >
              {showHard ? '어려운 날 숨기기' : `어려운 날 ${hardCount}일도 보기`}
            </button>
          )}
        </>
      )}

      <Link
        to="/settings"
        className="mt-2 flex items-start gap-2 rounded-3xl bg-busy/30 p-4 text-sm text-ink-soft active:bg-busy/50"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b className="text-ink">설정 → 회사 캘린더</b>를 연결하면 회사 일정까지 반영돼서 더 정확해져요.
        </span>
      </Link>

      <WishPicker day={pickDay} wishes={openWishes} onClose={() => setPickDay(null)} />
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="ml-1 inline-block h-2.5 w-2.5 rounded-full first:ml-0" style={{ backgroundColor: color }} />
}

function DayRow({
  day,
  hasWishes,
  onPlan,
  onPickWish,
}: {
  day: FreeDay
  hasWishes: boolean
  onPlan: () => void
  onPickWish: () => void
}) {
  const date = fromKey(day.key)
  const holidays = holidayNames(day.key)
  const [best, second] = day.blocks
  const hard = !best

  return (
    <div
      className={`flex items-stretch rounded-[28px] border-2 border-line shadow-[0_5px_0_var(--color-line)] ${hard ? 'bg-surface/60 shadow-none' : 'bg-surface'}`}
    >
      <button
        type="button"
        onClick={onPlan}
        aria-label={`${fmtDay(date)} 일정 만들기`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-3xl p-4 text-left transition active:bg-line/60"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-2">
            <span className={`font-bold ${day.offDay ? 'text-holiday' : ''} ${hard ? 'opacity-60' : ''}`}>
              {fmtDay(date)}
            </span>
            {holidays.length > 0 && <span className="truncate text-xs text-holiday">{holidays.join(' · ')}</span>}
          </span>
          {hard ? (
            <span className="text-sm text-ink-soft">이 날은 어려워요</span>
          ) : (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{describeBlock(best, day)}</span>
                <span className="rounded-full bg-us/30 px-2 py-0.5 text-[11px] font-semibold">{fmtDuration(best)}</span>
              </span>
              {second && <span className="text-xs text-ink-soft">또는 {describeBlock(second, day)}</span>}
            </>
          )}
        </span>
        {!hard && !hasWishes && <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" />}
      </button>
      {!hard && hasWishes && (
        <button
          type="button"
          onClick={onPickWish}
          aria-label={`${fmtDay(date)}에 할 위시 고르기`}
          className="my-3 mr-3 flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-partner/25 px-3 text-[11px] font-semibold active:bg-partner/45"
        >
          <Sparkles className="h-4 w-4" />
          위시
        </button>
      )}
    </div>
  )
}

function WishPicker({ day, wishes, onClose }: { day: DateKey | null; wishes: Wish[]; onClose: () => void }) {
  const navigate = useNavigate()
  // 닫히는 애니메이션 동안 제목 유지
  const [last, setLast] = useState(day)
  if (day && day !== last) setLast(day)
  const key = day ?? last

  return (
    <Sheet
      open={!!day}
      onOpenChange={(o) => !o && onClose()}
      title={key ? `${fmtDay(fromKey(key))}, 뭐 할까요?` : '위시에서 고르기'}
      footer={
        <Button variant="soft" onClick={() => key && navigate(`/event/new?date=${key}`)}>
          위시 없이 일정 만들기
        </Button>
      }
    >
      <p className="pb-2 text-sm text-ink-soft">고른 위시로 이 날 일정을 만들어요. 저장하면 위시는 완료로 바뀌어요.</p>
      <ul className="flex flex-col">
        {wishes.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() =>
                key && navigate(`/event/new?date=${key}&title=${encodeURIComponent(w.title)}&wish=${w.id}`)
              }
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-line/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-xl" aria-hidden>
                {tagEmoji(w.tag)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{w.title}</span>
                {w.memo && <span className="truncate text-xs text-ink-soft">{w.memo}</span>}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
