import { Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { DateButton } from '../../components/DateTimePicker'
import { PageHeader } from '../../components/PageHeader'
import { Button, Card, EmptyState, ErrorText, Segmented, Spinner, Toggle } from '../../components/ui'
import { fmt, fromKey, todayKey } from '../../lib/dates'
import { toMessage } from '../../lib/supabase'
import { Cover } from './BooksPage'
import {
  type BookStatus,
  type Progress,
  type ProgressPatch,
  useAddNote,
  useBookNotes,
  useBooks,
  useDeleteBook,
  useDeleteNote,
  useFinishBean,
  useSetProgress,
} from './queries'

const STATUS_LABEL: Record<BookStatus, string> = { wish: '읽고 싶어요', reading: '읽는 중', done: '완독' }

// 책 상세: 나와 상대의 읽은 상태, 둘이 함께 쓰는 한 줄 기록, 완독하면 콩 하나
export function BookDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { me, partner, userId } = useCoupleCtx()
  const books = useBooks()
  const book = books.data?.find((b) => b.id === id)
  const notes = useBookNotes(id)
  const setProgress = useSetProgress(id)
  const addNote = useAddNote(id)
  const delNote = useDeleteNote(id)
  const delBook = useDeleteBook()
  const finishBean = useFinishBean()
  const [note, setNote] = useState('')
  const [beanOnFinish, setBeanOnFinish] = useState(true)
  const [error, setError] = useState('')

  if (books.isPending) {
    return (
      <>
        <PageHeader title="책" back />
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </>
    )
  }
  if (!book) {
    return (
      <>
        <PageHeader title="책" back />
        <EmptyState emoji="📚" title="책을 찾을 수 없어요">
          이미 서재에서 뺐을 수 있어요.
        </EmptyState>
      </>
    )
  }

  const mine: Progress | undefined = book.progress[userId]
  const theirs: Progress | undefined = partner ? book.progress[partner.id] : undefined
  const myStatus = (mine?.status ?? 'wish') as BookStatus
  const nameOf = (uid: string) => (uid === me.id ? me.nickname : partner?.nickname) || '상대'
  const emojiOf = (uid: string) => (uid === me.id ? me.avatar : partner?.avatar) ?? '💗'

  // 내 상태를 바꾸면 날짜도 함께 채운다 (읽기 시작 · 완독)
  async function changeStatus(next: BookStatus) {
    setError('')
    const today = todayKey()
    const patch: ProgressPatch = {
      status: next,
      ...(next === 'reading' && !mine?.started_on ? { started_on: today } : {}),
      ...(next === 'done' && !mine?.finished_on ? { finished_on: today } : {}),
    }
    try {
      await setProgress.mutateAsync(patch)
      if (next === 'done' && myStatus !== 'done' && beanOnFinish) {
        await finishBean.mutateAsync(patch.finished_on ?? mine?.finished_on ?? today)
      }
    } catch (e) {
      setError(toMessage(e))
    }
  }

  async function saveNote() {
    const body = note.trim()
    if (!body) return
    setError('')
    try {
      await addNote.mutateAsync(body)
      setNote('')
    } catch (e) {
      setError(toMessage(e))
    }
  }

  async function removeBook() {
    if (!window.confirm(`‘${book!.title}’을(를) 우리 서재에서 뺄까요?\n남긴 한 줄 기록도 함께 지워져요.`)) return
    try {
      await delBook.mutateAsync(id)
      navigate('/books', { replace: true })
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="책" back />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        {/* 책 정보 */}
        <div className="flex items-end gap-4">
          <Cover book={book} className="h-[150px] w-[104px] shrink-0 rounded-[14px] shadow-md" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display text-2xl leading-tight">{book.title}</h1>
            <p className="mt-2 text-sm text-ink-soft">{book.authors ?? ''}</p>
            <p className="text-xs text-ink-soft">{book.publisher ?? ''}</p>
          </div>
        </div>

        {/* 두 사람의 읽은 상태 */}
        <Card className="flex flex-col gap-2 p-4">
          <PersonLine name={nameOf(userId)} avatar={emojiOf(userId)} progress={mine} />
          {partner && <PersonLine name={nameOf(partner.id)} avatar={emojiOf(partner.id)} progress={theirs} />}
        </Card>

        {/* 내 상태 바꾸기 */}
        <div className="flex flex-col gap-2">
          <span className="px-1 text-sm font-bold text-ink-soft">나는</span>
          <Segmented
            value={myStatus}
            onChange={changeStatus}
            options={[
              { value: 'wish', label: '읽고 싶어요' },
              { value: 'reading', label: '읽는 중' },
              { value: 'done', label: '완독' },
            ]}
          />
        </div>

        {/* 내 별점 */}
        <Card className="flex items-center justify-between gap-3 p-4">
          <span className="font-bold">내 별점</span>
          <div role="radiogroup" aria-label="별점" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={mine?.rating === n}
                aria-label={`${n}점`}
                onClick={() => setProgress.mutate({ rating: mine?.rating === n ? null : n })}
                className="flex h-10 w-9 items-center justify-center active:scale-90"
              >
                <Star className={`h-7 w-7 ${mine?.rating && n <= mine.rating ? 'fill-accent text-accent' : 'text-line-deep'}`} aria-hidden />
              </button>
            ))}
          </div>
        </Card>

        {/* 내 날짜 */}
        {myStatus !== 'wish' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="px-1 text-sm font-bold text-ink-soft">읽기 시작</span>
              <DateButton
                value={mine?.started_on ?? ''}
                max={todayKey()}
                onChange={(d) => setProgress.mutate({ started_on: d })}
                title="읽기 시작한 날"
                quick={false}
                placeholder="날짜 고르기"
              />
            </div>
            {myStatus === 'done' && (
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-sm font-bold text-ink-soft">완독</span>
                <DateButton
                  value={mine?.finished_on ?? ''}
                  max={todayKey()}
                  onChange={(d) => setProgress.mutate({ finished_on: d })}
                  title="완독한 날"
                  quick={false}
                  placeholder="날짜 고르기"
                />
              </div>
            )}
          </div>
        )}

        {/* 완독하면 콩 */}
        {myStatus !== 'done' && (
          <Card className="p-4">
            <Toggle checked={beanOnFinish} onChange={setBeanOnFinish} label="완독하면 콩 하나 넣기" />
          </Card>
        )}

        {/* 한 줄 기록 */}
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-display text-lg">한 줄 기록</h2>
          {notes.isPending ? (
            <Spinner />
          ) : (notes.data ?? []).length === 0 ? null : (
            <ul className="flex flex-col gap-3">
              {(notes.data ?? []).map((n) => {
                const isMine = n.user_id === userId
                return (
                  <li key={n.id} className={`flex gap-2.5 ${isMine ? '' : 'flex-row-reverse text-right'}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-lg" aria-hidden>
                      {emojiOf(n.user_id)}
                    </span>
                    <div className={`min-w-0 flex-1 rounded-[18px] border-2 px-3.5 py-2.5 ${isMine ? 'border-line bg-surface' : 'border-partner/40 bg-partner/15'}`}>
                      <p className="text-xs text-ink-soft">
                        {nameOf(n.user_id)} · {fmt(fromKey(n.created_at.slice(0, 10)), 'M/d')}
                      </p>
                      <p className="mt-0.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{n.body}</p>
                    </div>
                    {isMine && (
                      <button
                        type="button"
                        aria-label="이 기록 지우기"
                        onClick={() => window.confirm('이 한 줄을 지울까요?') && delNote.mutate(n.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-ink-soft active:bg-line"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="지금 떠오르는 한 줄"
            aria-label="한 줄 기록"
            className="w-full resize-none rounded-[16px] border-2 border-line bg-bg px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
          />
          <div className="flex justify-end">
            <Button className="w-auto px-6" onClick={saveNote} disabled={!note.trim() || addNote.isPending}>
              저장
            </Button>
          </div>
        </Card>

        <ErrorText>{error}</ErrorText>

        <button type="button" onClick={removeBook} className="self-center text-sm text-ink-soft underline underline-offset-4">
          서재에서 빼기
        </button>
      </div>
    </>
  )
}

// 한 사람의 상태: 🐻 나 · 완독 ★4 (기록이 없으면 '아직')
function PersonLine({ name, avatar, progress }: { name: string; avatar: string; progress?: Progress }) {
  const status = progress?.status as BookStatus | undefined
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-lg" aria-hidden>
        {avatar}
      </span>
      <span className="min-w-0 flex-1 truncate font-bold">{name}</span>
      {status ? (
        <span className="text-sm">
          {STATUS_LABEL[status]}
          {progress?.rating ? <span className="ml-1.5 text-accent-deep">★{progress.rating}</span> : null}
        </span>
      ) : (
        <span className="text-sm text-ink-soft">아직</span>
      )}
    </div>
  )
}
