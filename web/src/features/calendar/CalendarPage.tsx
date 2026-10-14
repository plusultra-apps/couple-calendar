import { addMonths, format, isValid, startOfMonth } from 'date-fns'
import { Bell, ChevronLeft, ChevronRight, CircleHelp, Heart, Plus, SlidersHorizontal, Stamp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { US_AVATAR, useCoupleCtx, useOwnerInfo } from '../../app/couple'
import { IconButton } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { Button, EmptyState, ErrorText, Toggle } from '../../components/ui'
import { daysTogether } from '../../lib/anniversary'
import { fmtDay, fromKey, monthGrid, toKey, todayKey, type DateKey } from '../../lib/dates'
import { holidayNames } from '../../lib/holidays'
import { solarToLunar } from '../../lib/lunar'
import { ItemRow } from './ItemRow'
import { useCalendarItems, useFilters, type CalItem } from './items'
import { MonthGrid, type DayPhoto } from './MonthGrid'
import { PhotoModeButton } from './PhotoModeButton'
import { StampTray, useStamp } from '../quick/StampTray'
import { PhotoGrid, PhotoUploadButton } from '../photos/PhotoGrid'
import { byDayOrder, useMonthPhotos, usePhotos, useReorderPhotos } from '../photos/queries'
import { useSignedUrls } from '../../lib/photos'
import { toMessage } from '../../lib/supabase'
import { DayFreeTime } from '../free/DayFreeTime'
import { useUnreadCount } from '../notifications/queries'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const PHOTO_MODE_KEY = 'ourcal.cal.photoMode'

// 사진 보기 켜짐 여부 (휴대폰마다 기억)
function usePhotoMode() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(PHOTO_MODE_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = () => {
    try {
      localStorage.setItem(PHOTO_MODE_KEY, on ? '0' : '1')
    } catch {
      /* 저장 실패는 무시 */
    }
    setOn(!on)
  }
  return [on, toggle] as const
}

// 날짜별 대표 사진 → 달력 칸 그림. 서명 링크는 사진 보기일 때만 받는다.
function useDayPhotos(from: DateKey, to: DateKey, photoMode: boolean) {
  const { data } = useMonthPhotos(from, to)
  const urls = useSignedUrls(photoMode && data ? Object.values(data).map((d) => d.photo.thumb_path) : [])
  return useMemo(() => {
    const map: Partial<Record<DateKey, DayPhoto>> = {}
    for (const [day, d] of Object.entries(data ?? {})) map[day] = { url: urls.data?.[d.photo.thumb_path], count: d.count }
    return map
  }, [data, urls.data])
}

export function CalendarPage() {
  const { couple } = useCoupleCtx()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useFilters()
  const [filterOpen, setFilterOpen] = useState(false)

  // 보고 있는 달(?m=2026-10)과 열린 날짜(?d=2026-10-05)를 주소에 둬서 뒤로가기로 닫히게 한다
  const dayParam = params.get('d')
  const openDay = dayParam && isValid(fromKey(dayParam)) ? dayParam : null
  // ?m 이 없으면 열린 날짜의 달, 그것도 없으면 이번 달. 잘못된 값은 무시한다.
  const monthParam = params.get('m') ?? openDay?.slice(0, 7)
  const month = useMemo(() => {
    const m = monthParam ? fromKey(`${monthParam}-01`) : null
    return startOfMonth(m && isValid(m) ? m : new Date())
  }, [monthParam])
  const days = useMemo(() => monthGrid(month), [month])
  const from = toKey(days[0])
  const to = toKey(days[41])
  const { items, error } = useCalendarItems(from, to, filters)
  // 비는 시간은 보기 필터와 상관없이 둘의 모든 일정으로 계산
  const { items: allItems } = useCalendarItems(from, to)
  const stamp = useStamp(items)
  const [photoMode, togglePhotoMode] = usePhotoMode()
  const unread = useUnreadCount()
  const photos = useDayPhotos(from, to, photoMode)

  const goMonth = (m: Date) => setParams({ m: format(m, 'yyyy-MM') }, { replace: true })
  const selectDay = (key: DateKey) => {
    const m = key.slice(0, 7)
    setParams({ m, d: key })
  }
  // 앱 안에서 연 시트는 뒤로가기로 닫고, 주소로 바로 열린 경우엔 주소에서 d 만 지운다
  const closeDay = () => {
    if (!openDay) return
    if (location.key === 'default') setParams({ m: format(month, 'yyyy-MM') }, { replace: true })
    else navigate(-1)
  }

  // 좌우 스와이프로 달 이동
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goMonth(addMonths(month, dx < 0 ? 1 : -1))
  }

  const isThisMonth = format(month, 'yyyy-MM') === todayKey().slice(0, 7)

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-0.5 px-3 pt-[calc(env(safe-area-inset-top)+0.6rem)] pb-1.5">
        <button
          type="button"
          onClick={() => goMonth(startOfMonth(new Date()))}
          className="flex items-baseline gap-1.5 rounded-2xl px-1.5 py-0.5 active:scale-95"
        >
          <span className="font-display text-[28px] leading-none">
            {format(month, 'M월')}
          </span>
          <span className="font-display text-sm text-ink-soft">{format(month, 'yyyy')}</span>
          {!isThisMonth && (
            <span className="font-display animate-pop rounded-full bg-accent px-2 py-0.5 text-xs text-white">오늘로</span>
          )}
        </button>
        <span className="flex-1" />
        <Link
          to="/anniv"
          className="font-display press-3d flex items-center gap-1 rounded-full border-2 border-partner bg-surface px-3 py-1 text-base text-accent-deep [--shade:var(--color-partner)]"
        >
          <Heart className="animate-heartbeat h-4 w-4 fill-accent text-accent" />
          {daysTogether(couple.started_on).toLocaleString()}일
        </Link>
        <IconButton label={unread ? `알림 ${unread}개` : '알림'} onClick={() => navigate('/notifications')} className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="font-display animate-pop absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg bg-accent px-1 text-[10px] leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </IconButton>
        <IconButton label="사용법" onClick={() => navigate('/tutorial')} className="text-ink-soft">
          <CircleHelp className="h-5 w-5" />
        </IconButton>
        <IconButton label="보기 설정" onClick={() => setFilterOpen(true)}>
          <SlidersHorizontal className="h-5 w-5" />
        </IconButton>
      </header>

      <ViewSwitch filters={filters} onChange={setFilters} photoMode={photoMode} onPhotoMode={togglePhotoMode} />

      {error && <p className="px-4 text-xs text-holiday">일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

      <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-2 border-line bg-surface shadow-[0_5px_0_var(--color-line)]">
        <div className="flex shrink-0 items-center gap-1 px-1.5 pt-1.5">
          <IconButton label="이전 달" onClick={() => goMonth(addMonths(month, -1))} className="h-8 w-8">
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <div className="font-display grid flex-1 grid-cols-7 text-center text-[13px] text-ink-soft">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={i === 0 ? 'text-holiday' : i === 6 ? 'text-sat' : ''}>
                {w}
              </span>
            ))}
          </div>
          <IconButton label="다음 달" onClick={() => goMonth(addMonths(month, 1))} className="h-8 w-8">
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="flex min-h-0 flex-1 flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <MonthGrid
            month={month}
            days={days}
            items={items}
            selected={openDay}
            onSelect={stamp.active && stamp.stamp ? stamp.stampDay : selectDay}
            photos={photos}
            photoMode={photoMode && !stamp.active}
          />
        </div>
      </div>

      {stamp.active ? (
        <StampTray stamp={stamp.stamp} onPick={stamp.setStamp} onClose={stamp.close} toast={stamp.toast} />
      ) : (
        <button
          type="button"
          aria-label="도장 찍기"
          onClick={stamp.open}
          className="press-3d fixed right-[calc(max(1rem,calc(50%-14rem+1rem))+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-30 flex h-13 w-13 items-center justify-center rounded-full border-4 border-white bg-anniv text-2xl [--shade:color-mix(in_srgb,var(--color-anniv)_60%,black_12%)]"
        >
          <Stamp className="h-6 w-6 text-ink" />
        </button>
      )}

      {!stamp.active && <button
        type="button"
        aria-label="일정 추가"
        onClick={() => navigate(`/event/new?date=${openDay ?? (isThisMonth ? todayKey() : toKey(month))}`)}
        className="press-3d fixed right-[max(1rem,calc(50%-14rem+1rem))] bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-30 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-accent text-white [--shade:var(--color-accent-deep)]"
      >
        <Plus className="h-8 w-8" strokeWidth={3} />
      </button>}

      <DaySheet day={openDay} items={items} allItems={allItems} onClose={closeDay} />

      <Sheet open={filterOpen} onOpenChange={setFilterOpen} title="보기 설정">
        <FilterList filters={filters} onChange={setFilters} />
      </Sheet>
    </div>
  )
}

