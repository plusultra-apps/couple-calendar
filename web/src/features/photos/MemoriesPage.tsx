import { useQuery } from '@tanstack/react-query'
import { Grid3x3, Heart, ImagePlus, MessageCircle, Pencil, Rows3 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { DateButton } from '../../components/DateTimePicker'
import { IconButton, PageHeader } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { EmptyState, Segmented, Spinner } from '../../components/ui'
import { anniversariesBetween } from '../../lib/anniversary'
import { fmt, fromKey, todayKey } from '../../lib/dates'
import { useSignedUrls } from '../../lib/photos'
import { supabase } from '../../lib/supabase'
import type { Photo } from '../../types/database'
import { useAnnivInput } from '../anniversary/queries'
import { displayTitle } from '../events/queries'
import { useToggleLike, usePhotoLikes } from './likes'
import { PhotoGrid, PhotoUploadButton } from './PhotoGrid'
import { usePhotos, useUpdatePhoto } from './queries'

const VIEW_KEY = 'ourcal.memories.view'

// 같은 날 · 같은 일정의 사진을 게시물 하나로
type Post = { key: string; date: string; eventId: string | null; photos: Photo[] }

function toPosts(photos: Photo[]): Post[] {
  const map = new Map<string, Post>()
  for (const p of photos) {
    const key = p.event_id ? `e:${p.event_id}` : `d:${p.taken_on}:${p.kind}`
    const post = map.get(key) ?? { key, date: p.taken_on, eventId: p.event_id, photos: [] }
    post.photos.push(p)
    map.set(key, post)
  }
  for (const post of map.values()) post.photos.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || b.photos[0].created_at.localeCompare(a.photos[0].created_at))
}

// 사진이 붙은 일정의 제목·장소·댓글 수
function useEventInfo(eventIds: string[]) {
  return useQuery({
    queryKey: ['photos', 'events', eventIds],
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const [ev, cm] = await Promise.all([
        supabase.from('events').select('*, event_secrets(*)').in('id', eventIds),
        supabase.from('event_comments').select('event_id').in('event_id', eventIds),
      ])
      if (ev.error) throw ev.error
      const comments = new Map<string, number>()
      for (const c of cm.data ?? []) comments.set(c.event_id, (comments.get(c.event_id) ?? 0) + 1)
      return Object.fromEntries(
        ev.data.map((e) => [
          e.id,
          { title: displayTitle(e), location: e.is_private ? null : e.location, comments: comments.get(e.id) ?? 0 },
        ]),
      )
    },
  })
}

