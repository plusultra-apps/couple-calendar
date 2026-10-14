import { startOfMonth } from 'date-fns'
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Gift,
  Grid3x3,
  Heart,
  ImagePlus,
  Images,
  Lock,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Plus,
  Rows3,
  Search,
  Settings,
  Sparkles,
  Stamp,
  Users,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CoupleProvider, US_AVATAR, useCoupleCtx } from '../../app/couple'
import { THEMES } from '../../app/theme'
import { DateButton, TimeButton } from '../../components/DateTimePicker'
import { Mascot } from '../../components/Mascot'
import { daysTogether } from '../../lib/anniversary'
import { celebrate, celebrateAt } from '../../lib/celebrate'
import { combine, fmt, fmtDay, fromKey, monthGrid, toTimeInput, type DateKey } from '../../lib/dates'
import { ItemRow } from '../calendar/ItemRow'
import type { CalItem } from '../calendar/items'
import { PhotoModeButton } from '../calendar/PhotoModeButton'
import { MonthGrid, type DayPhoto } from '../calendar/MonthGrid'
import { DayFreeTime } from '../free/DayFreeTime'
import { Coach } from './Coach'
import {
  DEMO_PHOTOS,
  DEMO_PLACES,
  DEMO_WISHES,
  demoCouple,
  demoDates,
  demoItems,
  makeItem,
  type DemoWish,
} from './demoData'
import { markTutorialDone } from './firstRun'
import { makeSteps } from './steps'

type Screen = 'cal' | 'editor' | 'wish' | 'memories' | 'anniv' | 'settings'
type Filter = 'all' | 'us' | 'me' | 'partner'

// 실제 커플 정보(이름·아바타·색)만 읽어서 쓰고, 상대가 아직 없으면 가짜 상대를 넣는다
export function TutorialPage() {
  const { userId, couple } = useCoupleCtx()
  const demo = useMemo(() => demoCouple(couple, userId), [couple, userId])
  return (
    <CoupleProvider userId={userId} couple={demo}>
      <Tutorial />
    </CoupleProvider>
  )
}

