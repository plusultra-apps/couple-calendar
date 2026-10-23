import { formatDistanceToNowStrict } from 'date-fns'
import { ko } from 'date-fns/locale'
import { EyeOff, Lock, MapPin, Pencil, Repeat, Send, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { celebrateAt } from '../../lib/celebrate'
import { useGoBack } from '../../app/navigation'
import { PhotoGrid, PhotoUploadButton } from '../photos/PhotoGrid'
import { usePhotos } from '../photos/queries'
import { PlaceInfoSheet } from '../../components/PlaceInfo'
import { nicknameOf, useCoupleCtx, useOwnerInfo } from '../../app/couple'
import { IconButton, PageHeader } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { Button, Card, EmptyState, ErrorText, Spinner } from '../../components/ui'
import { addDaysKey, fmt, fmtDay, fmtTime, todayKey, type DateKey } from '../../lib/dates'
import { describeRRule, expand } from '../../lib/recurrence'
import { toMessage } from '../../lib/supabase'
import { REACTION_EMOJIS, type EventWithSecret } from '../../types/database'
import {
  displayTitle,
  isMasked,
  useAddComment,
  useComments,
  useDeleteComment,
  useDeleteEvent,
  useEditSeries,
  useEvent,
  useReactions,
  useToggleReaction,
} from './queries'

export function EventDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const event = useEvent(id)

  if (event.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!event.data) {
    return (
      <>
        <PageHeader title="일정" back />
        <EmptyState emoji="🫥" title="일정을 찾을 수 없어요">
          삭제되었을 수 있어요.
        </EmptyState>
      </>
    )
  }
  return <Detail event={event.data} date={params.get('date')} />
}

// 반복 전 원래 첫 회차의 시작일
const baseStartKey = (event: EventWithSecret) =>
  expand({ ...event, rrule: null }, '0000-01-01', '9999-12-31')[0]?.startKey ?? null

function whenText(event: EventWithSecret, date: DateKey | null): string {
  // date 에 '시작하는' 회차를 우선 (밤샘 반복 일정은 전날 회차도 date 에 걸친다)
  const spans = date ? expand(event, date, date) : []
  const span =
    spans.find((s) => s.startKey === date) ?? spans[0] ?? expand({ ...event, rrule: null }, '0000-01-01', '9999-12-31')[0]
  if (!span) return ''
  if (event.all_day) {
    return span.startKey === span.endKey ? `${fmtDay(span.start)} · 종일` : `${fmtDay(span.start)} – ${fmtDay(span.end)}`
  }
  if (span.startKey === span.endKey) {
    // 끝 시각 미정(길이 0)은 시작 시각만
    if (span.start.getTime() === span.end.getTime()) return `${fmtDay(span.start)} · ${fmtTime(span.start)}`
    return `${fmtDay(span.start)} · ${fmtTime(span.start)} – ${fmtTime(span.end)}`
  }
  return `${fmtDay(span.start)} ${fmtTime(span.start)} – ${fmtDay(span.end)} ${fmtTime(span.end)}`
}

