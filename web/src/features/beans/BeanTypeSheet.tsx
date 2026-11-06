import { ChevronLeft, Pencil, Plus, Archive } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button, ErrorText, Field } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { BEAN_COLORS, EMOJI_CHOICES, type BeanType } from './model'
import { useArchiveBeanType, useSaveBeanType } from './queries'

// 콩 항목 관리: 목록 → 새 항목 / 고치기 / 보관. 한 시트 안에서 화면만 바꾼다.
const MAX_ACTIVE = 8

export function BeanTypeSheet({
  open,
  onOpenChange,
  types,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  types: BeanType[]
}) {
  const [editing, setEditing] = useState<BeanType | 'new' | null>(null)
  const archive = useArchiveBeanType()
  const [error, setError] = useState('')

  // 시트를 닫으면 목록 화면으로 돌아간다
  useEffect(() => {
    if (!open) setEditing(null)
  }, [open])

  const active = types.filter((t) => !t.archived)

  const onArchive = async (t: BeanType) => {
    if (!window.confirm(`‘${t.label}’ 항목을 지울까요?\n지금까지 쌓인 콩은 그대로 남아요.`)) return
    setError('')
    try {
      await archive.mutateAsync(t.id)
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      handleOnly
      title={
        editing ? (
          <span className="flex items-center gap-1">
            <button type="button" aria-label="목록으로" onClick={() => setEditing(null)} className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full active:bg-line">
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
            {editing === 'new' ? '새 항목' : '항목 고치기'}
          </span>
        ) : (
          '콩 항목'
        )
      }
    >
      {editing ? (
        <TypeEditor key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-ink-soft">
            데이트·꽁냥처럼 두 사람이 쓰는 이름을 직접 정해요. 최대 {MAX_ACTIVE}개까지 만들 수 있어요.
          </p>
          <ul className="flex flex-col gap-2">
            {active.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: t.color }} aria-hidden>
                  {t.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{t.label}</span>
                <button type="button" aria-label={`${t.label} 고치기`} onClick={() => setEditing(t)} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-line">
                  <Pencil className="h-5 w-5" aria-hidden />
                </button>
                <button type="button" aria-label={`${t.label} 지우기`} onClick={() => onArchive(t)} disabled={archive.isPending} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-line disabled:opacity-40">
                  <Archive className="h-5 w-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="soft" onClick={() => setEditing('new')} disabled={active.length >= MAX_ACTIVE}>
            <span className="flex items-center justify-center gap-1.5">
              <Plus className="h-5 w-5" aria-hidden /> 새 항목 만들기
            </span>
          </Button>
          {active.length >= MAX_ACTIVE && <p className="text-center text-xs text-ink-soft">항목은 {MAX_ACTIVE}개까지예요. 하나를 지우고 다시 만들 수 있어요.</p>}
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Sheet>
  )
}

function TypeEditor({ initial, onDone }: { initial: BeanType | null; onDone: () => void }) {
  const save = useSaveBeanType()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJI_CHOICES[0])
  const [color, setColor] = useState(initial?.color ?? BEAN_COLORS[0])
  const [error, setError] = useState('')

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    const name = label.trim()
    if (!name) return setError('이름을 적어 주세요')
    try {
      await save.mutateAsync({ id: initial?.id, label: name, emoji, color })
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-2">
      <Field label="이름" value={label} maxLength={12} onChange={(e) => setLabel(e.target.value)} placeholder="예: 영화 보기" />

      <div className="flex flex-col gap-2">
        <span className="px-1 text-sm font-bold text-ink-soft">그림</span>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="그림">
          {EMOJI_CHOICES.map((em) => (
            <button
              key={em}
              type="button"
              role="radio"
              aria-checked={em === emoji}
              onClick={() => setEmoji(em)}
              className={`flex aspect-square items-center justify-center rounded-full text-xl transition active:scale-90 ${em === emoji ? 'ring-3 ring-accent' : 'bg-bg'}`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-sm font-bold text-ink-soft">색</span>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="색">
          {BEAN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={`색 ${c}`}
              onClick={() => setColor(c)}
              className={`aspect-square rounded-full transition active:scale-90 ${c === color ? 'ring-2 ring-ink/60 ring-offset-2 ring-offset-surface' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: color }} aria-hidden>
          {emoji}
        </span>
        <span className="font-bold">{label.trim() || '이름'}</span>
      </div>

      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? '저장 중…' : '저장'}
      </Button>
    </form>
  )
}