function Tutorial() {
  const navigate = useNavigate()
  const { couple, me, partner, userId } = useCoupleCtx()
  const p = partner!
  const steps = useMemo(
    () => makeSteps({ me: me.nickname, partner: p.nickname, meAvatar: me.avatar, partnerAvatar: p.avatar }),
    [me, p],
  )
  const dates = useMemo(() => demoDates(), [])
  const baseItems = useMemo(() => demoItems(couple, userId, dates), [couple, userId, dates])

  const [i, setI] = useState(0)
  const [screen, setScreen] = useState<Screen>('cal')
  const [filter, setFilter] = useState<Filter>('all')
  const [dayOpen, setDayOpen] = useState(false)
  const [draft, setDraft] = useState({ start: '18:30', min: 120, title: '', owner: 'us' as 'us' | 'me' | 'partner' })
  const [created, setCreated] = useState<CalItem | null>(null)
  const [stampMode, setStampMode] = useState(false)
  const [stampPicked, setStampPicked] = useState(false)
  const [stamps, setStamps] = useState<DateKey[]>([])
  const [photoMode, setPhotoMode] = useState(false)
  // 연습용 사진이 있는 날 (그라데이션 + 이모지)
  const demoDayPhotos = useMemo(() => {
    const map: Partial<Record<DateKey, DayPhoto>> = {}
    ;[-6, -4, -1, 1, 4, 7].forEach((n, idx) => {
      const p = DEMO_PHOTOS[idx % DEMO_PHOTOS.length]
      map[dates.key(n)] = { background: `linear-gradient(135deg, ${p.from}, ${p.to})`, emoji: p.emoji, count: idx === 2 ? 4 : 1 }
    })
    return map
  }, [dates])

  const step = steps[i]
  // 단계가 기다리는 행동이 일어나면 다음 단계로
  const emit = (ev: string) => {
    if (step.action !== 'next' && (step.waitFor ?? step.target) === ev) setI((x) => x + 1)
  }
  const exit = () => {
    markTutorialDone()
    navigate('/', { replace: true })
  }
  const next = () => {
    if (i === steps.length - 1) {
      celebrate()
      exit()
    } else setI(i + 1)
  }

  // 별칭 → 실제 화면 요소
  const alias: Record<string, string> = {
    'demo-day': `day:${dates.day}`,
    'stamp-day-1': `day:${dates.stamp1}`,
    'stamp-day-2': `day:${dates.stamp2}`,
  }
  const coachStep = step.target ? { ...step, target: alias[step.target] ?? step.target } : step

  const allItems = useMemo(() => {
    const stamped = stamps.map((k) => makeItem(couple, userId, { id: `stamp-${k}`, title: '운동', who: 'me', start: k, from: '07:00', to: '08:00' }))
    return [...baseItems, ...(created ? [created] : []), ...stamped].sort(
      (a, b) => a.startKey.localeCompare(b.startKey) || Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime(),
    )
  }, [baseItems, created, stamps, couple, userId])

  const visible = allItems.filter((it) =>
    filter === 'all' ? true : filter === 'us' ? it.ownerId === null : filter === 'me' ? it.ownerId === userId : it.ownerId === p.id,
  )

  function goTab(s: Screen, ev: string) {
    setScreen(s)
    setDayOpen(false)
    emit(ev)
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {screen === 'cal' && (
          <CalendarDemo
            month={startOfMonth(fromKey(dates.day))}
            items={visible}
            filter={filter}
            onFilter={(f) => {
              setFilter(f)
              emit(`filter-${f}`)
            }}
            onSelect={(key) => {
              if (stampMode) {
                if (!stampPicked) return
                setStamps((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]))
                const el = document.querySelector(`[data-day="${key}"]`)
                celebrateAt(el, 6, ['💪', '✨'])
                if (key === dates.stamp1) emit('stamp-day-1')
                if (key === dates.stamp2) emit('stamp-day-2')
                return
              }
              if (key === dates.day) {
                setDayOpen(true)
                emit('demo-day')
              }
            }}
            selected={dayOpen ? dates.day : null}
            photos={demoDayPhotos}
            photoMode={photoMode}
            onPhotoMode={() => {
              setPhotoMode(!photoMode)
              emit(photoMode ? 'photo-mode-off' : 'photo-mode-on')
            }}
            stampMode={stampMode}
            stampPicked={stampPicked}
            onStampOpen={() => {
              setStampMode(true)
              emit('stamp-btn')
            }}
            onStampPick={() => {
              setStampPicked(true)
              emit('stamp-pick')
            }}
            onStampDone={() => {
              setStampMode(false)
              setStampPicked(false)
              emit('stamp-done')
            }}
          />
        )}
        {screen === 'editor' && (
          <EditorDemo
            day={dates.day}
            draft={draft}
            onQuick={() => {
              setDraft((d) => ({ ...d, title: '데이트', owner: 'us' }))
              emit('ed-quick')
            }}
            onSave={() => {
              const end = new Date(combine(dates.day, draft.start).getTime() + draft.min * 60_000)
              setCreated(
                makeItem(couple, userId, {
                  id: 'created',
                  title: draft.title || '데이트',
                  who: draft.owner,
                  start: dates.day,
                  from: draft.start,
                  to: toTimeInput(end),
                  location: '성수동',
                }),
              )
              setScreen('cal')
              setDayOpen(false)
              celebrate()
              emit('ed-save')
            }}
          />
        )}
        {screen === 'wish' && <WishDemo emit={emit} />}
        {screen === 'memories' && <MemoriesDemo emit={emit} />}
        {screen === 'anniv' && <AnnivDemo />}
        {screen === 'settings' && <SettingsDemo />}
      </main>

      {screen !== 'editor' && (
        <div className="shrink-0 px-3 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <nav
            data-tut="tabbar"
            className="grid grid-cols-5 rounded-full border-2 border-line bg-surface/95 p-1.5 shadow-[0_5px_0_var(--color-line)]"
          >
            {(
              [
                ['cal', '캘린더', CalendarDays, 'tab-cal'],
                ['wish', '위시', Sparkles, 'tab-wish'],
                ['memories', '추억', Images, 'tab-memories'],
                ['anniv', '기념일', Gift, 'tab-anniv'],
                ['settings', '설정', Settings, 'tab-settings'],
              ] as const
            ).map(([s, label, Icon, tut]) => {
              const active = screen === s
              return (
                <button
                  key={s}
                  type="button"
                  data-tut={tut}
                  onClick={() => goTab(s, tut)}
                  className={`font-display flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] ${
                    active ? 'bg-partner/35 text-accent-deep' : 'text-ink-soft'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} />
                  {label}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* 날짜 창 (연습용: 진짜 시트 대신 단순한 아래 창) */}
      {screen === 'cal' && dayOpen && (
        <DemoSheet title={fmtDay(fromKey(dates.day))}>
          <DayFreeTime
            day={dates.day}
            items={allItems}
            onPlan={(_d, start, min) => {
              setDraft({ start, min, title: '', owner: 'us' })
              setScreen('editor')
              setDayOpen(false)
              emit('free-slot')
            }}
          />
          {visible
            .filter((it) => it.startKey <= dates.day && it.endKey >= dates.day)
            .map((it) => (
              <ItemRow
                key={it.key}
                item={it}
                day={dates.day}
                ownerName={it.ownerId === null ? '우리' : it.ownerId === userId ? me.nickname : p.nickname}
              />
            ))}
        </DemoSheet>
      )}

      <Coach step={coachStep} index={i} total={steps.length} onNext={next} onExit={exit} />
    </div>
  )
}

// ── 공용 조각 ──

function DemoSheet({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-ink/30">
      <div className="animate-pop mx-auto max-h-[78dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line-deep" />
        <h2 className="mb-3 text-xl">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex h-14 items-center gap-2 px-4">
      <h1 className="flex-1 text-[22px]">{title}</h1>
      {right}
    </header>
  )
}

function Fab({ tut, icon, label, onClick }: { tut: string; icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tut={tut}
      onClick={onClick}
      className="press-3d fixed right-[max(1rem,calc(50%-14rem+1rem))] bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-30 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-accent text-white [--shade:var(--color-accent-deep)]"
    >
      {icon}
    </button>
  )
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// ── 캘린더 ──

function CalendarDemo({
  month,
  items,
  filter,
  onFilter,
  onSelect,
  selected,
  photos,
  photoMode,
  onPhotoMode,
  stampMode,
  stampPicked,
  onStampOpen,
  onStampPick,
  onStampDone,
}: {
  month: Date
  items: CalItem[]
  photos: Partial<Record<DateKey, DayPhoto>>
  photoMode: boolean
  onPhotoMode: () => void
  filter: Filter
  onFilter: (f: Filter) => void
  onSelect: (key: DateKey) => void
  selected: DateKey | null
  stampMode: boolean
  stampPicked: boolean
  onStampOpen: () => void
  onStampPick: () => void
  onStampDone: () => void
}) {
  const { couple, me, partner } = useCoupleCtx()
  const days = useMemo(() => monthGrid(month), [month])
  const options: { key: Filter; label: string; avatar?: string; color: string }[] = [
    { key: 'all', label: '전체', color: 'var(--color-partner)' },
    { key: 'us', label: '우리', avatar: US_AVATAR, color: couple.us_color },
    { key: 'me', label: '나', avatar: me.avatar, color: me.color },
    { key: 'partner', label: partner!.nickname, avatar: partner!.avatar, color: partner!.color },
  ]
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        <h1 className="flex items-baseline gap-1.5 text-[28px]">
          {fmt(month, 'M월')}
          <span className="text-base text-ink-soft">{fmt(month, 'yyyy')}</span>
        </h1>
        <span className="font-display press-3d ml-auto flex h-10 items-center gap-1 rounded-full border-2 border-line bg-surface px-3.5 text-accent-deep">
          <Heart className="h-4 w-4 fill-accent text-accent" />
          {daysTogether(couple.started_on).toLocaleString()}일
        </span>
        <span data-tut="bell" className="relative flex h-10 w-10 items-center justify-center rounded-full">
          <Bell className="h-5 w-5" />
          <span className="font-display absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg bg-accent px-1 text-[10px] leading-none text-white">
            2
          </span>
        </span>
      </header>
      <div className="flex shrink-0 gap-1.5 px-3 pb-2">
        {options.map((o) => {
          const active = filter === o.key
          return (
            <button
              key={o.key}
              type="button"
              data-tut={`filter-${o.key}`}
              onClick={() => onFilter(o.key)}
              className={`font-display flex h-9 min-w-0 items-center gap-1 rounded-full border-2 px-3 text-[14px] ${
                active ? 'text-ink shadow-[0_3px_0_var(--color-line-deep)]' : 'border-line bg-surface/80 text-ink-soft'
              }`}
              style={active ? { backgroundColor: o.color, borderColor: `color-mix(in srgb, ${o.color} 70%, black 8%)` } : undefined}
            >
              {o.avatar && <span className="text-base">{o.avatar}</span>}
              <span className="truncate">{o.label}</span>
            </button>
          )
        })}
        <PhotoModeButton on={photoMode} onClick={onPhotoMode} />
      </div>
      <div
        data-tut="cal-grid"
        className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-2 border-line bg-surface shadow-[0_5px_0_var(--color-line)]"
      >
        <div className="flex shrink-0 items-center gap-1 px-1.5 pt-1.5">
          <ChevronLeft className="h-5 w-5 text-ink-soft" />
          <div className="font-display grid flex-1 grid-cols-7 text-center text-[13px] text-ink-soft">
            {WEEKDAYS.map((w, idx) => (
              <span key={w} className={idx === 0 ? 'text-holiday' : idx === 6 ? 'text-sat' : ''}>
                {w}
              </span>
            ))}
          </div>
          <ChevronRight className="h-5 w-5 text-ink-soft" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <MonthGrid month={month} days={days} items={items} selected={selected} onSelect={(k) => onSelect(k)} photos={photos} photoMode={photoMode && !stampMode} />
        </div>
      </div>

      {stampMode ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.6rem)] z-30 mx-auto max-w-md px-3">
          <div className="rounded-[28px] border-2 border-partner bg-surface/95 px-4 py-3 shadow-[0_5px_0_color-mix(in_srgb,var(--color-partner)_60%,white)]">
            <div className="flex items-center gap-2">
              <p className="font-display flex-1 text-[15px]">
                {stampPicked ? (
                  <>
                    <span className="text-xl">🏋️</span> 날짜를 톡톡 눌러 찍어요
                  </>
                ) : (
                  '어떤 도장을 찍을까요?'
                )}
              </p>
              <button
                type="button"
                data-tut="stamp-done"
                onClick={onStampDone}
                className="font-display h-9 rounded-full bg-accent px-4 text-white"
              >
                완료
              </button>
            </div>
            {!stampPicked && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  data-tut="stamp-pick"
                  onClick={onStampPick}
                  className="font-display press-3d flex h-11 items-center gap-1.5 rounded-full border-2 px-4"
                  style={{ backgroundColor: `color-mix(in srgb, ${me.color} 25%, white)`, borderColor: me.color }}
                >
                  🏋️ 운동
                </button>
                <span className="font-display flex h-11 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-4 text-ink-soft">
                  🧘 필라테스
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-label="도장 찍기"
            data-tut="stamp-btn"
            onClick={onStampOpen}
            className="press-3d fixed right-[calc(max(1rem,calc(50%-14rem+1rem))+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-30 flex h-13 w-13 items-center justify-center rounded-full border-4 border-white bg-anniv [--shade:color-mix(in_srgb,var(--color-anniv)_60%,black_12%)]"
          >
            <Stamp className="h-6 w-6 text-ink" />
          </button>
          <Fab tut="fab" label="일정 추가" icon={<Plus className="h-8 w-8" strokeWidth={3} />} />
        </>
      )}
    </div>
  )
}

// ── 일정 만들기 ──

function EditorDemo({
  day,
  draft,
  onQuick,
  onSave,
}: {
  day: DateKey
  draft: { start: string; min: number; title: string; owner: 'us' | 'me' | 'partner' }
  onQuick: () => void
  onSave: () => void
}) {
  const { couple, me, partner } = useCoupleCtx()
  const end = toTimeInput(new Date(combine(day, draft.start).getTime() + draft.min * 60_000))
  const owners = [
    { key: 'us', label: '우리', avatar: US_AVATAR, color: couple.us_color },
    { key: 'me', label: me.nickname, avatar: me.avatar, color: me.color },
    { key: 'partner', label: partner!.nickname, avatar: partner!.avatar, color: partner!.color },
  ] as const
  return (
    <div className="flex flex-col gap-4 px-4 pb-10">
      <header className="flex h-14 items-center gap-2">
        <ChevronLeft className="h-6 w-6 text-ink-soft" />
        <h1 className="flex-1 text-[22px]">새 일정</h1>
        <button
          type="button"
          data-tut="ed-save"
          onClick={onSave}
          className="font-display press-3d h-11 rounded-full bg-accent px-5 text-[17px] text-white [--shade:var(--color-accent-deep)]"
        >
          저장
        </button>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">빠른 선택</span>
        <div className="flex gap-2">
          {[
            ['🏋️', '운동', me.color],
            ['💕', '데이트', couple.us_color],
            ['🧘', '필라테스', me.color],
          ].map(([emoji, label, color]) => (
            <button
              key={label}
              type="button"
              data-tut={label === '데이트' ? 'ed-quick' : undefined}
              onClick={label === '데이트' ? onQuick : undefined}
              className="font-display press-3d flex h-11 items-center gap-1.5 rounded-full border-2 px-3.5"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 22%, white)`, borderColor: color }}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      <input
        readOnly
        value={draft.title}
        placeholder="일정 제목"
        className="font-display h-14 rounded-[22px] border-2 border-accent bg-surface px-4 text-xl outline-none placeholder:text-ink-soft/60"
      />

      <div data-tut="ed-owner" className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">누구의 일정인가요?</span>
        <div className="grid grid-cols-3 gap-2">
          {owners.map((o) => {
            const active = draft.owner === o.key
            return (
              <span
                key={o.key}
                className={`font-display flex h-12 items-center justify-center gap-1 truncate rounded-full border-2 px-2 ${active ? 'shadow-[0_3px_0_var(--color-line-deep)]' : 'border-line bg-surface text-ink-soft'}`}
                style={active ? { backgroundColor: o.color, borderColor: o.color } : undefined}
              >
                {o.avatar} <span className="truncate">{o.label}</span>
              </span>
            )
          })}
        </div>
      </div>

      <div data-tut="ed-time" className="flex flex-col gap-2 rounded-[28px] border-2 border-line bg-surface p-4">
        <span className="text-sm font-bold text-ink-soft">시작</span>
        <div className="flex gap-2">
          <DateButton value={day} onChange={() => {}} className="flex-1" />
          <TimeButton value={draft.start} onChange={() => {}} />
        </div>
        <span className="text-sm font-bold text-ink-soft">끝</span>
        <div className="flex gap-2">
          <DateButton value={day} onChange={() => {}} className="flex-1" />
          <TimeButton value={end} onChange={() => {}} />
        </div>
      </div>

      <div data-tut="ed-visibility" className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">공개 범위</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            [Users, '같이 보기', '둘 다 봐요'],
            [Lock, '바쁨으로만', '내용은 숨김'],
            [EyeOff, '나만 보기', '나만 봐요'],
          ].map(([Icon, label, sub], idx) => {
            const I = Icon as typeof Users
            return (
              <span
                key={label as string}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 text-center ${idx === 0 ? 'border-accent bg-partner/20' : 'border-line bg-surface'}`}
              >
                <I className="h-5 w-5" />
                <span className="font-display text-[14px]">{label as string}</span>
                <span className="text-[11px] text-ink-soft">{sub as string}</span>
              </span>
            )
          })}
        </div>
      </div>

      <div data-tut="ed-place" className="flex gap-2">
        <span className="flex h-12 flex-1 items-center rounded-2xl border-2 border-line bg-surface px-4 text-ink-soft/70">장소</span>
        <span className="font-display press-3d flex h-12 items-center gap-1 rounded-2xl border-2 border-line bg-surface px-3.5">
          <MapIcon className="h-4 w-4" /> 찾기
        </span>
      </div>
    </div>
  )
}

// ── 위시 ──

function Thumb({ hue, emoji, className = '' }: { hue: number; emoji: string; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl text-3xl ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 82%), hsl(${hue + 30} 80% 66%))` }}
    >
      {emoji}
    </span>
  )
}

function WishDemo({ emit }: { emit: (ev: string) => void }) {
  const [wishes, setWishes] = useState<DemoWish[]>(DEMO_WISHES)
  const [sheet, setSheet] = useState(false)
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<(typeof DEMO_PLACES)[number] | null>(null)

  return (
    <div className="pb-28">
      <Header title="위시" />
      <div className="flex gap-1.5 px-4 pb-3">
        {['전체', '맛집', '여행', '데이트', '기타'].map((t, idx) => (
          <span
            key={t}
            className={`font-display rounded-full border-2 px-3 py-1 text-sm ${idx === 0 ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink-soft'}`}
          >
            {t}
          </span>
        ))}
      </div>
      <ul data-tut="wish-list" className="flex flex-col gap-3 px-4">
        {wishes.map((w, idx) => (
          <li key={w.id} className="animate-pop rounded-[26px] border-2 border-line bg-surface p-3 shadow-[0_4px_0_var(--color-line)]">
            <div className="flex gap-3">
              <Thumb hue={w.hue} emoji={w.emoji} className="h-20 w-20" />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-accent-deep">{w.tag}</span>
                <p className="font-display truncate text-[17px]">{w.title}</p>
                {w.place && (
                  <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {w.place}
                  </p>
                )}
                {w.note && <p className="truncate text-xs text-ink-soft">{w.note}</p>}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <span
                data-tut={idx === 0 ? 'wish-plan' : undefined}
                className="font-display flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-partner/30 text-sm"
              >
                <CalendarPlus className="h-4 w-4" /> 날짜 잡기
              </span>
              <span className="font-display flex h-9 flex-1 items-center justify-center gap-1 rounded-full border-2 border-line text-sm text-ink-soft">
                <Check className="h-4 w-4" /> 해냈어요
              </span>
            </div>
          </li>
        ))}
      </ul>
      <Fab
        tut="wish-add"
        label="위시 추가"
        icon={<Plus className="h-8 w-8" strokeWidth={3} />}
        onClick={() => {
          setSheet(true)
          emit('wish-add')
        }}
      />

      {sheet && (
        <DemoSheet title="위시 담기">
          <div className="flex flex-col gap-3">
            <input
              readOnly
              value={picked?.name ?? ''}
              placeholder="하고 싶은 것"
              className="font-display h-13 rounded-2xl border-2 border-line bg-surface px-4 text-lg outline-none placeholder:text-ink-soft/60"
            />
            {picked ? (
              <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
                <Thumb hue={picked.hue} emoji="📍" className="h-12 w-12 text-xl" />
                <div className="min-w-0">
                  <p className="font-display truncate">{picked.name}</p>
                  <p className="truncate text-xs text-ink-soft">{picked.address}</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-tut="wish-place"
                onClick={() => {
                  setSearching(true)
                  emit('wish-place')
                }}
                className="font-display press-3d flex h-12 items-center justify-center gap-1.5 rounded-2xl border-2 border-line bg-surface"
              >
                <MapIcon className="h-4 w-4" /> 장소 찾기
              </button>
            )}
            {searching && !picked && (
              <div className="flex flex-col gap-1.5">
                <div className="flex h-11 items-center gap-2 rounded-full border-2 border-accent bg-surface px-4">
                  <Search className="h-4 w-4 text-ink-soft" /> 성수
                </div>
                {DEMO_PLACES.map((pl, idx) => (
                  <button
                    key={pl.name}
                    type="button"
                    data-tut={idx === 0 ? 'wish-result' : undefined}
                    onClick={() => {
                      if (idx !== 0) return
                      setPicked(pl)
                      emit('wish-result')
                    }}
                    className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-2.5 text-left"
                  >
                    <Thumb hue={pl.hue} emoji="📍" className="h-11 w-11 text-xl" />
                    <span className="min-w-0">
                      <span className="font-display block truncate">{pl.name}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {pl.category} · {pl.address}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              data-tut="wish-save"
              disabled={!picked}
              onClick={() => {
                if (!picked) return
                setWishes((ws) => [
                  { id: 'new', title: picked.name, tag: '맛집', emoji: '🍲', place: picked.address, note: '다음 주말에 가자!', hue: picked.hue },
                  ...ws,
                ])
                setSheet(false)
                celebrate()
                emit('wish-save')
              }}
              className="font-display press-3d h-13 rounded-full bg-accent text-lg text-white [--shade:var(--color-accent-deep)] disabled:opacity-40"
            >
              담기
            </button>
          </div>
        </DemoSheet>
      )}
    </div>
  )
}

// ── 추억 ──

function MemoriesDemo({ emit }: { emit: (ev: string) => void }) {
  const { me, partner } = useCoupleCtx()
  const [view, setView] = useState<'feed' | 'grid'>('feed')
  const [liked, setLiked] = useState(false)
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)
  const photo = DEMO_PHOTOS[0]

  function onTap() {
    const now = Date.now()
    if (now - lastTap.current < 350) {
      setBurst((b) => b + 1)
      setLiked(true)
      emit('post-like')
    }
    lastTap.current = now
  }

  return (
    <div className="pb-28">
      <Header
        title="추억"
        right={
          <>
            <button type="button" onClick={() => setView('feed')} className={`flex h-10 w-10 items-center justify-center ${view === 'feed' ? 'text-accent' : 'text-ink-soft'}`}>
              <Rows3 className="h-5 w-5" />
            </button>
            <button
              type="button"
              data-tut="mem-grid"
              onClick={() => {
                setView('grid')
                emit('mem-grid')
              }}
              className={`flex h-10 w-10 items-center justify-center ${view === 'grid' ? 'text-accent' : 'text-ink-soft'}`}
            >
              <Grid3x3 className="h-5 w-5" />
            </button>
          </>
        }
      />
      {view === 'grid' ? (
        <div className="grid grid-cols-3 gap-0.5 px-1">
          {[...DEMO_PHOTOS, ...DEMO_PHOTOS.slice(0, 3)].map((ph, idx) => (
            <span
              key={idx}
              className="flex aspect-square items-center justify-center rounded-md text-4xl"
              style={{ background: `linear-gradient(135deg, ${ph.from}, ${ph.to})` }}
            >
              {ph.emoji}
            </span>
          ))}
        </div>
      ) : (
        <div className="px-3">
          <article className="overflow-hidden rounded-[28px] border-2 border-line bg-surface shadow-[0_5px_0_var(--color-line)]">
            <header className="flex items-center gap-2.5 px-3.5 py-3">
              <div className="flex -space-x-2">
                {[me, partner!].map((m) => (
                  <span key={m.id} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-lg" style={{ backgroundColor: m.color }}>
                    {m.avatar}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-display block truncate text-[16px]">성수 저녁 데이트</span>
                <span className="block truncate text-xs text-ink-soft">지난 토요일 · 성수동</span>
              </div>
            </header>
            <div
              data-tut="post-photo"
              onClick={onTap}
              className="relative flex aspect-square touch-manipulation items-center justify-center text-[110px]"
              style={{ background: `linear-gradient(135deg, ${photo.from}, ${photo.to})` }}
            >
              {photo.emoji}
              <span className="font-display absolute top-3 right-3 rounded-full bg-ink/50 px-2.5 py-0.5 text-xs text-white">1/3</span>
              {burst > 0 && (
                <Heart
                  key={burst}
                  className="animate-pop pointer-events-none absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow-lg"
                />
              )}
            </div>
            <div data-tut="post-footer" className="flex flex-col gap-1.5 px-3.5 pt-2.5 pb-3.5">
              <div className="flex items-center gap-1">
                <Heart className={`h-7 w-7 ${liked ? 'animate-pop fill-accent text-accent' : ''}`} />
                <span className="flex h-10 items-center gap-1 px-2">
                  <MessageCircle className="h-7 w-7" />
                  <span className="text-sm font-bold">2</span>
                </span>
                <div className="mx-auto flex gap-1 pr-16">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className={`h-1.5 w-1.5 rounded-full ${d === 0 ? 'bg-accent' : 'bg-line-deep'}`} />
                  ))}
                </div>
              </div>
              {liked && <p className="text-sm font-bold">{me.nickname}님이 좋아해요</p>}
              <p className="text-[15px]">노을 진짜 예뻤다 🧡</p>
            </div>
          </article>
        </div>
      )}
      <Fab tut="mem-upload" label="사진 올리기" icon={<ImagePlus className="h-7 w-7" />} />
    </div>
  )
}

// ── 기념일 ──

function AnnivDemo() {
  const { couple, me, partner } = useCoupleCtx()
  const days = daysTogether(couple.started_on)
  return (
    <div className="flex flex-col gap-4 px-4 pb-10">
      <Header title="기념일" />
      <section
        data-tut="an-hero"
        className="flex flex-col items-center gap-2 overflow-hidden rounded-[28px] border-2 border-line bg-surface pb-5 shadow-[0_5px_0_var(--color-line)]"
      >
        <div className="flex h-28 w-full items-end justify-center bg-gradient-to-br from-partner/60 to-us/60 pb-1">
          <Mascot size={120} left={me.color} right={partner!.color} />
        </div>
        <p className="text-sm text-ink-soft">우리가 함께한 지</p>
        <p className="font-display text-[56px] leading-none text-accent-deep">
          {days.toLocaleString()}
          <span className="ml-1 text-2xl text-ink">일째</span>
        </p>
        <span data-tut="an-rule" className="font-display rounded-full bg-bg px-3.5 py-1.5 text-sm text-ink-soft">
          {couple.day_every ? `${couple.day_every}일마다` : '안 챙김'} · 바꾸기
        </span>
      </section>
      <section data-tut="an-calc" className="rounded-[28px] border-2 border-line bg-surface p-4 shadow-[0_5px_0_var(--color-line)]">
        <h2 className="mb-2">날짜 계산기</h2>
        <div className="grid grid-cols-2 gap-2">
          <span className="font-display flex h-11 items-center justify-center rounded-full bg-partner/40">N일째는 언제?</span>
          <span className="font-display flex h-11 items-center justify-center rounded-full border-2 border-line text-ink-soft">
            이 날은 며칠째?
          </span>
        </div>
      </section>
      <section className="rounded-[28px] border-2 border-line bg-surface p-4 shadow-[0_5px_0_var(--color-line)]">
        <div className="mb-2 flex items-center justify-between">
          <h2>우리 기념일</h2>
          <span data-tut="an-add" className="flex h-9 items-center gap-1 rounded-full bg-partner/30 px-3 text-sm font-semibold">
            <Plus className="h-4 w-4" /> 추가
          </span>
        </div>
        {[
          ['🌸', '처음 만난 날', '매년 · D-23'],
          ['💍', '결혼기념일', '2029.5.12 · D-940'],
        ].map(([e, t, s]) => (
          <div key={t} className="flex items-center gap-3 py-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-bg text-xl">{e}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t}</span>
              <span className="block text-xs text-ink-soft">{s}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}

// ── 설정 ──

function SettingsDemo() {
  const card = 'rounded-[28px] border-2 border-line bg-surface p-4 shadow-[0_5px_0_var(--color-line)]'
  return (
    <div className="flex flex-col gap-4 px-4 pb-10">
      <Header title="설정" />
      <section data-tut="set-push" className={card}>
        <h2>알림</h2>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm">새 일정 · 댓글 알림 받기</span>
          <span className="flex h-7 w-12 items-center rounded-full bg-accent p-0.5">
            <span className="ml-auto h-6 w-6 rounded-full bg-white" />
          </span>
        </div>
      </section>
      <section data-tut="set-theme" className={card}>
        <h2 className="mb-2">테마</h2>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((t) => (
            <span key={t.id} className="flex flex-col items-center gap-1">
              <span className="flex aspect-square w-full flex-col justify-end gap-1 rounded-2xl border-2 border-line p-1.5" style={{ backgroundColor: t.bg }}>
                <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: t.soft }} />
                <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: t.accent }} />
              </span>
              <span className="text-xs text-ink-soft">{t.label}</span>
            </span>
          ))}
        </div>
      </section>
      <section data-tut="set-external" className={card}>
        <h2>회사 캘린더 연결</h2>
        <p className="mt-1 text-sm text-ink-soft">구글·아웃룩 캘린더 주소를 넣으면 30분마다 '바쁨'으로 가져와요</p>
      </section>
      <section data-tut="set-poker" className={card}>
        <h2>같이 놀기</h2>
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-partner/40 text-2xl">🃏</span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-lg leading-tight">몽글 인디언 포커</span>
            <span className="block text-xs text-ink-soft">내 카드는 나만 몰라요. 표정으로 승부!</span>
          </span>
        </div>
      </section>
      <section data-tut="set-tutorial" className={card}>
        <h2>사용법</h2>
        <span className="font-display press-3d mt-2 flex h-12 items-center justify-center rounded-full border-2 border-line bg-surface">
          사용법 다시 보기
        </span>
      </section>
    </div>
  )
}
