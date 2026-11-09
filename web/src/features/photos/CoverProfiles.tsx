import { useQueryClient } from '@tanstack/react-query'
import { Camera, Heart, Move } from 'lucide-react'
import { useRef, useState } from 'react'
import { useCoupleCtx } from '../../app/couple'
import { Mascot } from '../../components/Mascot'
import { removeFiles, uploadSingle, useSignedUrls } from '../../lib/photos'
import { supabase, toMessage } from '../../lib/supabase'
import type { Profile } from '../../types/database'
import { FocusPhoto, type Focus } from './FocusPhoto'

// 카카오톡 프로필처럼: 위에는 둘의 배경 사진, 아래에 두 사람 프로필 사진
// 사진이 잘리면 '위치'로 보이는 부분을 끌어서 맞춘다.
export function CoverProfiles() {
  const { couple, me, partner } = useCoupleCtx()
  const qc = useQueryClient()
  const urls = useSignedUrls([couple.cover_path, me.photo_path, partner?.photo_path])
  const coverInput = useRef<HTMLInputElement>(null)
  const meInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'cover' | 'me' | null>(null)
  const [adjusting, setAdjusting] = useState<'cover' | 'me' | null>(null)
  const [draft, setDraft] = useState<Focus>({ x: 50, y: 50 })
  const [error, setError] = useState('')
  const cover = couple.cover_path ? urls.data?.[couple.cover_path] : undefined
  const coverFocus: Focus = { x: couple.cover_x, y: couple.cover_y }
  const meFocus: Focus = { x: me.photo_x, y: me.photo_y }

  async function change(kind: 'cover' | 'me', file: File | undefined) {
    if (!file) return
    setError('')
    setBusy(kind)
    try {
      const old = kind === 'cover' ? couple.cover_path : me.photo_path
      const path = await uploadSingle(file, couple.id, kind === 'cover' ? 'cover' : 'profile')
      // 새 사진은 가운데부터 보인다
      const { error } =
        kind === 'cover'
          ? await supabase.from('couples').update({ cover_path: path, cover_x: 50, cover_y: 50 }).eq('id', couple.id)
          : await supabase.from('profiles').update({ photo_path: path, photo_x: 50, photo_y: 50 }).eq('id', me.id)
      if (error) {
        await removeFiles([path])
        throw error
      }
      await removeFiles([old])
      await qc.invalidateQueries({ queryKey: ['couple'] })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(null)
      if (coverInput.current) coverInput.current.value = ''
      if (meInput.current) meInput.current.value = ''
    }
  }

  function startAdjust(kind: 'cover' | 'me') {
    setDraft(kind === 'cover' ? coverFocus : meFocus)
    setAdjusting(kind)
  }

  async function saveAdjust() {
    if (!adjusting) return
    setError('')
    setBusy(adjusting)
    try {
      const { error } =
        adjusting === 'cover'
          ? await supabase.from('couples').update({ cover_x: draft.x, cover_y: draft.y }).eq('id', couple.id)
          : await supabase.from('profiles').update({ photo_x: draft.x, photo_y: draft.y }).eq('id', me.id)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['couple'] })
      setAdjusting(null)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const coverEditing = adjusting === 'cover'
  const meEditing = adjusting === 'me'

  return (
    <div className="-mx-6 -mt-4 mb-2">
      {/* 배경 */}
      <div className="relative h-44 overflow-hidden">
        {cover ? (
          <FocusPhoto
            url={cover}
            focus={coverEditing ? draft : coverFocus}
            editing={coverEditing}
            onDrag={setDraft}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-end justify-center bg-linear-to-br from-partner/50 via-surface to-us/55 pb-6">
            <Mascot size={130} left={me.color} right={partner?.color ?? '#F8B4C4'} />
          </div>
        )}
        {cover && !coverEditing && <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/25 to-transparent" />}
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => change('cover', e.target.files?.[0])} />

        {coverEditing ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            <button type="button" onClick={() => setAdjusting(null)} className="font-display rounded-full bg-white/90 px-4 py-1.5 text-sm shadow active:scale-95">
              취소
            </button>
            <button type="button" onClick={saveAdjust} disabled={!!busy} className="font-display rounded-full bg-accent px-4 py-1.5 text-sm text-white shadow active:scale-95">
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        ) : (
          <div className="absolute top-3 right-3 flex gap-1.5">
            {cover && (
              <button
                type="button"
                onClick={() => startAdjust('cover')}
                disabled={!!busy}
                aria-label="배경 위치 맞추기"
                className="font-display flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 text-xs shadow active:scale-95"
              >
                <Move className="h-4 w-4" />
                위치
              </button>
            )}
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={!!busy}
              className="font-display flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 text-xs shadow active:scale-95"
            >
              <Camera className="h-4 w-4" />
              {busy === 'cover' ? '바꾸는 중…' : '배경'}
            </button>
          </div>
        )}
      </div>

      {/* 프로필 사진 두 개 (배경에 걸치게) */}
      <div className="-mt-11 flex items-end justify-center gap-3">
        <ProfileCircle
          profile={me}
          url={me.photo_path ? urls.data?.[me.photo_path] : undefined}
          focus={meEditing ? draft : meFocus}
          editing={meEditing}
          onDrag={setDraft}
          editable
          busy={busy === 'me'}
          onEdit={() => meInput.current?.click()}
          onAdjust={me.photo_path && !adjusting ? () => startAdjust('me') : undefined}
          onSave={meEditing ? saveAdjust : undefined}
          onCancel={meEditing ? () => setAdjusting(null) : undefined}
        />
        <Heart className="animate-heartbeat mb-9 h-6 w-6 fill-accent text-accent" aria-label="그리고" />
        {partner ? (
          <ProfileCircle
            profile={partner}
            url={partner.photo_path ? urls.data?.[partner.photo_path] : undefined}
            focus={{ x: partner.photo_x, y: partner.photo_y }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-bg text-sm text-ink-soft">?</span>
            <span className="text-sm text-ink-soft">기다리는 중</span>
          </div>
        )}
        <input ref={meInput} type="file" accept="image/*" hidden onChange={(e) => change('me', e.target.files?.[0])} />
      </div>
      {error && <p className="mt-1 text-center text-xs text-holiday">{error}</p>}
    </div>
  )
}

