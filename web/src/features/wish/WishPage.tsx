import { CalendarCheck, CalendarPlus, Check, ChevronRight, ClipboardPaste, ExternalLink, Map as MapIcon, MapPin, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { celebrateAt } from '../../lib/celebrate'
import { openKakaoPlace, parseShared, tagFromPlace } from '../../lib/place'
import { PlaceSearchSheet } from '../../components/PlaceSearchSheet'
import { PlaceInfoSheet, PlacePhotoStrip, usePlaceInfo, type PlaceRef } from '../../components/PlaceInfo'
import { useCoupleCtx } from '../../app/couple'
import { PageHeader } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { Button, EmptyState, ErrorText, Field, Spinner, Textarea } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { WISH_TAGS, type Wish, type WishTag } from '../../types/database'
import {
  hostOf,
  normalizeUrl,
  tagEmoji,
  TAG_EMOJI,
  useDeleteWish,
  useSaveWish,
  useToggleDone,
  useWishes,
} from './queries'

type TagFilter = 'all' | WishTag

export function WishPage() {
  const wishes = useWishes()
  const [tag, setTag] = useState<TagFilter>('all')
  const [showDone, setShowDone] = useState(false)
  // 편집 시트: null = 닫힘, 'new' = 새 위시, Wish = 수정
  const [editing, setEditing] = useState<Wish | 'new' | null>(null)
  const [formKey, setFormKey] = useState(0) // 열 때마다 폼 초기화
  const [prefill, setPrefill] = useState<WishPrefill | null>(null)
  const openEditor = (t: Wish | 'new', fill: WishPrefill | null = null) => {
    setPrefill(fill)
    setEditing(t)
    setFormKey((k) => k + 1)
  }

  // 다른 앱에서 공유받아 왔을 때 (/wish?add=1&title=…&url=…&memo=…) 바로 담기 창을 연다
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (!params.get('add')) return
    openEditor('new', {
      title: params.get('title') ?? '',
      url: params.get('url'),
      memo: params.get('memo') ?? '',
    })
    setParams({}, { replace: true })
  }, [params, setParams])

  const all = wishes.data ?? []
  const byTag = useMemo(() => (tag === 'all' ? all : all.filter((w) => w.tag === tag)), [all, tag])
  const doneCount = byTag.filter((w) => w.done).length
  const visible = showDone ? byTag : byTag.filter((w) => !w.done)
  const usedTags = useMemo(() => new Set(all.map((w) => w.tag)), [all])

  return (
    <div className="flex min-h-full flex-col pb-28">
      <PageHeader title="위시리스트" />

      <div className="flex flex-col gap-4 px-4">
        <Link
          to="/free"
          className="flex items-center gap-3 rounded-3xl bg-us/25 p-4 transition active:bg-us/40"
        >
          <CalendarCheck className="h-6 w-6 shrink-0 text-accent-deep" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold">둘 다 비는 날 찾기</span>
            <span className="text-sm text-ink-soft">위시를 언제 할지 정해 봐요</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" />
        </Link>

        {/* 태그 필터 */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="태그 필터">
          <Chip active={tag === 'all'} onClick={() => setTag('all')}>
            전체
          </Chip>
          {WISH_TAGS.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(t)} dim={!usedTags.has(t)}>
              {TAG_EMOJI[t]} {t}
            </Chip>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-ink-soft">
            {wishes.isPending ? '' : `${byTag.length - doneCount}개`}
          </span>
          {doneCount > 0 && (
            <button
              type="button"
              aria-pressed={showDone}
              onClick={() => setShowDone((v) => !v)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 font-semibold transition ${
                showDone ? 'bg-accent/15 text-accent' : 'border-2 border-line bg-surface text-ink-soft'
              }`}
            >
              {showDone ? '완료 숨기기' : `완료 ${doneCount}`}
            </button>
          )}
        </div>

        {wishes.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : wishes.error ? (
          <EmptyState emoji="🥲" title="위시를 불러오지 못했어요">
            {toMessage(wishes.error)}
            <button type="button" onClick={() => wishes.refetch()} className="mt-3 block w-full font-semibold text-accent">
              다시 시도
            </button>
          </EmptyState>
        ) : all.length === 0 ? (
          <EmptyState emoji="🌈" title="아직 담아 둔 위시가 없어요">
            가 보고 싶은 맛집, 보고 싶은 영화, 언젠가 떠날 여행지…
            <br />
            생각날 때마다 하나씩 모아 둬요.
            <div className="mt-5">
              <Button onClick={() => openEditor('new')} className="mx-auto max-w-56">
                첫 위시 담기
              </Button>
            </div>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState emoji={tag === 'all' ? '🎉' : tagEmoji(tag)} title={emptyTitle(tag, doneCount)}>
            {doneCount > 0 && !showDone ? '완료한 것 보기를 누르면 지난 추억도 볼 수 있어요.' : '+ 버튼으로 새 위시를 담아 보세요.'}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((w) => (
              <li key={w.id}>
                <WishCard wish={w} onEdit={() => openEditor(w)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        aria-label="위시 추가"
        onClick={() => openEditor('new')}
        className="fixed right-[max(1rem,calc(50%-14rem+1rem))] bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
      >
        <Plus className="h-7 w-7" />
      </button>

      <WishSheet
        target={editing}
        formKey={formKey}
        defaultTag={tag === 'all' ? '기타' : tag}
        prefill={prefill}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function emptyTitle(tag: TagFilter, doneCount: number) {
  if (doneCount > 0) return tag === 'all' ? '담아 둔 위시를 모두 해냈어요!' : `${tag} 위시를 모두 해냈어요!`
  return tag === 'all' ? '아직 위시가 없어요' : `${tag} 위시가 아직 없어요`
}

function Chip({
  active,
  dim,
  onClick,
  children,
}: {
  active: boolean
  dim?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition ${
        active ? 'press-3d border-2 border-accent-deep bg-accent text-white [--shade:var(--color-accent-deep)]' : `border-2 border-line bg-surface ${dim ? 'text-ink-soft/70' : 'text-ink'}`
      }`}
    >
      {children}
    </button>
  )
}

function WishCard({ wish, onEdit }: { wish: Wish; onEdit: () => void }) {
  const navigate = useNavigate()
  const { couple } = useCoupleCtx()
  const toggle = useToggleDone()
  const author = couple.members.find((m) => m.id === wish.created_by)
  const [placeOpen, setPlaceOpen] = useState(false)
  const photos = wish.photos.length ? wish.photos : wish.photo_url ? [wish.photo_url] : []
  const place: PlaceRef | null = wish.place_name
    ? { id: wish.place_id, name: wish.place_name, address: wish.place_address, url: wish.url, x: wish.place_x, y: wish.place_y }
    : wish.photo_url
      ? { name: wish.title }
      : null

  return (
    <article className={`rounded-[28px] border-2 border-line shadow-[0_5px_0_var(--color-line)] bg-surface p-4 transition ${wish.done ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={wish.done}
          aria-label={wish.done ? `${wish.title} 완료 취소` : `${wish.title} 완료로 표시`}
          onClick={(e) => {
            if (!wish.done) celebrateAt(e.currentTarget)
            toggle.mutate({ id: wish.id, done: !wish.done })
          }}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
            wish.done ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-transparent'
          }`}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </button>

        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 flex-col gap-1 text-left" aria-label={`${wish.title} 수정`}>
          <span className="text-xs font-semibold text-ink-soft">
            {tagEmoji(wish.tag)} {wish.tag}
          </span>
          <span className={`text-base leading-snug font-bold break-words ${wish.done ? 'line-through' : ''}`}>
            {wish.title}
          </span>
          {wish.memo && <span className="line-clamp-2 text-sm whitespace-pre-line text-ink-soft">{wish.memo}</span>}
        </button>

      </div>

      {/* 장소 사진을 카드에 바로 펼친다 */}
      {photos.length > 0 && (
        <button
          type="button"
          onClick={() => setPlaceOpen(true)}
          aria-label={`${wish.place_name ?? wish.title} 사진·후기 보기`}
          className="mt-3 ml-10 grid grid-cols-4 gap-1.5 active:scale-[0.99]"
          style={{ width: 'calc(100% - 2.5rem)' }}
        >
          {photos.slice(0, 4).map((src, i) => (
            <span key={src} className="relative aspect-square overflow-hidden rounded-2xl bg-bg">
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              {i === 3 && photos.length > 4 && (
                <span className="font-display absolute inset-0 flex items-center justify-center bg-ink/40 text-lg text-white">
                  +{photos.length - 4}
                </span>
              )}
            </span>
          ))}
        </button>
      )}

      {wish.place_name ? (
        <div className="mt-2.5 ml-10 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaceOpen(true)}
            className="font-display inline-flex max-w-full items-center gap-1 rounded-full bg-anniv/40 px-3 py-1.5 text-[13px] active:bg-anniv/60"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{wish.place_name}</span>
            <span className="shrink-0 text-ink-soft">· 사진·후기</span>
          </button>
          <button
            type="button"
            onClick={() => openKakaoPlace({ id: wish.place_id, url: wish.url, name: wish.place_name! })}
            className="font-display inline-flex items-center gap-1 rounded-full bg-[#FEE500] px-3 py-1.5 text-[13px] text-[#3C1E1E] active:brightness-95"
          >
            카카오맵
          </button>
        </div>
      ) : wish.url && (
        <a
          href={wish.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 ml-10 inline-flex max-w-[calc(100%-2.5rem)] items-center gap-1 rounded-full bg-me/20 px-3 py-1 text-xs font-semibold text-ink active:bg-me/40"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{hostOf(wish.url)}</span>
        </a>
      )}

      <div className="mt-3 ml-10 flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-ink-soft">
          {author && (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: author.color }} />
              <span className="truncate">{author.nickname}님이 담았어요</span>
            </>
          )}
        </span>
        {wish.event_id ? (
          <button
            type="button"
            onClick={() => navigate(`/event/${wish.event_id}`)}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-us/30 px-3 text-sm font-semibold active:bg-us/50"
          >
            <CalendarCheck className="h-4 w-4" /> 일정 보기
          </button>
        ) : (
          !wish.done && (
            <button
              type="button"
              onClick={() => navigate(`/event/new?title=${encodeURIComponent(wish.title)}&wish=${wish.id}`)}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-partner/30 px-3 text-sm font-semibold active:bg-partner/50"
            >
              <CalendarPlus className="h-4 w-4" /> 일정으로 만들기
            </button>
          )
        )}
      </div>
      {toggle.error && (
        <div className="mt-2 ml-10">
          <ErrorText>{toMessage(toggle.error)}</ErrorText>
        </div>
      )}
      <PlaceInfoSheet open={placeOpen} onOpenChange={setPlaceOpen} place={place} />
    </article>
  )
}

// 추가·수정 시트
function WishSheet({
  target,
  formKey,
  defaultTag,
  prefill,
  onClose,
}: {
  target: Wish | 'new' | null
  formKey: number
  defaultTag: WishTag
  prefill: WishPrefill | null
  onClose: () => void
}) {
  // 닫히는 애니메이션 동안 내용 유지
  const [last, setLast] = useState(target)
  if (target && target !== last) setLast(target)
  const shown = target ?? last

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()} title={shown === 'new' ? '새 위시 담기' : '위시 수정'}>
      {shown && (
        <WishForm
          key={formKey}
          wish={shown === 'new' ? null : shown}
          defaultTag={defaultTag}
          prefill={shown === 'new' ? prefill : null}
          onDone={onClose}
        />
      )}
    </Sheet>
  )
}

