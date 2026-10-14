import { Pencil, Plus, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { US_AVATAR, useCoupleCtx, useOwnerInfo } from '../../app/couple'
import { Sheet } from '../../components/Sheet'
import { Button, ErrorText, Input, Segmented, Toggle } from '../../components/ui'
import { TimeButton } from '../../components/DateTimePicker'
import { REPEAT_LABELS, type RepeatPreset } from '../../lib/recurrence'
import { toMessage } from '../../lib/supabase'
import { guessEmoji, STARTERS, timeRangeLabel, type QuickItem } from './model'
import { useDeleteTemplate, useQuickItems, useSaveTemplate, type TemplateDraft } from './queries'

// ── 가로로 넘기는 빠른 선택 칩 ─────────────────
export function QuickChips({
  items,
  activeKey,
  onPick,
  onManage,
}: {
  items: QuickItem[]
  activeKey?: string | null
  onPick: (item: QuickItem, el: HTMLElement) => void
  onManage: () => void
}) {
  const owner = useOwnerInfo()
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none]">
      {items.map((item) => {
        const active = item.key === activeKey
        const color = owner(item.ownerId).color
        return (
          <button
            key={item.key}
            type="button"
            onClick={(e) => onPick(item, e.currentTarget)}
            className={`font-display press-3d flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-[15px] transition ${
              active ? 'animate-pop' : ''
            }`}
            style={{
              backgroundColor: active ? color : `color-mix(in srgb, ${color} 18%, white)`,
              borderColor: `color-mix(in srgb, ${color} 70%, white)`,
              ['--shade' as string]: `color-mix(in srgb, ${color} 75%, black 8%)`,
            }}
          >
            <span className="text-lg">{item.emoji}</span>
            {item.title}
            {item.source === 'suggest' && <Sparkles className="h-3.5 w-3.5 text-accent-deep" aria-label="추천" />}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onManage}
        className="font-display flex h-11 shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-line-deep bg-surface px-3.5 text-[15px] text-ink-soft active:scale-95"
      >
        {items.length ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {items.length ? '도장 관리' : '자주 하는 일 추가'}
      </button>
    </div>
  )
}

// ── 자주 쓰는 일정(도장) 관리 시트 ───────────────
type Target = { kind: 'list' } | { kind: 'edit'; item: Partial<QuickItem> & { templateId?: string } }

export function TemplateSheet({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: Partial<QuickItem> | null // 열자마자 이 내용으로 새 도장 만들기
}) {
  const [target, setTarget] = useState<Target>({ kind: 'list' })
  const [lastOpen, setLastOpen] = useState(false)
  // 열릴 때마다 처음 화면으로 (initial 이 있으면 바로 편집)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setTarget(initial ? { kind: 'edit', item: initial } : { kind: 'list' })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={target.kind === 'list' ? '자주 하는 일' : target.item.templateId ? '도장 고치기' : '새 도장 만들기'}
      // 입력하다 내용을 스크롤해도 닫히지 않게: 손잡이로만 끌어 닫는다
      handleOnly={target.kind === 'edit'}
    >
      {target.kind === 'list' ? (
        <TemplateList onEdit={(item) => setTarget({ kind: 'edit', item })} />
      ) : (
        <TemplateForm
          key={target.item.templateId ?? target.item.title ?? 'new'}
          item={target.item}
          onDone={() => setTarget({ kind: 'list' })}
        />
      )}
    </Sheet>
  )
}

function TemplateList({ onEdit }: { onEdit: (item: Partial<QuickItem> & { templateId?: string }) => void }) {
  const { items, isLoading } = useQuickItems(8)
  const owner = useOwnerInfo()
  const { me, partner } = useCoupleCtx()
  const mine = items.filter((i) => i.source === 'template')
  // 누구 도장인지 나눠서: 내 것 / 우리(함께) / 상대
  const groups = [
    { key: 'me', label: `${me.avatar} 내 도장`, list: mine.filter((i) => i.ownerId === me.id) },
    { key: 'us', label: `${US_AVATAR} 우리 도장`, list: mine.filter((i) => i.ownerId === null) },
    ...(partner
      ? [{ key: 'partner', label: `${partner.avatar} ${partner.nickname} 도장`, list: mine.filter((i) => i.ownerId === partner.id) }]
      : []),
  ]
  const suggestions = items.filter((i) => i.source === 'suggest')
  const takenTitles = new Set(items.map((i) => i.title))
  const starters = STARTERS.filter((s) => !takenTitles.has(s.title))

  const row = (item: QuickItem | (typeof STARTERS)[number], onClick: () => void, badge?: string) => (
    <button
      key={'key' in item ? item.key : item.title}
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[20px] px-2 py-2 text-left active:bg-bg"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg text-2xl">{item.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="font-display block truncate text-[17px]">{item.title}</span>
        <span className="text-xs text-ink-soft">
          {timeRangeLabel(item)}
          {'ownerId' in item && ` · ${owner(item.ownerId).name}`}
          {'repeat' in item && item.repeat ? ` · ${REPEAT_LABELS[item.repeat]}` : ''}
        </span>
      </span>
      {badge && <span className="font-display shrink-0 rounded-full bg-partner/30 px-2.5 py-1 text-xs text-accent-deep">{badge}</span>}
    </button>
  )

  return (
    <div className="flex flex-col gap-4 pb-2">
      <p className="text-sm text-ink-soft">
        도장을 만들어 두면 일정 추가할 때 한 번에 채워지고, 달력에서 <b>날짜를 톡톡 눌러 바로 찍을 수</b> 있어요.
      </p>

      {isLoading ? null : mine.length === 0 ? (
        <p className="px-1 text-sm text-ink-soft">아직 만든 도장이 없어요. 아래에서 골라 보세요</p>
      ) : (
        groups
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <section key={g.key}>
              <h3 className="mb-1 px-1 text-lg">
                {g.label} <span className="text-ink-soft">{g.list.length}</span>
              </h3>
              {g.list.map((item) => row(item, () => onEdit({ ...item })))}
            </section>
          ))
      )}
      <Button variant="soft" onClick={() => onEdit({})}>
        <span className="flex items-center justify-center gap-1">
          <Plus className="h-5 w-5" /> 새 도장 만들기
        </span>
      </Button>

      {suggestions.length > 0 && (
        <section>
          <h3 className="mb-1 px-1 text-lg">자주 하던 일</h3>
          {suggestions.map((item) => row(item, () => onEdit({ ...item, templateId: undefined }), `${item.count}번`))}
        </section>
      )}

      {starters.length > 0 && (
        <section>
          <h3 className="mb-1 px-1 text-lg">이런 건 어때요?</h3>
          {starters.map((s) => row(s, () => onEdit({ ...s }), '추가'))}
        </section>
      )}
    </div>
  )
}

const EMOJI_CHOICES = ['🏋️', '🧘', '🏃', '💕', '🍽️', '☕', '🎬', '🍻', '✈️', '🏥', '💼', '📚', '🛍️', '🎨', '🧹', '🎮', '🐶', '🌙', '🏠', '⭐']

function TemplateForm({
  item,
  onDone,
}: {
  item: Partial<QuickItem> & { templateId?: string }
  onDone: () => void
}) {
  const { me, partner, couple } = useCoupleCtx()
  const save = useSaveTemplate()
  const remove = useDeleteTemplate()
  const [emoji, setEmoji] = useState(item.emoji ?? '⭐')
  const [emojiTouched, setEmojiTouched] = useState(!!item.emoji)
  const [title, setTitle] = useState(item.title ?? '')
  const [owner, setOwner] = useState<'us' | 'me' | 'partner'>(
    item.ownerId === undefined ? 'me' : item.ownerId === null ? 'us' : item.ownerId === me.id ? 'me' : 'partner',
  )
  const [allDay, setAllDay] = useState(item.allDay ?? false)
  const [start, setStart] = useState(item.startTime ?? '19:00')
  const [end, setEnd] = useState(item.endTime ?? '20:00')
  const [repeat, setRepeat] = useState<RepeatPreset>(item.repeat ?? 'none')
  const [location, setLocation] = useState(item.location ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    // 시트는 포털이지만 React 이벤트는 바깥 폼(일정 입력)까지 전달되므로 막는다
    e.stopPropagation()
    setError('')
    const t = title.trim()
    if (!t) return setError('이름을 입력해 주세요')
    const draft: TemplateDraft = {
      emoji,
      title: t,
      owner_id: owner === 'us' ? null : owner === 'me' ? me.id : (partner?.id ?? null),
      all_day: allDay,
      start_time: allDay ? null : start,
      end_time: allDay ? null : end,
      repeat: repeat === 'none' ? null : repeat,
      location: location.trim() || null,
    }
    try {
      await save.mutateAsync({ ...draft, id: item.templateId })
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  async function onDelete() {
    if (!item.templateId || !window.confirm(`'${item.title}' 도장을 지울까요? (이미 찍은 일정은 그대로예요)`)) return
    try {
      await remove.mutateAsync(item.templateId)
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <div className="flex items-center gap-3">
        <span className="animate-pop flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-line bg-bg text-4xl">
          {emoji}
        </span>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (!emojiTouched) setEmoji(guessEmoji(e.target.value))
          }}
          placeholder="예: 운동"
          maxLength={100}
          className="font-display flex-1 text-xl"
          autoFocus={!item.title}
        />
      </div>

      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="이모지">
        {EMOJI_CHOICES.map((em) => (
          <button
            key={em}
            type="button"
            role="radio"
            aria-checked={emoji === em}
            onClick={() => {
              setEmoji(em)
              setEmojiTouched(true)
            }}
            className={`flex aspect-square items-center justify-center rounded-full text-xl transition active:scale-90 ${
              emoji === em ? 'bg-partner/40 ring-2 ring-accent' : ''
            }`}
          >
            {em}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">누구의 일정?</span>
        <Segmented
          value={owner}
          onChange={setOwner}
          options={[
            { value: 'me', label: me.nickname || '나', color: me.color },
            ...(partner ? [{ value: 'partner' as const, label: partner.nickname, color: partner.color }] : []),
            { value: 'us', label: '우리', color: couple.us_color },
          ]}
        />
      </div>

      <div className="rounded-[22px] border-2 border-line p-3">
        <Toggle checked={allDay} onChange={setAllDay} label="종일" />
        {!allDay && (
          <div className="mt-1 flex items-center gap-2">
            <TimeButton value={start} onChange={setStart} title="시작 시간" className="min-w-0 flex-1 px-2.5" />
            <span className="text-ink-soft">~</span>
            <TimeButton value={end} onChange={setEnd} title="끝나는 시간" className="min-w-0 flex-1 px-2.5" />
          </div>
        )}
        <p className="mt-3 mb-1.5 font-bold">반복</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {(Object.keys(REPEAT_LABELS) as RepeatPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRepeat(p)}
              className={`font-display press-3d shrink-0 rounded-full border-2 px-3 py-1 text-sm ${
                repeat === p ? 'border-accent-deep bg-accent text-white [--shade:var(--color-accent-deep)]' : 'border-line bg-surface'
              }`}
            >
              {p === 'none' ? '안 함' : REPEAT_LABELS[p]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-soft">반복은 일정 추가 화면에서 칩을 고를 때만 적용돼요. 달력 도장은 그날 하루만 찍혀요.</p>
      </div>

      <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="장소 (선택)" maxLength={100} />

      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={save.isPending}>
        {item.templateId ? '고치기' : '도장 만들기'}
      </Button>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDone}>
          뒤로
        </Button>
        {item.templateId && (
          <Button variant="danger" onClick={onDelete} disabled={remove.isPending}>
            지우기
          </Button>
        )}
      </div>
    </form>
  )
}