// 누구 일정을 볼지 한 번에: 전체 / 내 것만 / 상대 것만
function ViewSwitch({
  filters,
  onChange,
  photoMode,
  onPhotoMode,
}: {
  filters: ReturnType<typeof useFilters>[0]
  onChange: ReturnType<typeof useFilters>[1]
  photoMode: boolean
  onPhotoMode: () => void
}) {
  const { me, partner, couple } = useCoupleCtx()
  const mode =
    filters.me && filters.partner && filters.us
      ? 'all'
      : !filters.me && !filters.partner && filters.us
        ? 'us'
        : filters.me && !filters.partner && !filters.us
          ? 'me'
          : !filters.me && filters.partner && !filters.us
            ? 'partner'
            : null
  const options: { key: string; label: string; avatar?: string; color: string; patch: Partial<typeof filters> }[] = [
    { key: 'all', label: '전체', color: 'var(--color-partner)', patch: { me: true, partner: true, us: true } },
    { key: 'us', label: '우리', avatar: US_AVATAR, color: couple.us_color, patch: { me: false, partner: false, us: true } },
    { key: 'me', label: '나', avatar: me.avatar, color: me.color, patch: { me: true, partner: false, us: false } },
    ...(partner
      ? [
          {
            key: 'partner',
            label: `${partner.nickname}`,
            avatar: partner.avatar,
            color: partner.color,
            patch: { me: false, partner: true, us: false },
          },
        ]
      : []),
  ]
  return (
    <div className="flex shrink-0 gap-1.5 px-3 pb-2">
      {options.map((o) => {
        const active = mode === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.patch)}
            className={`font-display flex h-9 min-w-0 items-center gap-1 rounded-full border-2 px-3 text-[14px] transition active:scale-95 ${
              active ? 'animate-pop text-ink shadow-[0_3px_0_var(--color-line-deep)]' : 'border-line bg-surface/80 text-ink-soft'
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
  )
}

function DaySheet({
  day,
  items,
  allItems,
  onClose,
}: {
  day: DateKey | null
  items: CalItem[]
  allItems: CalItem[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const owner = useOwnerInfo()
  // 닫히는 애니메이션 동안 내용 유지
  const lastDay = useRef<DateKey | null>(null)
  if (day) lastDay.current = day
  const key = day ?? lastDay.current

  const dayItems = key ? items.filter((i) => i.startKey <= key && i.endKey >= key) : []
  const lunar = key ? solarToLunar(fromKey(key)) : null
  const holidays = key ? holidayNames(key) : []

  return (
    <Sheet
      open={!!day}
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="flex items-baseline gap-2">
          {key && fmtDay(fromKey(key))}
          {lunar && (
            <span className="text-xs font-normal text-ink-soft">
              음력 {lunar.leap ? '윤' : ''}
              {lunar.month}.{lunar.day}
            </span>
          )}
          {holidays.length > 0 && <span className="text-sm font-semibold text-holiday">{holidays.join(' · ')}</span>}
        </span>
      }
      footer={
        <div className="flex items-center gap-2">
          {/* 이 날짜로 사진 올리기 (일정이 없는 날도) */}
          {key && <PhotoUploadButton takenOn={key} label="사진" className="w-[38%] shrink-0" />}
          <Button onClick={() => navigate(`/event/new?date=${key}`)} className="flex-1">
            <span className="flex items-center justify-center gap-1">
              <Plus className="h-5 w-5" /> 일정 추가
            </span>
          </Button>
        </div>
      }
    >
      {key && <DayPhotos date={key} />}
      {key && <DayFreeTime day={key} items={allItems} />}
      {dayItems.length === 0 ? (
        <EmptyState emoji="🌷" title="일정이 없어요">
          둘이 함께할 계획을 세워 볼까요?
        </EmptyState>
      ) : (
        <div className="flex flex-col">
          {dayItems.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              day={key!}
              ownerName={item.kind === 'anniv' ? undefined : owner(item.ownerId).name}
              onClick={
                item.kind === 'event'
                  ? () => navigate(`/event/${item.event!.id}?date=${item.startKey}`)
                  : item.kind === 'anniv'
                    ? () => navigate('/anniv')
                    : undefined
              }
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}

function FilterList({
  filters,
  onChange,
}: {
  filters: ReturnType<typeof useFilters>[0]
  onChange: ReturnType<typeof useFilters>[1]
}) {
  const { me, partner, couple } = useCoupleCtx()
  const dot = (color: string) => <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
  return (
    <div className="flex flex-col divide-y divide-line">
      <Toggle checked={filters.me} onChange={(v) => onChange({ me: v })} label={<>{dot(me.color)}내 일정</>} />
      {partner && (
        <Toggle
          checked={filters.partner}
          onChange={(v) => onChange({ partner: v })}
          label={
            <>
              {dot(partner.color)}
              {partner.nickname}의 일정
            </>
          }
        />
      )}
      <Toggle checked={filters.us} onChange={(v) => onChange({ us: v })} label={<>{dot(couple.us_color)}우리 일정</>} />
      <Toggle
        checked={filters.busy}
        onChange={(v) => onChange({ busy: v })}
        label={<>{dot('var(--color-busy)')}회사 일정 (바쁨)</>}
        description="설정에서 연결한 외부 캘린더"
      />
      <Toggle checked={filters.anniv} onChange={(v) => onChange({ anniv: v })} label={<>{dot('var(--color-anniv)')}기념일</>} />
    </div>
  )
}

// 그날 찍은 사진 (있을 때만). 꾹 눌러 끌어서 순서를 바꾸면 맨 앞 사진이 달력 사진 보기의 대표가 된다.
function DayPhotos({ date }: { date: DateKey }) {
  const photos = usePhotos({ date })
  const reorder = useReorderPhotos()
  const sorted = useMemo(() => [...(photos.data ?? [])].sort(byDayOrder), [photos.data])
  if (!sorted.length) return null
  return (
    <div className="mb-3">
      <PhotoGrid photos={sorted} cols={4} onReorder={(list) => reorder.mutateAsync(list)} />
      {sorted.length > 1 && <p className="mt-1 px-1 text-[11px] text-ink-soft">사진을 꾹 눌러 끌면 순서가 바뀌어요 · 맨 앞 사진이 달력 대표</p>}
      {reorder.error && <ErrorText>{toMessage(reorder.error)}</ErrorText>}
    </div>
  )
}