export type WishPrefill = { title?: string; url?: string | null; memo?: string; tag?: WishTag }

function WishForm({
  wish,
  defaultTag,
  prefill,
  onDone,
}: {
  wish: Wish | null
  defaultTag: WishTag
  prefill?: WishPrefill | null
  onDone: () => void
}) {
  const save = useSaveWish()
  const del = useDeleteWish()
  const [title, setTitle] = useState(wish?.title ?? prefill?.title ?? '')
  const [url, setUrl] = useState(wish?.url ?? prefill?.url ?? '')
  const [tag, setTag] = useState<WishTag>((wish?.tag as WishTag | undefined) ?? prefill?.tag ?? defaultTag)
  const [memo, setMemo] = useState(wish?.memo ?? prefill?.memo ?? '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const [place, setPlace] = useState<PlaceRef & { id?: string | null } | null>(
    wish?.place_name
      ? { id: wish.place_id, name: wish.place_name, address: wish.place_address, url: wish.url, x: wish.place_x, y: wish.place_y }
      : null,
  )
  const placeInfo = usePlaceInfo(place)
  const [pasteNote, setPasteNote] = useState('')

  // 복사해 둔 카카오맵·네이버지도 공유 글에서 링크(와 이름)를 꺼낸다
  async function pasteLink() {
    setPasteNote('')
    try {
      const text = await navigator.clipboard.readText()
      const shared = parseShared({ text })
      if (!shared.url) return setPasteNote('복사된 링크가 없어요. 카카오맵에서 공유 → 링크 복사를 먼저 해 주세요')
      setUrl(shared.url)
      if (!title.trim() && shared.title) setTitle(shared.title)
      if (!memo.trim() && shared.memo) setMemo(shared.memo)
      setPasteNote('붙여넣었어요')
    } catch {
      setPasteNote('붙여넣기 권한이 없어요. 아래 칸을 길게 눌러 붙여넣어 주세요')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const t = title.trim()
    if (!t) return setError('무엇을 하고 싶은지 적어 주세요')
    if (t.length > 100) return setError('제목은 100자까지 쓸 수 있어요')
    const u = normalizeUrl(url)
    if (u.error) return setError(u.error)
    try {
      // 대표 사진: 장소 사진 첫 장 (카카오 썸네일 — 잘 막히지 않는다). 아직 불러오는 중이면 기다린다.
      let photo = wish?.photo_url ?? null
      let photos = wish?.photos ?? []
      if (place) {
        try {
          const info = placeInfo.data ?? (await placeInfo.refetch({ cancelRefetch: false })).data
          if (info?.images.length) {
            photos = info.images.slice(0, 6).map((i) => i.thumb)
            photo = photos[0]
          }
        } catch {
          /* 사진 없이 저장 */
        }
      }
      await save.mutateAsync({
        id: wish?.id,
        title: t,
        url: u.url,
        tag,
        memo: memo.trim() || null,
        place_id: place?.id ?? null,
        place_name: place?.name ?? null,
        place_address: place?.address ?? null,
        place_x: place?.x ?? null,
        place_y: place?.y ?? null,
        photo_url: place ? photo : null,
        photos: place ? photos : [],
      })
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  async function remove() {
    if (!wish) return
    setError('')
    try {
      await del.mutateAsync(wish.id)
      onDone()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  const busy = save.isPending || del.isPending

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
      <Field
        label="하고 싶은 것"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예) 성수동 빵집 투어"
        maxLength={100}
        autoFocus={!wish}
        enterKeyHint="next"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">태그</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="태그">
          {WISH_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tag === t}
              onClick={() => setTag(t)}
              className={`h-9 rounded-full border px-3 text-sm font-semibold transition ${
                tag === t ? 'border-transparent bg-partner/50 text-ink' : 'border-line bg-surface text-ink-soft'
              }`}
            >
              {TAG_EMOJI[t]} {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">장소 · 링크 (선택)</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPlaceOpen(true)}
            className="font-display press-3d flex h-12 items-center justify-center gap-1.5 rounded-full border-2 border-accent-deep bg-accent text-[15px] text-white [--shade:var(--color-accent-deep)]"
          >
            <MapIcon className="h-4 w-4" aria-hidden /> 장소 찾기
          </button>
          <button
            type="button"
            onClick={pasteLink}
            className="font-display press-3d flex h-12 items-center justify-center gap-1.5 rounded-full border-2 border-line bg-surface text-[15px]"
          >
            <ClipboardPaste className="h-4 w-4" aria-hidden /> 링크 붙여넣기
          </button>
        </div>
        {place && (
          <div className="animate-pop flex items-center gap-2 rounded-[20px] border-2 border-partner/60 bg-partner/15 px-3 py-2">
            <MapPin className="h-5 w-5 shrink-0 text-accent-deep" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-display block truncate">{place.name}</span>
              <span className="block truncate text-xs text-ink-soft">{place.address}</span>
            </span>
            <button type="button" onClick={() => setPlace(null)} className="shrink-0 px-1 text-xs text-ink-soft">
              빼기
            </button>
          </div>
        )}
        {place && <PlacePhotoStrip place={place} />}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="또는 주소 직접 입력 (인스타·예매 페이지 등)"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none transition placeholder:text-ink-soft/60 focus:border-accent"
        />
        {pasteNote && <p className="px-1 text-xs text-ink-soft">{pasteNote}</p>}
        <p className="px-1 text-[11px] text-ink-soft">
          갤럭시는 카카오맵에서 <b>공유 → 러브로그</b>을 누르면 바로 담겨요
        </p>
      </div>

      <PlaceSearchSheet
        open={placeOpen}
        onOpenChange={setPlaceOpen}
        initialQuery={title}
        onPick={(p) => {
          setPlace({ id: p.id, name: p.name, address: p.address, url: p.url, x: p.x, y: p.y })
          setUrl(p.url)
          if (!title.trim()) setTitle(p.name)
          setTag(tagFromPlace(p) as WishTag)
          if (!memo.trim()) setMemo(p.address)
        }}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">메모 (선택)</span>
        <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="웨이팅 길대요, 평일 낮 추천!" rows={3} />
      </label>

      <ErrorText>{error}</ErrorText>

      <Button type="submit" disabled={busy}>
        {save.isPending ? '저장하는 중…' : wish ? '저장' : '담기'}
      </Button>

      {wish &&
        (confirmDelete ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-holiday/10 p-3">
            <p className="text-center text-sm">이 위시를 지울까요? 되돌릴 수 없어요.</p>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => setConfirmDelete(false)} disabled={busy}>
                취소
              </Button>
              <Button variant="danger" onClick={remove} disabled={busy} className="bg-surface">
                {del.isPending ? '지우는 중…' : '지우기'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
            위시 삭제
          </Button>
        ))}
    </form>
  )
}
