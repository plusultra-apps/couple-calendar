import { useQueryClient } from '@tanstack/react-query'
import { addDays, addHours, differenceInMinutes, startOfHour } from 'date-fns'
import { useEffect, useState, type FormEvent } from 'react'
import { EyeOff, Lock, Map as MapIcon, Users, type LucideIcon } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { US_AVATAR, useCoupleCtx } from '../../app/couple'
import { useGoBack } from '../../app/navigation'
import { celebrate } from '../../lib/celebrate'
import { DateButton, TimeButton } from '../../components/DateTimePicker'
import { PlaceSearchSheet } from '../../components/PlaceSearchSheet'
import { guessEmoji, type QuickItem } from '../quick/model'
import { useQuickItems } from '../quick/queries'
import { QuickChips, TemplateSheet } from '../quick/QuickUI'
import { PageHeader } from '../../components/PageHeader'
import { Card, EmptyState, ErrorText, Input, Segmented, Spinner, Textarea, Toggle } from '../../components/ui'
import { addDaysKey, combine, diffDays, fromKey, toKey, toTimeInput, todayKey, type DateKey } from '../../lib/dates'
import { buildRRule, parseRRule, REPEAT_LABELS, type RepeatPreset } from '../../lib/recurrence'
import { supabase, toMessage } from '../../lib/supabase'
import type { EventWithSecret } from '../../types/database'
import { isMasked, useEvent, useSaveEvent, type EventInput } from './queries'

type Owner = 'us' | 'me' | 'partner'

type Draft = {
  title: string
  owner: Owner
  allDay: boolean
  startDate: DateKey
  startTime: string
  endDate: DateKey
  endTime: string
  repeat: RepeatPreset
  until: DateKey | ''
  location: string
  memo: string
  visibility: Visibility
}

function newDraft(date: DateKey, title: string): Draft {
  // 오늘이면 다음 정각, 다음 정각이 내일로 넘어가면 오늘 밤 11시
  const nextHour = startOfHour(addHours(new Date(), 1))
  const base = date !== todayKey() ? combine(date, '12:00') : toKey(nextHour) === date ? nextHour : combine(date, '23:00')
  const end = addHours(base, 1)
  return {
    title,
    owner: 'us',
    allDay: false,
    startDate: toKey(base),
    startTime: toTimeInput(base),
    endDate: toKey(end),
    endTime: toTimeInput(end),
    repeat: 'none',
    until: '',
    location: '',
    memo: '',
    visibility: 'shared',
  }
}

function draftFromEvent(e: EventWithSecret, userId: string): Draft {
  const { preset, until } = parseRRule(e.rrule)
  const start = e.all_day ? fromKey(e.start_date!) : new Date(e.starts_at!)
  const end = e.all_day ? fromKey(e.end_date!) : new Date(e.ends_at!)
  return {
    title: e.is_private ? (e.event_secrets?.title ?? '') : e.title,
    owner: e.owner_id === null ? 'us' : e.owner_id === userId ? 'me' : 'partner',
    allDay: e.all_day,
    startDate: toKey(start),
    startTime: e.all_day ? '12:00' : toTimeInput(start),
    endDate: toKey(end),
    endTime: e.all_day ? '13:00' : toTimeInput(end),
    repeat: preset,
    until: until ?? '',
    location: (e.is_private ? e.event_secrets?.location : e.location) ?? '',
    memo: (e.is_private ? e.event_secrets?.memo : e.memo) ?? '',
    visibility: e.hidden ? 'secret' : e.is_private ? 'busy' : 'shared',
  }
}