export function MemoriesPage() {
  const photos = usePhotos()
  const [view, setView] = useState<'feed' | 'grid'>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as 'feed' | 'grid') ?? 'feed'
    } catch {
      return 'feed'
    }
  })
  const [uploadOpen, setUploadOpen] = useState(false)
  const changeView = (v: 'feed' | 'grid') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* 무시 */
    }
  }

  const posts = useMemo(() => toPosts(photos.data ?? []), [photos.data])
  const eventIds = useMemo(() => [...new Set(posts.map((p) => p.eventId).filter(Boolean) as string[])], [posts])
  const events = useEventInfo(eventIds)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="추억"
        right={
          <>
            <IconButton label="크게 보기" onClick={() => changeView('feed')} className={view === 'feed' ? 'text-accent' : 'text-ink-soft'}>
              <Rows3 className="h-5 w-5" />
            </IconButton>
            <IconButton label="모아 보기" onClick={() => changeView('grid')} className={view === 'grid' ? 'text-accent' : 'text-ink-soft'}>
              <Grid3x3 className="h-5 w-5" />
            </IconButton>
          </>
        }
      />

      {photos.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState emoji="📷" title="아직 추억이 없어요">
          데이트한 날 찍은 사진을 올려 보세요
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="px-1 pb-28">
          <PhotoGrid photos={photos.data ?? []} square gap="gap-0.5" rounded="rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-3 pb-28">
          {posts.map((post) => (
            <PostCard key={post.key} post={post} event={post.eventId ? events.data?.[post.eventId] : undefined} />
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label="사진 올리기"
        onClick={() => setUploadOpen(true)}
        className="press-3d fixed right-[max(1rem,calc(50%-14rem+1rem))] bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-30 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-accent text-white [--shade:var(--color-accent-deep)]"
      >
        <ImagePlus className="h-7 w-7" />
      </button>
      <UploadSheet open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}

function PostCard({ post, event }: { post: Post; event?: { title: string; location: string | null; comments: number } }) {
  const navigate = useNavigate()
  const { couple, userId } = useCoupleCtx()
  const annivInput = useAnnivInput()
  const urls = useSignedUrls(post.photos.flatMap((p) => [p.path, p.thumb_path]))
  const authors = [...new Set(post.photos.map((p) => p.created_by))]
    .map((id) => couple.members.find((m) => m.id === id))
    .filter(Boolean)
  const avatarUrls = useSignedUrls(authors.map((a) => a!.photo_path))
  const likes = usePhotoLikes()
  const toggle = useToggleLike(userId)
  const update = useUpdatePhoto()
  const [index, setIndex] = useState(0)
  const [burst, setBurst] = useState(0)
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState(post.photos[0].caption ?? '')
  const lastTap = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)

  const current = post.photos[Math.min(index, post.photos.length - 1)]
  const currentLikes = (likes.data ?? []).filter((l) => l.photo_id === current.id)
  const liked = currentLikes.some((l) => l.user_id === userId)
  const likers = currentLikes.map((l) => couple.members.find((m) => m.id === l.user_id)?.nickname).filter(Boolean)
  const anniv = anniversariesBetween(annivInput, post.date, post.date)[0]
  const title = event?.title ?? (anniv ? `${anniv.emoji} ${anniv.title}` : fmt(fromKey(post.date), 'M월 d일의 추억'))
  const first = post.photos[0]
  // 첫 사진 비율로 높이를 정한다 (세로 4:5 ~ 가로 1.91:1 사이)
  const ratio = first.width && first.height ? Math.min(1.91, Math.max(0.8, first.width / first.height)) : 1

  function onTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      setBurst((b) => b + 1)
      if (!liked) toggle.mutate({ photoId: current.id, on: true })
    }
    lastTap.current = now
  }

  function saveCaption() {
    setEditing(false)
    const next = caption.trim() || null
    if (next !== (first.caption ?? null)) update.mutate({ id: first.id, caption: next })
  }

  return (
    <article className="overflow-hidden rounded-[28px] border-2 border-line bg-surface shadow-[0_5px_0_var(--color-line)]">
      {/* 머리 */}
      <header className="flex items-center gap-2.5 px-3.5 py-3">
        <div className="flex -space-x-2">
          {authors.map((a) => (
            <span
              key={a!.id}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white text-lg"
              style={{ backgroundColor: a!.color }}
            >
              {a!.photo_path && avatarUrls.data?.[a!.photo_path] ? (
                <img src={avatarUrls.data[a!.photo_path]} alt="" className="h-full w-full object-cover" />
              ) : (
                a!.avatar
              )}
            </span>
          ))}
        </div>
        <button
          type="button"
          disabled={!post.eventId}
          onClick={() => post.eventId && navigate(`/event/${post.eventId}?date=${post.date}`)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="font-display block truncate text-[16px]">{title}</span>
          <span className="block truncate text-xs text-ink-soft">
            {fmt(fromKey(post.date), 'yyyy년 M월 d일 (EEE)')}
            {event?.location && ` · ${event.location}`}
          </span>
        </button>
        {post.photos[0].kind === 'fourcut' && (
          <span className="font-display shrink-0 rounded-full bg-partner/30 px-2.5 py-1 text-xs text-accent-deep">인생네컷</span>
        )}
      </header>

      {/* 사진 넘기기 */}
      <div className="relative bg-ink/5">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget
            setIndex(Math.round(el.scrollLeft / el.clientWidth))
          }}
          onClick={onTap}
          className="flex touch-manipulation snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        >
          {post.photos.map((p) => (
            <div key={p.id} className="w-full shrink-0 snap-center" style={{ aspectRatio: String(ratio) }}>
              {(urls.data?.[p.path] || urls.data?.[p.thumb_path]) && (
                <img
                  src={urls.data?.[p.path] ?? urls.data?.[p.thumb_path]}
                  alt={p.caption ?? ''}
                  loading="lazy"
                  draggable={false}
                  className={`h-full w-full select-none ${p.kind === 'fourcut' ? 'object-contain' : 'object-cover'}`}
                />
              )}
            </div>
          ))}
        </div>
        {/* 두 번 탭 하트 */}
        {burst > 0 && (
          <Heart
            key={burst}
            className="animate-pop pointer-events-none absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 fill-white text-white opacity-90 drop-shadow-lg"
            onAnimationEnd={() => setBurst(0)}
          />
        )}
        {post.photos.length > 1 && (
          <span className="font-display absolute top-3 right-3 rounded-full bg-ink/50 px-2.5 py-0.5 text-xs text-white">
            {index + 1}/{post.photos.length}
          </span>
        )}
      </div>

      {/* 아래: 좋아요 · 댓글 · 점 · 캡션 */}
      <div className="flex flex-col gap-1.5 px-3.5 pt-2.5 pb-3.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={liked ? '좋아요 취소' : '좋아요'}
            onClick={() => toggle.mutate({ photoId: current.id, on: !liked })}
            className="flex h-10 w-10 items-center justify-center rounded-full active:scale-90"
          >
            <Heart className={`h-7 w-7 transition ${liked ? 'animate-pop fill-accent text-accent' : 'text-ink'}`} />
          </button>
          {post.eventId && (
            <button
              type="button"
              aria-label="댓글"
              onClick={() => navigate(`/event/${post.eventId}?date=${post.date}`)}
              className="flex h-10 items-center gap-1 rounded-full px-2 active:scale-95"
            >
              <MessageCircle className="h-7 w-7" />
              {event?.comments ? <span className="text-sm font-bold">{event.comments}</span> : null}
            </button>
          )}
          {post.photos.length > 1 && (
            <div className="mx-auto flex gap-1 pr-16">
              {post.photos.map((p, i) => (
                <span key={p.id} className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'bg-accent' : 'bg-line-deep'}`} />
              ))}
            </div>
          )}
        </div>

        {likers.length > 0 && <p className="text-sm font-bold">{likers.join(', ')}님이 좋아해요</p>}

        {editing ? (
          <div className="flex gap-2">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCaption()}
              maxLength={200}
              autoFocus
              placeholder="이날 어땠어요?"
              className="h-10 min-w-0 flex-1 rounded-full border-2 border-line bg-bg px-4 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={saveCaption} className="font-display shrink-0 rounded-full bg-accent px-4 text-sm text-white">
              저장
            </button>
          </div>
        ) : first.caption ? (
          <button type="button" onClick={() => setEditing(true)} className="text-left text-[15px] whitespace-pre-wrap">
            {first.caption}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-left text-sm text-ink-soft"
          >
            <Pencil className="h-3.5 w-3.5" /> 한 줄 남기기
          </button>
        )}
      </div>
    </article>
  )
}

// 올리기: 날짜·종류 고르고 사진 선택
function UploadSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [date, setDate] = useState(todayKey())
  const [kind, setKind] = useState<'photo' | 'fourcut'>('photo')
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="추억 올리기">
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-bold text-ink-soft">언제 사진인가요?</span>
          <DateButton value={date} onChange={setDate} title="사진 찍은 날" />
        </div>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'photo', label: '사진' },
            { value: 'fourcut', label: '인생네컷' },
          ]}
        />
        <PhotoUploadButton takenOn={date} kind={kind} label="사진 고르기" />
        <p className="px-1 text-xs text-ink-soft">여러 장을 한 번에 골라도 돼요. 같은 날 사진은 한 게시물로 묶여요.</p>
      </div>
    </Sheet>
  )
}
