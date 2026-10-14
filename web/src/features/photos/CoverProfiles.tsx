import { useQueryClient } from '@tanstack/react-query'
import { Camera, Heart } from 'lucide-react'
import { useRef, useState } from 'react'
import { useCoupleCtx } from '../../app/couple'
import { Mascot } from '../../components/Mascot'
import { removeFiles, uploadSingle, useSignedUrls } from '../../lib/photos'
import { supabase, toMessage } from '../../lib/supabase'
import type { Profile } from '../../types/database'

// 카카오톡 프로필처럼: 위에는 둘의 배경 사진, 아래에 두 사람 프로필 사진
export function CoverProfiles() {
  const { couple, me, partner } = useCoupleCtx()
  const qc = useQueryClient()
  const urls = useSignedUrls([couple.cover_path, me.photo_path, partner?.photo_path])
  const coverInput = useRef<HTMLInputElement>(null)
  const meInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'cover' | 'me' | null>(null)
  const [error, setError] = useState('')
  const cover = couple.cover_path ? urls.data?.[couple.cover_path] : undefined

  async function change(kind: 'cover' | 'me', file: File | undefined) {
    if (!file) return
    setError('')
    setBusy(kind)
    try {
      const old = kind === 'cover' ? couple.cover_path : me.photo_path
      const path = await uploadSingle(file, couple.id, kind === 'cover' ? 'cover' : 'profile')
      const { error } =
        kind === 'cover'
          ? await supabase.from('couples').update({ cover_path: path }).eq('id', couple.id)
          : await supabase.from('profiles').update({ photo_path: path }).eq('id', me.id)
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

  return (
    <div className="-mx-6 -mt-4 mb-2">
      {/* 배경 */}
      <div className="relative h-44 overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-end justify-center bg-linear-to-br from-partner/50 via-surface to-us/55 pb-6">
            <Mascot size={130} left={me.color} right={partner?.color ?? '#F8B4C4'} />
          </div>
        )}
        {cover && <div className="absolute inset-0 bg-linear-to-t from-black/25 to-transparent" />}
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => change('cover', e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => coverInput.current?.click()}
          disabled={!!busy}
          className="font-display absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 text-xs shadow active:scale-95"
        >
          <Camera className="h-4 w-4" />
          {busy === 'cover' ? '바꾸는 중…' : '배경'}
        </button>
      </div>

      {/* 프로필 사진 두 개 (배경에 걸치게) */}
      <div className="-mt-11 flex items-end justify-center gap-3">
        <ProfileCircle
          profile={me}
          url={me.photo_path ? urls.data?.[me.photo_path] : undefined}
          editable
          busy={busy === 'me'}
          onEdit={() => meInput.current?.click()}
        />
        <Heart className="animate-heartbeat mb-9 h-6 w-6 fill-accent text-accent" aria-label="그리고" />
        {partner ? (
          <ProfileCircle profile={partner} url={partner.photo_path ? urls.data?.[partner.photo_path] : undefined} />
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
  editable,
  busy,
  onEdit,
}: {
  profile: Profile
  url?: string
  editable?: boolean
  busy?: boolean
  onEdit?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        disabled={!editable || busy}
        aria-label={editable ? '내 프로필 사진 바꾸기' : `${profile.nickname} 프로필`}
        className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white text-4xl shadow-md disabled:cursor-default"
        style={{ backgroundColor: profile.color }}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span>{profile.avatar}</span>}
        {editable && (
          <span className="absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow">
            <Camera className="h-3.5 w-3.5 text-ink-soft" />
          </span>
        )}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs">…</span>}
      </button>
      <span className="font-display max-w-28 truncate text-[15px]">{profile.nickname}</span>
    </div>
  )
}
