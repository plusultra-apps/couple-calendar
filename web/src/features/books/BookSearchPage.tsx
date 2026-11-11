import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Card, EmptyState, ErrorText, Input, Spinner } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { Cover } from './BooksPage'
import { type SearchBook, searchBooks, useBooks, useSaveBook } from './queries'

// 책 찾기: 제목이나 저자를 적으면 검색 결과가 나오고, 마음에 드는 책을 우리 서재에 담는다.
export function BookSearchPage() {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [savedNow, setSavedNow] = useState<string[]>([])
  const books = useBooks()
  const save = useSaveBook()

  // 입력이 멈추면 0.4초 뒤에 검색
  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 400)
    return () => window.clearTimeout(t)
  }, [input])

  const result = useInfiniteQuery({
    queryKey: ['book-search', q],
    enabled: q.length > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchBooks(q, pageParam),
    getNextPageParam: (last, all) => (last.end ? undefined : all.length + 1),
  })

  // 이미 담긴 책은 '담김'으로 (isbn 기준)
  const inShelf = useMemo(() => new Set((books.data ?? []).map((b) => b.isbn)), [books.data])
  const list: SearchBook[] = result.data?.pages.flatMap((p) => p.books) ?? []

  async function add(b: SearchBook) {
    setError('')
    try {
      await save.mutateAsync({ isbn: b.isbn, title: b.title, authors: b.authors, publisher: b.publisher, thumbnail: b.thumbnail })
      setSavedNow((s) => [...s, b.isbn])
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="책 찾기" back />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="책 제목이나 저자"
          type="search"
          maxLength={100}
          aria-label="책 제목이나 저자"
        />
        <ErrorText>{error || (result.isError ? toMessage(result.error) : '')}</ErrorText>

        {!q ? (
          <EmptyState emoji="🔎" title="읽고 싶은 책을 찾아 보세요" />
        ) : result.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <EmptyState emoji="🫥" title="검색 결과가 없어요">
            다른 단어로 다시 찾아 보세요.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((b) => {
              const added = inShelf.has(b.isbn) || savedNow.includes(b.isbn)
              return (
                <li key={b.isbn}>
                  <Card className="flex items-center gap-3 p-3">
                    <Cover book={{ title: b.title, thumbnail: b.thumbnail }} className="h-[84px] w-[60px] shrink-0 rounded-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{b.title}</p>
                      <p className="truncate text-sm text-ink-soft">{[b.authors, b.publisher].filter(Boolean).join(' · ')}</p>
                      {b.year && <p className="text-xs text-ink-soft">{b.year}년</p>}
                    </div>
                    {added ? (
                      <span className="font-display shrink-0 rounded-full border-2 border-accent/40 px-3 py-1 text-sm text-accent-deep">담김</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(b)}
                        disabled={save.isPending}
                        className="font-display press-3d h-10 shrink-0 rounded-full bg-accent px-4 text-[15px] text-white [--shade:var(--color-accent-deep)] disabled:opacity-50"
                      >
                        담기
                      </button>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}

        {result.hasNextPage && (
          <button
            type="button"
            onClick={() => result.fetchNextPage()}
            disabled={result.isFetchingNextPage}
            className="font-display h-11 rounded-full border-2 border-line bg-surface text-[15px] active:scale-95 disabled:opacity-50"
          >
            {result.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </button>
        )}
      </div>
    </>
  )
}
