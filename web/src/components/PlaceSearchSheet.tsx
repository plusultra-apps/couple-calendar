import { useQuery } from '@tanstack/react-query'
import { MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { categoryEmoji, searchPlaces, type Place } from '../lib/place'
import { Sheet } from './Sheet'
import { EmptyState, Spinner } from './ui'

// 카카오맵 장소 검색 시트. 고르면 onPick(장소) 후 닫힌다.
export function PlaceSearchSheet({
  open,
  onOpenChange,
  initialQuery = '',
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initialQuery?: string
  onPick: (place: Place) => void
}) {
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery.trim())
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setInput(initialQuery)
      setQuery(initialQuery.trim())
    }
  }

  // 입력을 멈추고 0.35초 뒤 검색
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 350)
    return () => window.clearTimeout(t)
  }, [input])

  const result = useQuery({
    queryKey: ['place-search', query],
    enabled: open && query.length >= 2,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: () => searchPlaces(query),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="장소 찾기">
      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-3">
        <label className="flex h-12 items-center gap-2 rounded-full border-2 border-line bg-bg px-4 focus-within:border-accent">
          <Search className="h-5 w-5 shrink-0 text-ink-soft" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예) 성수 빵집, 강릉 카페"
            autoFocus
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        <p className="mt-1.5 px-2 text-xs text-ink-soft">카카오맵 장소 정보로 찾아요</p>
      </div>

      {query.length < 2 ? (
        <EmptyState emoji="🔎" title="어디 가고 싶어요?">
          동네 이름과 함께 검색하면 더 잘 찾아요
        </EmptyState>
      ) : result.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : result.isError ? (
        <EmptyState emoji="🙏" title="검색하지 못했어요">
          {(result.error as Error).message}
        </EmptyState>
      ) : result.data.length === 0 ? (
        <EmptyState emoji="🫥" title="찾는 곳이 없어요">
          다른 이름으로 검색해 볼까요?
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2 pb-2">
          {result.data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p)
                  onOpenChange(false)
                }}
                className="flex w-full items-center gap-3 rounded-[22px] border-2 border-line bg-surface px-3 py-2.5 text-left transition active:scale-[0.98] active:bg-bg"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg text-2xl">
                  {categoryEmoji(p)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate text-[17px]">{p.name}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-soft">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.address}</span>
                  </span>
                  <span className="block truncate text-[11px] text-ink-soft/80">{p.category.split(' > ').slice(-2).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
