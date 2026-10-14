import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCoupleCtx } from '../../app/couple'
import { fmt, fromKey } from '../../lib/dates'
import { useSignedUrl, useSignedUrls } from '../../lib/photos'
import { toMessage } from '../../lib/supabase'
import type { Photo } from '../../types/database'
import { useDeletePhoto, useUploadPhotos } from './queries'

// 사진 격자. 누르면 크게 보기(좌우로 넘기기).
// onReorder 를 주면 꾹 눌러 끌어서 순서를 바꿀 수 있고, 맨 앞 사진에 '대표' 표시가 붙는다.
export function PhotoGrid({
  photos,
  cols = 3,
  square = false,
  gap = 'gap-1.5',
  rounded = 'rounded-2xl',
  onReorder,
}: {
  photos: Photo[]
  cols?: 3 | 4
  /** 인생네컷도 정사각형 칸으로 (인스타 그리드처럼) */
  square?: boolean
  gap?: string
  rounded?: string
  onReorder?: (photos: Photo[]) => Promise<unknown>
}) {
  const urls = useSignedUrls(photos.map((p) => p.thumb_path))
  const [open, setOpen] = useState<number | null>(null)
  const { list, dragId, gridRef, ghost, handlers, consumeClick } = useLongPressSort(photos, onReorder)
  if (photos.length === 0) return null
  return (
    <>
      <div
        ref={gridRef}
        data-vaul-no-drag={onReorder ? '' : undefined}
        className={`grid ${gap} ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        {list.map((p, i) => (
          <button
            key={p.id}
            type="button"
            data-photo-id={p.id}
            onClick={() => !consumeClick() && setOpen(i)}
            onContextMenu={onReorder ? (e) => e.preventDefault() : undefined}
            {...(onReorder ? handlers(p.id, urls.data?.[p.thumb_path]) : {})}
            className={`relative overflow-hidden ${rounded} bg-line/50 transition-opacity active:scale-95 ${
              p.kind === 'fourcut' && !square ? 'aspect-[3/4]' : 'aspect-square'
            } ${onReorder ? 'select-none [-webkit-touch-callout:none]' : ''} ${dragId === p.id ? 'opacity-30' : ''}`}
          >
            {urls.data?.[p.thumb_path] && (
              <img
                src={urls.data[p.thumb_path]}
                alt=""
                loading="lazy"
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
            )}
            {p.kind === 'fourcut' && (
              <span className="font-display absolute top-1 left-1 rounded-full bg-white/85 px-1.5 text-[10px]">네컷</span>
            )}
            {onReorder && i === 0 && list.length > 1 && (
              <span className="font-display absolute right-1 bottom-1 rounded-full bg-accent px-1.5 text-[10px] text-white">대표</span>
            )}
          </button>
        ))}
      </div>
      {ghost}
      {open !== null && <PhotoViewer photos={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}

// 꾹 눌러(0.3초) 끌어서 순서 바꾸기. 그 전에 손가락이 움직이면 그냥 스크롤로 본다.
function useLongPressSort(photos: Photo[], onReorder?: (photos: Photo[]) => Promise<unknown>) {
  // 끄는 중이거나 저장을 기다리는 동안의 순서. 서버 목록이 바뀌면 버린다.
  const [local, setLocal] = useState<Photo[] | null>(null)
  const [base, setBase] = useState(photos)
  if (base !== photos) {
    setBase(photos)
    setLocal(null)
  }
  const list = local ?? photos
  const listRef = useRef(list)
  useLayoutEffect(() => {
    listRef.current = list
  })

  const [dragId, setDragId] = useState<string | null>(null)
  // 손가락을 따라다니는 사진 (x,y = 손가락 위치, off = 사진 안에서 잡은 위치)
  const [lifted, setLifted] = useState<{ x: number; y: number; offX: number; offY: number; w: number; h: number; url?: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const clickBlocked = useRef(false)
  const st = useRef<{
    id: string
    pointerId: number
    timer: number
    x0: number
    y0: number
    offX: number
    offY: number
    w: number
    h: number
    url?: string
    active: boolean
  } | null>(null)

  // 끄는 동안 화면이 스크롤되지 않게 (passive 가 아니어야 막힌다)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const block = (e: TouchEvent) => {
      if (st.current?.active) e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  })

  const finish = () => {
    const s = st.current
    if (!s) return
    clearTimeout(s.timer)
    st.current = null
    if (!s.active) return
    setDragId(null)
    setLifted(null)
    const next = listRef.current
    if (onReorder && next.some((p, i) => p.id !== photos[i]?.id)) onReorder(next).catch(() => setLocal(null))
    else setLocal(null)
  }

  const handlers = (id: string, url?: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button > 0 || st.current) return
      clickBlocked.current = false
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      const pointerId = e.pointerId
      const timer = window.setTimeout(() => {
        const s = st.current
        if (!s) return
        s.active = true
        clickBlocked.current = true
        setLocal(listRef.current)
        setDragId(id)
        setLifted({ x: s.x0, y: s.y0, offX: s.offX, offY: s.offY, w: s.w, h: s.h, url: s.url })
        navigator.vibrate?.(15)
        try {
          el.setPointerCapture(pointerId)
        } catch {
          /* 이미 손을 뗀 경우 */
        }
      }, 300)
      st.current = { id, pointerId, timer, x0: e.clientX, y0: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height, url, active: false }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = st.current
      if (!s || e.pointerId !== s.pointerId) return
      if (!s.active) {
        if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > 8) finish()
        return
      }
      setLifted((g) => g && { ...g, x: e.clientX, y: e.clientY })
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-photo-id]')
      const overId = over?.dataset.photoId
      if (!overId || overId === s.id || !gridRef.current?.contains(over)) return
      setLocal((cur) => {
        const arr = [...(cur ?? listRef.current)]
        const from = arr.findIndex((p) => p.id === s.id)
        const to = arr.findIndex((p) => p.id === overId)
        if (from < 0 || to < 0) return cur
        arr.splice(to, 0, arr.splice(from, 1)[0])
        return arr
      })
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  })

  const ghost = lifted
    ? createPortal(
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] scale-110 overflow-hidden rounded-2xl border-2 border-white bg-line shadow-xl"
          style={{ left: lifted.x - lifted.offX, top: lifted.y - lifted.offY, width: lifted.w, height: lifted.h }}
        >
          {lifted.url && <img src={lifted.url} alt="" className="h-full w-full object-cover" />}
        </div>,
        document.body,
      )
    : null

  return {
    list,
    dragId,
    gridRef,
    ghost,
    handlers,
    // 끌기를 막 끝낸 직후의 클릭은 사진 크게 보기를 열지 않는다
    consumeClick: () => {
      const b = clickBlocked.current
      clickBlocked.current = false
      return b
    },
  }
}

function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: Photo[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const p = photos[index]
  const url = useSignedUrl(p?.path)
  const thumb = useSignedUrl(p?.thumb_path)
  const { couple } = useCoupleCtx()
  const del = useDeletePhoto()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const touch = useRef<number | null>(null)

  useEffect(() => {
    if (!p) onClose()
  }, [p, onClose])
  useEffect(() => setConfirm(false), [index])
  if (!p) return null

  const go = (d: number) => onIndex(Math.min(photos.length - 1, Math.max(0, index + d)))
  const author = couple.members.find((m) => m.id === p.created_by)

  async function remove() {
    setError('')
    try {
      await del.mutateAsync(p)
      if (photos.length <= 1) onClose()
      else if (index >= photos.length - 1) onIndex(index - 1)
    } catch (e) {
      setError(toMessage(e))
    }
  }

  // 시트(변형된 컨테이너) 안에서도 화면 전체를 덮도록 body 에 띄운다.
  // 시트가 열려 있으면 body 가 pointer-events: none 이라 그대로면 버튼이 안 눌린다 → pointer-events-auto
  return createPortal(
    <div
      role="dialog"
      aria-label="사진 크게 보기"
      className="pointer-events-auto fixed inset-0 z-[80] flex flex-col bg-ink/95 text-white"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return
        const dx = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
        <button type="button" aria-label="닫기" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
          <X className="h-6 w-6" />
        </button>
        <span className="font-display flex-1 text-center">
          {fmt(fromKey(p.taken_on), 'yyyy년 M월 d일 (EEE)')}
          {p.kind === 'fourcut' && <span className="ml-1.5 rounded-full bg-white/20 px-2 text-xs">인생네컷</span>}
        </span>
        <button
          type="button"
          aria-label="사진 지우기"
          onClick={() => (confirm ? remove() : setConfirm(true))}
          disabled={del.isPending}
          className={`flex h-10 items-center gap-1 rounded-full px-3 text-sm ${confirm ? 'bg-holiday' : 'active:bg-white/10'}`}
        >
          <Trash2 className="h-5 w-5" />
          {confirm && '정말 지울까요?'}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {(url || thumb) && <img src={url ?? thumb} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />}
        {index > 0 && (
          <button type="button" aria-label="이전 사진" onClick={() => go(-1)} className="absolute left-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" aria-label="다음 사진" onClick={() => go(1)} className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-center text-sm text-white/80">
        {p.caption && <p className="mb-1 text-base text-white">{p.caption}</p>}
        {author && <p>{author.avatar} {author.nickname}님이 올렸어요 · {index + 1}/{photos.length}</p>}
        {error && <p className="mt-1 text-holiday">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}

// 사진 올리기 버튼 (여러 장 선택 가능). 진행 상황을 보여 준다.
export function PhotoUploadButton({
  takenOn,
  eventId,
  kind = 'photo',
  label = '사진 올리기',
  className = '',
}: {
  takenOn: string
  eventId?: string | null
  kind?: 'photo' | 'fourcut'
  label?: string
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadPhotos()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, 20)
    if (input.current) input.current.value = ''
    if (!files.length) return
    setError('')
    setProgress({ done: 0, total: files.length })
    try {
      await upload.mutateAsync({
        files,
        takenOn,
        eventId,
        kind,
        onProgress: (done) => setProgress({ done, total: files.length }),
      })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className={className}>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={!!progress}
        className="font-display press-3d flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 border-line bg-surface text-[15px] disabled:opacity-60"
      >
        <ImagePlus className="h-5 w-5 text-accent" />
        {progress ? `올리는 중 ${progress.done}/${progress.total}` : label}
      </button>
      {error && <p className="mt-1 px-1 text-xs text-holiday">{error}</p>}
    </div>
  )
}
