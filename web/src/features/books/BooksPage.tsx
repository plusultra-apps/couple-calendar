import { BookOpen, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorText, Segmented, Spinner } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { type BookRow, type BookStatus, type Progress, useBooks } from './queries'

const STATUS_LABEL: Record<BookStatus, string> = { wish: '읽고 싶어요', reading: '읽는 중', done: '완독' }
const STATUS_STYLE: Record<BookStatus, string> = {
  wish: 'bg-anniv/25 text-ink',
  reading: 'bg-partner/30 text-ink',
  done: 'bg-us/30 text-ink',
}

// 우리 서재: 책 하나에 두 사람이 각자 읽은 상태가 보인다.
export function BooksPage() {
  const { me, partner } = useCoupleCtx()
  const books = useBooks()
  const [filter, setFilter] = useState<'all' | BookStatus>('all')

  if (books.isPending) {
    return (
      <>
        <PageHeader title="우리 서재" back />
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </>
    )
  }
  if (books.isError) {
    return (
      <>
        <PageHeader title="우리 서재" back />
        <div className="px-4 pt-4">
          <ErrorText>{toMessage(books.error)}</ErrorText>
        </div>
      </>
    )
  }

  const list = books.data
  const members = [
    { id: me.id, name: me.nickname || '나', avatar: me.avatar },
    ...(partner ? [{ id: partner.id, name: partner.nickname || '상대', avatar: partner.avatar }] : []),
  ]
  // 필터: 둘 중 한 명이라도 그 상태면 보인다
  const hasStatus = (b: BookRow, s: BookStatus) => members.some((m) => b.progress[m.id]?.status === s)
  const shown = filter === 'all' ? list : list.filter((b) => hasStatus(b, filter))
  const count = (uid: string, s: BookStatus) => list.filter((b) => b.progress[uid]?.status === s).length

  return (
    <>
      <PageHeader title="우리 서재" back />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-28">
        {/* 사람별 요약 */}
        <div className="grid grid-cols-2 gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-[20px] border-2 border-line bg-surface px-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-xl" aria-hidden>
                {m.avatar}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{m.name}</p>
                <p className="text-xs text-ink-soft">
                  완독 {count(m.id, 'done')} · 읽는 중 {count(m.id, 'reading')}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'reading', label: '읽는 중' },
            { value: 'done', label: '완독' },
            { value: 'wish', label: '읽고 싶어요' },
          ]}
        />

        {list.length === 0 ? (
          <EmptyState emoji="📚" title="아직 담긴 책이 없어요">
            읽고 싶은 책을 찾아서 담아 보세요.
          </EmptyState>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">이 상태의 책이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((b) => (
              <li key={b.id}>
                <BookRowCard book={b} members={members} />
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/books/search"
          className="font-display press-3d flex h-12 items-center justify-center gap-1.5 rounded-full bg-accent text-[17px] text-white [--shade:var(--color-accent-deep)]"
        >
          <Plus className="h-5 w-5" aria-hidden /> 책 찾기
        </Link>
      </div>
    </>
  )
}

function BookRowCard({ book, members }: { book: BookRow; members: { id: string; name: string; avatar: string }[] }) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="flex gap-3 rounded-[22px] border-2 border-line bg-surface p-3 transition active:scale-[0.98]"
    >
      <Cover book={book} className="h-[84px] w-[60px] shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{book.title}</p>
        <p className="truncate text-sm text-ink-soft">{book.authors ?? ''}</p>
        <div className="mt-2 flex flex-col gap-1">
          {members.map((m) => (
            <PersonStatus key={m.id} name={m.name} avatar={m.avatar} progress={book.progress[m.id]} />
          ))}
        </div>
      </div>
    </Link>
  )
}

// 한 사람의 상태 한 줄: 🐻 나 · 완독 ★4
function PersonStatus({ name, avatar, progress }: { name: string; avatar: string; progress?: Progress }) {
  const status = progress?.status as BookStatus | undefined
  return (
    <div className="flex items-center gap-2 text-sm">
      <span aria-hidden>{avatar}</span>
      <span className="w-12 shrink-0 truncate text-xs text-ink-soft">{name}</span>
      {status ? (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
      ) : (
        <span className="text-xs text-ink-soft">아직</span>
      )}
      {progress?.rating ? (
        <span className="flex items-center gap-0.5 text-xs text-accent-deep">
          <Star className="h-3 w-3 fill-current" aria-hidden />
          {progress.rating}
        </span>
      ) : null}
    </div>
  )
}

// 표지: 카카오가 준 주소가 있으면 그 그림, 없으면 책 아이콘 블록
export function Cover({ book, className = '' }: { book: Pick<BookRow, 'title' | 'thumbnail'>; className?: string }) {
  if (book.thumbnail) {
    return <img src={book.thumbnail} alt="" loading="lazy" className={`object-cover ${className}`} />
  }
  return (
    <span aria-hidden className={`flex items-center justify-center bg-linear-to-br from-anniv/50 to-partner/50 text-ink ${className}`}>
      <BookOpen className="h-6 w-6" />
    </span>
  )
}
