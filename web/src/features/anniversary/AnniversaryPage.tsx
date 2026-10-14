import { Cake, Calculator, Check, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { PageHeader } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { LunarDateInput } from '../../components/LunarDateInput'
import { DayRulePicker } from './DayRulePicker'
import { useUpdateCouple } from '../settings/queries'
import { CoverProfiles } from '../photos/CoverProfiles'
import { AlbumSection } from '../photos/AlbumSection'
import { PhotoGrid } from '../photos/PhotoGrid'
import { usePhotos } from '../photos/queries'
import { Button, Card, EmptyState, ErrorText, Input, Segmented, Spinner } from '../../components/ui'
import { DateButton } from '../../components/DateTimePicker'
import {
  anniversariesBetween,
  dateOfDay,
  dayCountOn,
  dayLabel,
  type DayRule,
  customDayRule,
  daysTogether,
  dday,
  upcomingAnniversaries,
  type AnnivItem,
} from '../../lib/anniversary'
import { addDaysKey, diffDays, fmt, fmtDay, fromKey, todayKey } from '../../lib/dates'
import { solarToLunar } from '../../lib/lunar'
import { toMessage } from '../../lib/supabase'
import type { Anniversary, Photo } from '../../types/database'
import {
  useCustomAnniversaries,
  useDeleteAnniversary,
  useSaveAnniversary,
  type AnnivDraft,
} from './queries'

const EMOJIS = ['🎉', '💍', '🌸', '✈️', '🏠', '🎂', '🐶', '💐', '💌', '🍰'] as const

const dotDate = (key: string) => fmt(fromKey(key), 'yyyy.M.d')

export function AnniversaryPage() {
  const customs = useCustomAnniversaries()
  const [editing, setEditing] = useState<Anniversary | 'new' | null>(null)

  return (
    <div className="pb-8">
      <PageHeader title="기념일" />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <HeroCard />
        <DayCalculator />
        <BirthdayHint />

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">우리 기념일</h2>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="flex h-9 items-center gap-1 rounded-full bg-partner/30 px-3 text-sm font-semibold active:bg-partner/50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              추가
            </button>
          </div>
          <CustomList
            isPending={customs.isPending}
            error={customs.error}
            items={customs.data ?? []}
            onRetry={() => customs.refetch()}
            onSelect={setEditing}
          />
        </Card>

        <PastMilestones />
        <AlbumSection />
      </div>

      <AnnivSheet target={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

// ── 사귄 날 기준 N일째 챙기는 방식 ──
function CoupleDaysButton() {
  const { couple } = useCoupleCtx()
  const update = useUpdateCouple(couple.id)
  const [open, setOpen] = useState(false)
  const [rule, setRule] = useState<DayRule>({ every: couple.day_every, marks: couple.day_marks })
  const [error, setError] = useState('')
  const summary = [couple.day_every ? `${couple.day_every}일마다` : '', ...couple.day_marks.map(dayLabel)]
    .filter(Boolean)
    .join(' · ')

  async function save() {
    setError('')
    try {
      await update.mutateAsync({ day_every: rule.every, day_marks: rule.marks })
      setOpen(false)
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRule({ every: couple.day_every, marks: couple.day_marks })
          setOpen(true)
        }}
        className="font-display mt-3 inline-flex items-center gap-1 rounded-full bg-surface/70 px-3 py-1 text-xs text-ink-soft active:bg-surface"
      >
        {summary || 'N일째는 안 챙겨요'} · 바꾸기
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="며칠마다 챙길까요?"
        footer={
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? '저장 중…' : '저장'}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-ink-soft">사귄 날을 1일째로 세요. 둘이 챙기는 날만 골라 두면 달력과 알림에 그날만 나와요.</p>
        <DayRulePicker value={rule} onChange={setRule} />
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      </Sheet>
    </>
  )
}

// ── 날짜 계산기: 이 날은 며칠째? / N일째는 언제? ──
function DayCalculator() {
  const { couple } = useCoupleCtx()
  const [mode, setMode] = useState<'count' | 'date'>('date')
  const [date, setDate] = useState(todayKey())
  const [n, setN] = useState('1000')
  const base = couple.started_on
  const count = dayCountOn(base, date)
  const num = Number(n)
  const target = Number.isInteger(num) && num > 0 && num < 100000 ? dateOfDay(base, num) : null

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-lg">
        <Calculator className="h-5 w-5 text-accent-deep" aria-hidden /> 날짜 계산기
      </h2>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'date', label: 'N일째는 언제?' },
          { value: 'count', label: '이 날은 며칠째?' },
        ]}
      />
      {mode === 'date' ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              value={n}
              onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              aria-label="며칠째"
              className="font-display h-12 w-28 rounded-2xl border-2 border-line bg-surface px-4 text-center text-xl outline-none focus:border-accent"
            />
            <span className="font-display text-lg">일째는</span>
          </label>
          {target && (
            <p className="animate-pop rounded-2xl bg-bg p-3 text-center">
              <span className="font-display text-xl text-accent-deep">{fmt(fromKey(target), 'yyyy년 M월 d일 (EEE)')}</span>
              <span className="mt-1 block text-sm text-ink-soft">{dday(target)}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <DateButton value={date} onChange={setDate} title="며칠째인지 볼 날" quick={false} />
          <p className="animate-pop rounded-2xl bg-bg p-3 text-center">
            {count >= 1 ? (
              <span className="font-display text-xl text-accent-deep">{count.toLocaleString()}일째</span>
            ) : (
              <span className="font-display text-xl text-ink-soft">사귀기 {(1 - count).toLocaleString()}일 전</span>
            )}
          </p>
        </div>
      )}
      <p className="text-xs text-ink-soft">사귄 날({dotDate(base)})을 1일째로 세요</p>
    </Card>
  )
}