function ProfileCircle({
  profile,
  url,
  focus,
  editing = false,
  onDrag,
  editable,
  busy,
  onEdit,
  onAdjust,
  onSave,
  onCancel,
}: {
  profile: Profile
  url?: string
  focus: Focus
  editing?: boolean
  onDrag?: (f: Focus) => void
  editable?: boolean
  busy?: boolean
  onEdit?: () => void
  onAdjust?: () => void
  onSave?: () => void
  onCancel?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {editing && url ? (
        <FocusPhoto
          url={url}
          focus={focus}
          editing
          onDrag={onDrag}
          className="h-20 w-20 rounded-full border-4 border-white shadow-md"
        />
      ) : (
        <button
          type="button"
          onClick={onEdit}
          disabled={!editable || busy}
          aria-label={editable ? '내 프로필 사진 바꾸기' : `${profile.nickname} 프로필`}
          className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white text-4xl shadow-md disabled:cursor-default"
          style={{ backgroundColor: profile.color }}
        >
          {url ? (
            <FocusPhoto url={url} focus={focus} className="pointer-events-none h-full w-full" />
          ) : (
            <span>{profile.avatar}</span>
          )}
          {editable && (
            <span className="absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow">
              <Camera className="h-3.5 w-3.5 text-ink-soft" />
            </span>
          )}
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs">…</span>}
        </button>
      )}
      <span className="font-display max-w-28 truncate text-[15px]">{profile.nickname}</span>
      {editing && (
        <div className="flex gap-1">
          <button type="button" onClick={onCancel} className="font-display rounded-full bg-bg px-2.5 py-0.5 text-xs">
            취소
          </button>
          <button type="button" onClick={onSave} disabled={busy} className="font-display rounded-full bg-accent px-2.5 py-0.5 text-xs text-white">
            {busy ? '…' : '저장'}
          </button>
        </div>
      )}
      {onAdjust && !editing && (
        <button type="button" onClick={onAdjust} className="font-display flex items-center gap-0.5 text-[11px] text-ink-soft">
          <Move className="h-3 w-3" />
          위치
        </button>
      )}
    </div>
  )
}