export function EventEditorPage() {
  const { id } = useParams()
  const existing = useEvent(id)
  const { userId } = useCoupleCtx()

  if (id && existing.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (id && (!existing.data || isMasked(existing.data))) {
    return (
      <>
        <PageHeader title="일정 수정" back />
        <EmptyState emoji="🔒" title="수정할 수 없는 일정이에요">
          삭제되었거나 상대의 비공개 일정이에요.
        </EmptyState>
      </>
    )
  }
  return <Editor key={id ?? 'new'} event={existing.data ?? null} userId={userId} />
}

function Editor({ event, userId }: { event: EventWithSecret | null; userId: string }) {
  const goBack = useGoBack()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const { me, partner, couple } = useCoupleCtx()
  const save = useSaveEvent()
  const wishId = params.get('wish')

  const [d, setD] = useState<Draft>(() => {
    if (event) return draftFromEvent(event, userId)
    const draft = newDraft(params.get('date') ?? todayKey(), params.get('title') ?? '')
    // 빈 시간에서 바로 온 경우: ?start=19:00&min=120
    const start = params.get('start')
    const min = Number(params.get('min'))
    if (start && /^\d{2}:\d{2}$/.test(start) && min > 0) {
      const s = combine(params.get('date') ?? todayKey(), start)
      const e = new Date(s.getTime() + min * 60_000)
      Object.assign(draft, { startDate: toKey(s), startTime: start, endDate: toKey(e), endTime: toTimeInput(e) })
    }
    return draft
  })
  const [error, setError] = useState('')
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }))
  const quick = useQuickItems()
  const [placeOpen, setPlaceOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [templateSheet, setTemplateSheet] = useState<{ open: boolean; initial: Partial<QuickItem> | null }>({
    open: false,
    initial: null,
  })

  // 빠른 선택 칩: 지금 고른 날짜는 그대로 두고 나머지를 한 번에 채운다
  function applyQuick(item: QuickItem) {
    setPicked(item.key)
    const owner: Owner = item.ownerId === null ? 'us' : item.ownerId === userId ? 'me' : 'partner'
    const patch: Partial<Draft> = {
      title: item.title,
      owner,
      allDay: item.allDay,
      repeat: item.repeat ?? 'none',
      location: item.location ?? '',
      visibility: 'shared',
    }
    if (item.allDay || !item.startTime || !item.endTime) {
      Object.assign(patch, { endDate: d.startDate })
    } else {
      const start = combine(d.startDate, item.startTime)
      let end = combine(d.startDate, item.endTime)
      if (end <= start) end = addDays(end, 1)
      Object.assign(patch, { startTime: item.startTime, endDate: toKey(end), endTime: item.endTime })
    }
    set(patch)
  }

  // 지금 입력한 내용을 도장으로
  const draftAsQuick = (): Partial<QuickItem> => ({
    emoji: guessEmoji(d.title),
    title: d.title.trim(),
    ownerId: d.owner === 'us' ? null : d.owner === 'me' ? userId : (partner?.id ?? null),
    allDay: d.allDay,
    startTime: d.allDay ? null : d.startTime,
    endTime: d.allDay ? null : d.endTime,
    repeat: d.repeat === 'none' ? null : d.repeat,
    location: d.location || null,
  })

  // 비공개는 내 일정일 때만
  useEffect(() => {
    if (d.owner !== 'me' && d.visibility !== 'shared') set({ visibility: 'shared' })
  }, [d.owner, d.visibility])

  // 시작을 바꾸면 종료도 같은 길이만큼 따라 움직인다
  function changeStart(date: DateKey, time: string) {
    if (d.allDay) {
      const len = Math.max(0, diffDays(d.endDate, d.startDate))
      set({ startDate: date, endDate: addDaysKey(date, len) })
      return
    }
    const oldStart = combine(d.startDate, d.startTime)
    const oldEnd = combine(d.endDate, d.endTime)
    const minutes = Math.max(0, differenceInMinutes(oldEnd, oldStart))
    const newStart = combine(date, time)
    const newEnd = new Date(newStart.getTime() + minutes * 60_000)
    set({ startDate: date, startTime: time, endDate: toKey(newEnd), endTime: toTimeInput(newEnd) })
  }

  // '얼마나?' 칩: 시작은 그대로, 끝만 맞춘다
  const durationMinutes = differenceInMinutes(combine(d.endDate, d.endTime), combine(d.startDate, d.startTime))
  function setDuration(minutes: number) {
    const end = new Date(combine(d.startDate, d.startTime).getTime() + minutes * 60_000)
    set({ endDate: toKey(end), endTime: toTimeInput(end) })
  }
  const setDays = (n: number) => set({ endDate: addDaysKey(d.startDate, n) })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const title = d.title.trim()
    if (!title) return setError('제목을 입력해 주세요')

    const start = combine(d.startDate, d.startTime)
    const end = combine(d.endDate, d.endTime)
    if (d.allDay ? d.endDate < d.startDate : end < start) return setError('끝나는 시간이 시작보다 빨라요')
    if (d.repeat !== 'none' && d.until && d.until < d.startDate) return setError('반복 종료일이 시작일보다 빨라요')

    const input: EventInput = {
      id: event?.id,
      owner_id: d.owner === 'us' ? null : d.owner === 'me' ? userId : (partner?.id ?? null),
      title,
      location: d.location,
      memo: d.memo,
      all_day: d.allDay,
      starts_at: d.allDay ? null : start.toISOString(),
      ends_at: d.allDay ? null : end.toISOString(),
      start_date: d.allDay ? d.startDate : null,
      end_date: d.allDay ? d.endDate : null,
      rrule: buildRRule(d.repeat, d.until || null, d.startDate),
      is_private: d.visibility === 'busy',
      hidden: d.visibility === 'secret',
    }

    try {
      const saved = await save.mutateAsync(input)
      if (!event) celebrate()
      if (wishId && saved) {
        const { error: wishError } = await supabase.from('wishes').update({ event_id: saved.id, done: true }).eq('id', wishId)
        qc.invalidateQueries({ queryKey: ['wishes'] })
        if (wishError) throw new Error(`일정은 저장했지만 위시와 연결하지 못했어요 (${toMessage(wishError)})`)
      }
      goBack(saved ? `/event/${saved.id}` : '/')
    } catch (err) {
      setError(toMessage(err))
    }
  }

  const ownerOptions: { value: Owner; label: string; color: string }[] = [
    { value: 'us', label: `${US_AVATAR} 우리`, color: couple.us_color },
    { value: 'me', label: `${me.avatar} ${me.nickname || '나'}`, color: me.color },
    ...(partner ? [{ value: 'partner' as const, label: `${partner.avatar} ${partner.nickname}`, color: partner.color }] : []),
  ]

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col">
      <PageHeader
        title={event ? '일정 수정' : '새 일정'}
        back
        right={
          <button
            type="submit"
            disabled={save.isPending}
            className="font-display press-3d h-10 rounded-full bg-accent px-5 text-base text-white [--shade:var(--color-accent-deep)] disabled:opacity-50"
          >
            {save.isPending ? '저장 중…' : '저장'}
          </button>
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        {!event && (
          <section>
            <span className="px-1 text-sm font-bold text-ink-soft">빠른 선택</span>
            <QuickChips
              items={quick.items}
              activeKey={picked}
              onPick={(item) => applyQuick(item)}
              onManage={() => setTemplateSheet({ open: true, initial: null })}
            />
          </section>
        )}
        <input
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="일정 제목"
          maxLength={100}
          autoFocus={!event}
          enterKeyHint="done"
          className="font-display h-16 rounded-[22px] border-2 border-line bg-surface px-4 text-2xl outline-none transition focus:border-accent placeholder:text-ink-soft/50"
        />

        <section className="flex flex-col gap-2">
          <span className="px-1 text-sm font-bold text-ink-soft">누구의 일정인가요?</span>
          <Segmented value={d.owner} options={ownerOptions} onChange={(owner) => set({ owner })} />
        </section>

        <Card className="flex flex-col gap-3 p-4">
          <Toggle checked={d.allDay} onChange={(allDay) => set({ allDay })} label="종일" />

          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-bold text-ink-soft">시작</span>
            <div className="flex gap-2">
              <DateButton
                value={d.startDate}
                onChange={(date) => changeStart(date, d.startTime)}
                title="언제 시작해요?"
                className="flex-1"
              />
              {!d.allDay && (
                <TimeButton value={d.startTime} onChange={(t) => changeStart(d.startDate, t)} title="시작 시간" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-bold text-ink-soft">{d.allDay ? '며칠 동안?' : '얼마나?'}</span>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {(d.allDay ? DAY_SPANS : DURATIONS).map((opt) => {
                const active = d.allDay
                  ? diffDays(d.endDate, d.startDate) === opt.value
                  : durationMinutes === opt.value
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => (d.allDay ? setDays(opt.value) : setDuration(opt.value))}
                    className={`font-display press-3d shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[15px] ${
                      active
                        ? 'border-accent-deep bg-accent text-white [--shade:var(--color-accent-deep)]'
                        : 'border-line bg-surface'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-bold text-ink-soft">끝</span>
            <div className="flex gap-2">
              <DateButton
                value={d.endDate}
                min={d.startDate}
                onChange={(date) => set({ endDate: date })}
                title="언제 끝나요?"
                quick={false}
                className="flex-1"
              />
              {!d.allDay && <TimeButton value={d.endTime} onChange={(t) => set({ endTime: t })} title="끝나는 시간" />}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-bold text-ink-soft">반복</span>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {(Object.keys(REPEAT_LABELS) as RepeatPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set({ repeat: p })}
                  className={`font-display press-3d shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[15px] ${
                    d.repeat === p
                      ? 'border-accent-deep bg-accent text-white [--shade:var(--color-accent-deep)]'
                      : 'border-line bg-surface'
                  }`}
                >
                  {p === 'none' ? '안 함' : REPEAT_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          {d.repeat !== 'none' && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 px-1 text-sm font-bold text-ink-soft">언제까지?</span>
              <DateButton
                value={d.until}
                min={d.startDate}
                onChange={(until) => set({ until })}
                placeholder="계속 반복"
                title="반복 끝나는 날"
                quick={false}
                className="flex-1"
              />
              {d.until && (
                <button type="button" onClick={() => set({ until: '' })} className="shrink-0 px-2 text-sm text-ink-soft">
                  지우기
                </button>
              )}
            </div>
          )}
        </Card>

        <div className="flex gap-2">
          <Input
            value={d.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="장소"
            maxLength={100}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => setPlaceOpen(true)}
            className="font-display press-3d flex h-12 shrink-0 items-center gap-1 rounded-2xl border-2 border-line bg-surface px-3.5 text-[15px]"
          >
            <MapIcon className="h-4 w-4" aria-hidden /> 찾기
          </button>
        </div>
        <PlaceSearchSheet
          open={placeOpen}
          onOpenChange={setPlaceOpen}
          initialQuery={d.location || d.title}
          onPick={(p) => set({ location: p.name })}
        />
        <Textarea value={d.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="메모" maxLength={1000} />

        {d.owner === 'me' && (
          <Card className="flex flex-col gap-2 p-4">
            <span className="px-1 text-sm font-bold text-ink-soft">
              {partner?.avatar} {partner?.nickname ?? '상대'}에게 어떻게 보일까요?
            </span>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY.map((v) => {
                const active = d.visibility === v.value
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => set({ visibility: v.value })}
                    className={`press-3d flex flex-col items-center gap-0.5 rounded-[20px] border-2 px-1 py-2 transition ${
                      active
                        ? 'animate-pop border-accent-deep bg-partner/40 [--shade:var(--color-accent-deep)]'
                        : 'border-line bg-surface'
                    }`}
                  >
                    <v.icon className="h-6 w-6" aria-hidden />
                    <span className="font-display text-[15px]">{v.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="px-1 text-xs text-ink-soft">
              {VISIBILITY.find((v) => v.value === d.visibility)!.hint(partner?.nickname ?? '상대')}
            </p>
          </Card>
        )}

        {!event && d.title.trim() && !quick.items.some((q) => q.source === 'template' && q.title === d.title.trim()) && (
          <button
            type="button"
            onClick={() => setTemplateSheet({ open: true, initial: draftAsQuick() })}
            className="font-display mx-auto flex items-center gap-1.5 rounded-full border-2 border-dashed border-line-deep px-4 py-2 text-ink-soft active:scale-95"
          >
            '{d.title.trim()}' 도장으로 만들어 두기
          </button>
        )}

        <ErrorText>{error}</ErrorText>
      </div>

      <TemplateSheet
        open={templateSheet.open}
        initial={templateSheet.initial}
        onOpenChange={(open) => setTemplateSheet((s) => ({ ...s, open }))}
      />
    </form>
  )
}


const DURATIONS = [
  { label: '30분', value: 30 },
  { label: '1시간', value: 60 },
  { label: '1시간 반', value: 90 },
  { label: '2시간', value: 120 },
  { label: '3시간', value: 180 },
  { label: '반나절', value: 240 },
]

const DAY_SPANS = [
  { label: '하루', value: 0 },
  { label: '1박 2일', value: 1 },
  { label: '2박 3일', value: 2 },
  { label: '3박 4일', value: 3 },
  { label: '일주일', value: 6 },
]

type Visibility = 'shared' | 'busy' | 'secret'

// 내 일정의 공개 범위
const VISIBILITY: { value: Visibility; icon: LucideIcon; label: string; hint: (partner: string) => string }[] = [
  { value: 'shared', icon: Users, label: '같이 보기', hint: (p) => `${p}도 제목·장소·메모까지 다 볼 수 있어요` },
  { value: 'busy', icon: Lock, label: '바쁨으로만', hint: (p) => `${p}에게는 시간만 '바쁨'으로 보여요` },
  { value: 'secret', icon: EyeOff, label: '나만 보기', hint: (p) => `${p}에게는 아예 안 보이고 알림도 안 가요` },
]