// ── 상단 D-day 카드 ──
function HeroCard() {
  const { couple } = useCoupleCtx()
  const days = daysTogether(couple.started_on)
  // 다음 100일 단위 또는 주년
  const next = useMemo(
    () =>
      upcomingAnniversaries(
        { startedOn: couple.started_on, coupleDays: { every: couple.day_every, marks: couple.day_marks }, members: [], customs: [] },
        1,
      )[0] as AnnivItem | undefined,
    [couple.started_on, couple.day_every, couple.day_marks],
  )

  return (
    <section className="relative overflow-hidden rounded-[32px] border-2 border-partner/60 bg-linear-to-br from-partner/40 via-surface to-us/45 p-6 pt-4 text-center shadow-[0_6px_0_color-mix(in_srgb,var(--color-partner)_55%,white)]">
      <CoverProfiles />
      <p className="mt-3 text-sm text-ink-soft">우리가 함께한 지</p>
      <p className="font-display mt-1 text-6xl text-accent-deep">
        {days.toLocaleString()}
        <span className="ml-1 text-2xl text-ink">일째</span>
      </p>
      <p className="mt-2 text-sm text-ink-soft">{dotDate(couple.started_on)}부터</p>
      <CoupleDaysButton />
      {next && (
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-4 py-2 text-sm shadow-sm">
          <span aria-hidden>{next.emoji}</span>
          {dday(next.date) === 'D-DAY' ? (
            <span className="font-bold text-accent">오늘은 {next.title}이에요!</span>
          ) : (
            <span>
              <b>{next.title}</b>까지 <b className="text-accent">{dday(next.date)}</b>
              <span className="text-ink-soft"> · {fmtDay(fromKey(next.date))}</span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}


// ── 생일 미등록 안내 ──
function BirthdayHint() {
  const { me, partner } = useCoupleCtx()
  const meMissing = !me.birthday
  const partnerMissing = !!partner && !partner.birthday
  if (!meMissing && !partnerMissing) return null

  const body = meMissing
    ? '설정에서 등록할 수 있어요. 음력 생일도 괜찮아요'
    : `${partner!.nickname || '상대'}님이 설정에서 등록하면 돼요`

  const inner = (
    <div className="flex items-center gap-3 rounded-3xl bg-anniv/30 px-5 py-4">
      <Cake className="h-6 w-6 shrink-0 text-accent-deep" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">생일을 등록하면 자동으로 챙겨드려요</p>
        <p className="text-xs text-ink-soft">{body}</p>
      </div>
      {meMissing && <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />}
    </div>
  )
  return meMissing ? (
    <Link to="/settings" className="block active:opacity-80" aria-label="설정에서 생일 등록하기">
      {inner}
    </Link>
  ) : (
    inner
  )
}

// D-day 알약 (당일은 강조)
function DdayPill({ label }: { label: string }) {
  const today = label === 'D-DAY'
  return (
    <span
      className={`font-display shrink-0 rounded-full px-2.5 py-0.5 text-sm ${
        today ? 'animate-heartbeat bg-accent text-white' : 'bg-anniv/50 text-ink'
      }`}
    >
      {label}
    </span>
  )
}

// ── 사용자 정의 기념일 목록 ──
function CustomList({
  isPending,
  error,
  items,
  onRetry,
  onSelect,
}: {
  isPending: boolean
  error: unknown
  items: Anniversary[]
  onRetry: () => void
  onSelect: (a: Anniversary) => void
}) {
  if (isPending) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <ErrorText>{toMessage(error)}</ErrorText>
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-accent">
          다시 시도
        </button>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState emoji="💝" title="아직 등록한 기념일이 없어요">
        처음 만난 날, 첫 여행처럼
        <br />둘만의 날을 남겨 보세요
      </EmptyState>
    )
  }
  return (
    <ul className="-mx-1 flex flex-col">
      {items.map((a) => {
        const next = upcomingAnniversaries({ startedOn: null, members: [], customs: [a] }, 1, new Date(), 100)[0]
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-bg"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-xl" aria-hidden>
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.title}</p>
                <p className="text-xs text-ink-soft">
                  {lunarLabel(a) ?? dotDate(a.base_date)} · {a.kind === 'yearly' ? '매년' : '한 번'}
                  {(customDayRule(a).every || customDayRule(a).marks.length > 0) &&
                    a.base_date <= todayKey() &&
                    ` · ${(diffDays(todayKey(), a.base_date) + 1).toLocaleString()}일째`}
                </p>
              </div>
              {next ? (
                <DdayPill label={dday(next.date)} />
              ) : (
                <span className="shrink-0 text-xs text-ink-soft">지났어요</span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// 음력 기념일은 '음력 3.15' 처럼 음력 월·일로 보여준다 (base_date 는 실제 양력 날짜)
function lunarLabel(a: Anniversary): string | null {
  if (!a.is_lunar) return null
  const l = solarToLunar(fromKey(a.base_date))
  return l ? `음력 ${l.leap ? '윤' : ''}${l.month}.${l.day}` : null
}

// ── 지나온 기념일 (100일 단위 · 주년) ──
function PastMilestones() {
  const { couple } = useCoupleCtx()
  const [open, setOpen] = useState(false)
  const past = useMemo(() => {
    const yesterday = addDaysKey(todayKey(), -1)
    if (yesterday < couple.started_on) return []
    return anniversariesBetween(
      { startedOn: couple.started_on, coupleDays: { every: couple.day_every, marks: couple.day_marks }, members: [], customs: [] },
      couple.started_on,
      yesterday,
    )
      .filter((i) => i.kind === 'days' || i.kind === 'years')
      .reverse()
  }, [couple.started_on, couple.day_every, couple.day_marks])
  const photos = usePhotos()
  const photosByDate = useMemo(() => {
    const map = new Map<string, Photo[]>()
    for (const p of photos.data ?? []) map.set(p.taken_on, [...(map.get(p.taken_on) ?? []), p])
    return map
  }, [photos.data])

  if (past.length === 0) return null

  return (
    <Card className="p-0!">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-bold">
          지나온 기념일 <span className="ml-1 text-sm font-semibold text-ink-soft">{past.length}</span>
        </span>
        <ChevronDown className={`h-5 w-5 text-ink-soft transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="flex flex-col px-4 pb-4">
          {past.map((item) => (
            <li key={item.key} className="flex flex-col gap-2 px-1 py-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-us/40">
                  <Check className="h-4 w-4" aria-label="지남" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {item.emoji} {item.title}
                </span>
                <span className="shrink-0 text-xs text-ink-soft">{dotDate(item.date)}</span>
              </div>
              {/* 그날 찍은 사진 */}
              {photosByDate.get(item.date) && (
                <div className="pl-10">
                  <PhotoGrid photos={photosByDate.get(item.date)!} cols={4} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── 추가 · 수정 시트 ──
function AnnivSheet({ target, onClose }: { target: Anniversary | 'new' | null; onClose: () => void }) {
  // 닫히는 애니메이션 동안 내용을 유지하려고 마지막 대상을 기억한다
  const [last, setLast] = useState<Anniversary | 'new' | null>(target)
  if (target && target !== last) setLast(target)
  const shown = target ?? last

  return (
    <Sheet
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={shown === 'new' || !shown ? '기념일 추가' : '기념일 수정'}
    >
      {shown && <AnnivForm key={shown === 'new' ? 'new' : shown.id} target={shown} onDone={onClose} />}
    </Sheet>
  )
}

// 입력 중인 기념일로 자동 계산될 날들 미리 보기
function AnnivPreview({ draft }: { draft: AnnivDraft }) {
  const items = useMemo(() => {
    if (!draft.base_date) return []
    const today = todayKey()
    const custom = { id: 'preview', ...draft, title: draft.title.trim() || '이 날', is_lunar: draft.kind === 'yearly' && draft.is_lunar }
    return anniversariesBetween({ startedOn: null, members: [], customs: [custom] }, today, addDaysKey(today, 365 * 3)).slice(0, 4)
  }, [draft])
  const days = draft.base_date ? diffDays(todayKey(), draft.base_date) + 1 : 0

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-bg p-3">
      {draft.base_date &&
        (days > 0 ? (
          <p className="font-display text-[15px]">
            {draft.title.trim() || '이 날'}부터 오늘이 <span className="text-accent-deep">{days.toLocaleString()}일째</span>
          </p>
        ) : (
          // 아직 오지 않은 날 (예: 결혼 예정일)
          <p className="font-display text-[15px]">
            {draft.title.trim() || '이 날'}까지 <span className="text-accent-deep">{dday(draft.base_date)}</span>
            <span className="ml-1 text-xs text-ink-soft">· 그날부터 1일째로 세요</span>
          </p>
        ))}
      {items.length === 0 ? (
        <p className="text-xs text-ink-soft">앞으로 챙길 날이 없어요</p>
      ) : (
        <ul className="flex flex-col gap-1">
          <li className="text-xs text-ink-soft">앞으로 챙길 날</li>
          {items.map((a) => (
            <li key={a.key} className="flex items-center gap-2 text-sm">
              <span>{a.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{a.title}</span>
              <span className="shrink-0 text-xs text-ink-soft">{fmtDay(fromKey(a.date))}</span>
              <span className="font-display shrink-0 rounded-full bg-anniv/50 px-2 text-xs">{dday(a.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AnnivForm({ target, onDone }: { target: Anniversary | 'new'; onDone: () => void }) {
  const editing = target === 'new' ? null : target
  const save = useSaveAnniversary()
  const remove = useDeleteAnniversary()
  const [d, setD] = useState<AnnivDraft>(() =>
    editing
      ? {
          title: editing.title,
          base_date: editing.base_date,
          is_lunar: editing.is_lunar,
          kind: editing.kind,
          emoji: editing.emoji,
          count_days: false,
          day_every: customDayRule(editing).every,
          day_marks: customDayRule(editing).marks,
        }
      : { title: '', base_date: todayKey(), is_lunar: false, kind: 'yearly', emoji: '🎉', count_days: false, day_every: 100, day_marks: [] },
  )
  const [error, setError] = useState('')
  const set = (patch: Partial<AnnivDraft>) => setD((prev) => ({ ...prev, ...patch }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const title = d.title.trim()
    if (!title) return setError('기념일 이름을 입력해 주세요')
    if (!d.base_date) return setError('날짜를 골라 주세요')
    try {
      // 한 번만 있는 날은 음력 환산을 하지 않는다
      await save.mutateAsync({ ...d, title, is_lunar: d.kind === 'yearly' && d.is_lunar, id: editing?.id })
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  async function onDelete() {
    if (!editing) return
    if (!window.confirm(`‘${editing.title}’ 기념일을 삭제할까요?`)) return
    setError('')
    try {
      await remove.mutateAsync(editing.id)
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  const busy = save.isPending || remove.isPending

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pt-1">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">이름</span>
        <Input
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="예: 처음 만난 날"
          maxLength={50}
          autoFocus={!editing}
          enterKeyHint="done"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">반복</span>
        <Segmented
          value={d.kind as 'yearly' | 'once'}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'yearly', label: '매년' },
            { value: 'once', label: '한 번' },
          ]}
        />
      </div>

      {d.kind === 'yearly' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">달력</span>
          <Segmented
            value={d.is_lunar ? 'lunar' : 'solar'}
            onChange={(v) => set({ is_lunar: v === 'lunar' })}
            options={[
              { value: 'solar', label: '양력' },
              { value: 'lunar', label: '음력' },
            ]}
          />
        </div>
      )}

      {d.kind === 'yearly' && d.is_lunar ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">날짜 (음력)</span>
          <LunarDateInput value={d.base_date} onChange={(base_date) => set({ base_date })} />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-bold text-ink-soft">날짜</span>
          <DateButton value={d.base_date} onChange={(base_date) => set({ base_date })} title="기념일 날짜" quick={false} />
        </div>
      )}

      <div className="rounded-[22px] border-2 border-line p-3">
        <p className="font-display mb-2 text-[17px]">N일째 챙기기</p>
        <p className="mb-3 text-xs text-ink-soft">그날을 1일째로 세요. 커플마다 챙기는 날이 다르니 골라 주세요</p>
        <DayRulePicker
          value={{ every: d.day_every, marks: d.day_marks }}
          onChange={(r) => set({ day_every: r.every, day_marks: r.marks, count_days: false })}
        />
        <AnnivPreview draft={d} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">이모지</span>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="이모지 선택">
          {EMOJIS.map((em) => {
            const active = d.emoji === em
            return (
              <button
                key={em}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={em}
                onClick={() => set({ emoji: em })}
                className={`flex h-12 items-center justify-center rounded-2xl text-2xl transition ${
                  active ? 'bg-partner/40 ring-2 ring-accent' : 'bg-bg active:bg-line'
                }`}
              >
                {em}
              </button>
            )
          })}
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col gap-1 pb-2">
        <Button type="submit" disabled={busy}>
          {save.isPending ? '저장 중…' : editing ? '수정 완료' : '기념일 추가'}
        </Button>
        {editing && (
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            {remove.isPending ? '삭제 중…' : '삭제'}
          </Button>
        )}
      </div>
    </form>
  )
}
