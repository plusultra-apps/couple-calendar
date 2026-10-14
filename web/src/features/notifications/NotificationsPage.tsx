import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorText, Spinner } from '../../components/ui'
import { diffDays, fmt, fmtTime, toKey, todayKey } from '../../lib/dates'
import { toMessage } from '../../lib/supabase'
import type { AppNotification } from '../../types/database'
import { useClearNotifications, useMarkRead, useNotifications } from './queries'

// 알림 종류 → 동그라미 색 (테마 토큰)
const KIND_BG: Record<string, string> = {
  event: 'bg-us/50',
  comment: 'bg-partner/40',
  wish: 'bg-anniv/60',
  anniv: 'bg-anniv/60',
  photo: 'bg-me/50',
  like: 'bg-partner/40',
  reminder: 'bg-accent/30',
  game: 'bg-free/50',
}

// 제목 맨 앞 이모지를 동그라미에 쓰고, 나머지를 글로
function splitEmoji(title: string): [string, string] {
  const m = title.match(/^(\p{Extended_Pictographic}️?)\s*/u)
  return m ? [m[1], title.slice(m[0].length)] : ['🔔', title]
}

function when(iso: string): string {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const days = diffDays(todayKey(), toKey(d))
  if (days === 0) return fmtTime(d)
  if (days === 1) return `어제 ${fmtTime(d)}`
  return fmt(d, 'M월 d일')
}

function groupOf(iso: string): string {
  const days = diffDays(todayKey(), toKey(new Date(iso)))
  return days === 0 ? '오늘' : days === 1 ? '어제' : days < 7 ? '이번 주' : '이전'
}

// 알림함: 상대가 한 일 · 미리 알림을 모아 본다. 들어오면 모두 읽음으로 바꾸고, 방금까지 안 읽었던 건 표시를 남겨 둔다.
export function NotificationsPage() {
  const navigate = useNavigate()
  const list = useNotifications()
  const markRead = useMarkRead()
  const clear = useClearNotifications()
  const [fresh, setFresh] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!list.data || fresh) return
    const unread = list.data.filter((n) => !n.read_at).map((n) => n.id)
    setFresh(new Set(unread))
    if (unread.length) markRead.mutate(unread)
  }, [list.data, fresh, markRead])

  const groups = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = []
    for (const n of list.data ?? []) {
      const label = groupOf(n.created_at)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(n)
      else out.push({ label, items: [n] })
    }
    return out
  }, [list.data])

  const hasRead = (list.data ?? []).some((n) => n.read_at && !fresh?.has(n.id))

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="알림"
        back
        right={
          hasRead && (
            <button
              type="button"
              onClick={() => window.confirm('읽은 알림을 모두 지울까요?') && clear.mutate()}
              disabled={clear.isPending}
              className="flex h-10 items-center gap-1 rounded-full px-3 text-sm text-ink-soft active:bg-line"
            >
              <Trash2 className="h-4 w-4" /> 정리
            </button>
          )
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-8">
        {list.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : list.error ? (
          <ErrorText>{toMessage(list.error)}</ErrorText>
        ) : groups.length === 0 ? (
          <EmptyState emoji="🔔" title="아직 알림이 없어요">
            상대가 일정·사진·댓글을 남기거나 기념일이 다가오면 여기에 모여요.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-1.5 px-1 text-base text-ink-soft">{g.label}</h2>
              <div className="flex flex-col gap-2">
                {g.items.map((n) => {
                  const [emoji, title] = splitEmoji(n.title)
                  const isNew = fresh?.has(n.id)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => navigate(n.url || '/')}
                      className={`flex items-start gap-3 rounded-[22px] border-2 p-3 text-left transition active:scale-[0.98] ${
                        isNew ? 'border-partner bg-surface shadow-[0_3px_0_var(--color-partner)]' : 'border-line bg-surface/70'
                      }`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${KIND_BG[n.kind] ?? 'bg-bg'}`}>
                        {emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[15px] leading-snug ${isNew ? 'font-bold' : ''}`}>{title}</span>
                        {n.body && <span className="mt-0.5 block truncate text-sm text-ink-soft">{n.body}</span>}
                        <span className="mt-1 block text-xs text-ink-soft">{when(n.created_at)}</span>
                      </span>
                      {isNew && <span aria-label="새 알림" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
                    </button>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