function Detail({ event, date }: { event: EventWithSecret; date: DateKey | null }) {
  const navigate = useNavigate()
  const { couple } = useCoupleCtx()
  const owner = useOwnerInfo()(event.owner_id)
  const masked = isMasked(event)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const location = event.is_private ? event.event_secrets?.location : event.location
  const memo = event.is_private ? event.event_secrets?.memo : event.memo

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title=""
        back
        right={
          !masked && (
            <>
              <IconButton label="수정" onClick={() => navigate(`/event/${event.id}/edit`)}>
                <Pencil className="h-5 w-5" />
              </IconButton>
              <IconButton label="삭제" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-5 w-5" />
              </IconButton>
            </>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <section className="flex flex-col gap-2">
          <span
            className="font-display flex w-fit items-center gap-1 rounded-full px-3 py-1 text-sm"
            style={{ backgroundColor: owner.color }}
          >
            <span className="text-base">{owner.avatar}</span>
            {event.owner_id ? `${owner.name}의 일정` : '우리 일정'}
            {event.hidden && <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/70 px-2 text-xs"><EyeOff className="h-3 w-3" aria-hidden /> 나만 보기</span>}
            {event.is_private && <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/70 px-2 text-xs"><Lock className="h-3 w-3" aria-hidden /> 바쁨으로만</span>}
          </span>
          <h1 className="flex items-center gap-2 text-2xl font-bold break-all">
            {event.is_private && <Lock className="h-5 w-5 shrink-0 text-ink-soft" />}
            {displayTitle(event)}
          </h1>
          <p className="text-ink-soft">{whenText(event, date)}</p>
          {event.rrule && (
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <Repeat className="h-4 w-4" /> {describeRRule(event.rrule)}
            </p>
          )}
        </section>

        {masked ? (
          <Card className="flex items-center gap-2 text-sm text-ink-soft">
            <Lock className="h-4 w-4 shrink-0" aria-hidden /> {owner.name}의 비공개 일정이라 내용은 보이지 않아요.
          </Card>
        ) : (
          (location || memo) && (
            <Card className="flex flex-col gap-3">
              {location && (
                <button
                  type="button"
                  onClick={() => setPlaceOpen(true)}
                  className="flex items-center gap-2 text-left font-semibold text-ink"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-accent" />
                  <span className="underline decoration-line underline-offset-4">{location}</span>
                  <span className="font-display shrink-0 rounded-full bg-anniv/40 px-2 py-0.5 text-xs">사진·후기</span>
                </button>
              )}
              {memo && <p className="text-sm whitespace-pre-wrap">{memo}</p>}
            </Card>
          )
        )}

        <Reactions eventId={event.id} />

        {!masked && <EventPhotos eventId={event.id} takenOn={date ?? baseStartKey(event) ?? todayKey()} />}

        <Comments eventId={event.id} />

        <p className="text-center text-xs text-ink-soft">
          {nicknameOf(couple, event.created_by) || '누군가'} 님이 추가 · {fmt(new Date(event.created_at), 'yyyy.M.d')}
        </p>
      </div>

      <DeleteSheet event={event} date={date} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <PlaceInfoSheet open={placeOpen} onOpenChange={setPlaceOpen} place={location ? { name: location } : null} />
    </div>
  )
}

function Reactions({ eventId }: { eventId: string }) {
  const { userId } = useCoupleCtx()
  const reactions = useReactions(eventId)
  const toggle = useToggleReaction(eventId, userId)
  const list = reactions.data ?? []

  return (
    <div className="flex flex-wrap gap-2">
      {REACTION_EMOJIS.map((emoji) => {
        const count = list.filter((r) => r.emoji === emoji).length
        const mine = list.some((r) => r.emoji === emoji && r.user_id === userId)
        return (
          <button
            key={emoji}
            type="button"
            disabled={toggle.isPending}
            onClick={(e) => {
              if (!mine) celebrateAt(e.currentTarget, 6)
              toggle.mutate({ emoji, on: !mine })
            }}
            className={`flex h-10 items-center gap-1 rounded-full border px-3 text-lg transition active:scale-95 ${
              mine ? 'border-accent bg-partner/25' : 'border-line bg-surface'
            }`}
          >
            {emoji}
            {count > 0 && <span className="text-sm font-semibold">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Comments({ eventId }: { eventId: string }) {
  const { userId, couple } = useCoupleCtx()
  const comments = useComments(eventId)
  const add = useAddComment(eventId)
  const del = useDeleteComment(eventId)
  const [body, setBody] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    add.mutate(text, { onSuccess: () => setBody('') })
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-semibold">댓글 {comments.data?.length ? comments.data.length : ''}</h2>
      {comments.data?.length === 0 && <p className="text-sm text-ink-soft">첫 댓글을 남겨 보세요</p>}
      <ul className="flex flex-col gap-2">
        {comments.data?.map((c) => {
          const author = couple.members.find((m) => m.id === c.user_id)
          const mine = c.user_id === userId
          return (
            <li key={c.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="mb-0.5 text-[11px] text-ink-soft">
                {author?.nickname} · {formatDistanceToNowStrict(new Date(c.created_at), { locale: ko, addSuffix: true })}
              </span>
              <span className="flex items-center gap-1">
                {mine && (
                  <button
                    type="button"
                    aria-label="댓글 삭제"
                    onClick={() => del.mutate(c.id)}
                    className="rounded-full p-1 text-ink-soft active:bg-line"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <span
                  className="max-w-[16rem] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
                  style={{ backgroundColor: author ? `${author.color}55` : undefined }}
                >
                  {c.body}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="댓글 달기"
          rows={1}
          maxLength={500}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-bg px-4 py-2.5 text-base outline-none focus:border-partner"
        />
        <button
          type="submit"
          aria-label="보내기"
          disabled={!body.trim() || add.isPending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
      <ErrorText>{add.error && toMessage(add.error)}</ErrorText>
    </Card>
  )
}

function DeleteSheet({
  event,
  date,
  open,
  onOpenChange,
}: {
  event: EventWithSecret
  date: DateKey | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const goBack = useGoBack()
  const del = useDeleteEvent()
  const series = useEditSeries()
  const [error, setError] = useState('')
  const busy = del.isPending || series.isPending
  const firstKey = baseStartKey(event)
  // 이 회차 앞에 남는(보이는) 회차가 없으면 '이후 모두'는 전체 삭제와 같다
  const isFirst = !date || !firstKey || date <= firstKey || expand(event, firstKey, addDaysKey(date, -1)).length === 0

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      onOpenChange(false)
      goBack('/')
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="일정 삭제">
      <div className="flex flex-col gap-2 pb-2">
        {event.rrule && date && !isFirst ? (
          <>
            <Button variant="soft" disabled={busy} onClick={() => run(() => series.mutateAsync({ event, date, mode: 'only' }))}>
              이 일정만 삭제
            </Button>
            <Button
              variant="soft"
              disabled={busy}
              onClick={() => run(() => series.mutateAsync({ event, date, mode: 'following' }))}
            >
              이 일정과 이후 일정 삭제
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => del.mutateAsync(event.id))}>
              반복 일정 전체 삭제
            </Button>
          </>
        ) : event.rrule && date ? (
          <>
            <Button variant="soft" disabled={busy} onClick={() => run(() => series.mutateAsync({ event, date, mode: 'only' }))}>
              이 일정만 삭제
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => del.mutateAsync(event.id))}>
              반복 일정 전체 삭제
            </Button>
          </>
        ) : (
          <>
            <p className="pb-2 text-sm text-ink-soft">삭제하면 댓글과 반응도 함께 사라져요.</p>
            <Button variant="danger" disabled={busy} onClick={() => run(() => del.mutateAsync(event.id))}>
              삭제하기
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  )
}

// 이 일정(데이트)에 붙인 사진
function EventPhotos({ eventId, takenOn }: { eventId: string; takenOn: DateKey }) {
  const photos = usePhotos({ eventId })
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-semibold">
        사진 {photos.data?.length ? <span className="text-ink-soft">{photos.data.length}</span> : null}
      </h2>
      {photos.data && photos.data.length > 0 ? (
        <PhotoGrid photos={photos.data} />
      ) : (
        <p className="text-sm text-ink-soft">이날 찍은 사진을 남겨 봐요</p>
      )}
      <PhotoUploadButton takenOn={takenOn} eventId={eventId} />
    </Card>
  )
}
