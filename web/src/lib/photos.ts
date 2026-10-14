import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// 사진은 비공개 버킷 'photos' 의 '{couple_id}/{파일}' 에 둔다 (Storage RLS: 커플 구성원만).
// 폰 사진(3~10MB)을 그대로 올리지 않고, 올리기 전에 줄인다: 큰 사진 1600px · 작은 사진 480px (JPEG).

export const BUCKET = 'photos'
const FULL_SIDE = 1600
const THUMB_SIDE = 480

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // 사진의 회전 정보(EXIF)를 반영해서 읽는다
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function toJpeg(src: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height
  const scale = Math.min(1, maxSide / Math.max(w0, h0))
  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('사진을 줄이지 못했어요')
  return { blob, width: w, height: h }
}

export async function shrink(file: File) {
  const img = await decode(file)
  const full = await toJpeg(img, FULL_SIDE, 0.82)
  const thumb = await toJpeg(img, THUMB_SIDE, 0.75)
  if ('close' in img) img.close()
  return { full, thumb }
}

const upload = async (path: string, blob: Blob) => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

export const removeFiles = async (paths: (string | null | undefined)[]) => {
  const list = paths.filter(Boolean) as string[]
  if (list.length) await supabase.storage.from(BUCKET).remove(list)
}

export type UploadOptions = { coupleId: string; takenOn: string; eventId?: string | null; kind?: 'photo' | 'fourcut' }

// 사진 한 장 올리고 photos 에 기록. 기록이 실패하면 올린 파일을 지운다.
export async function uploadPhoto(file: File, opt: UploadOptions) {
  const { full, thumb } = await shrink(file)
  const id = crypto.randomUUID()
  const path = `${opt.coupleId}/${id}.jpg`
  const thumbPath = `${opt.coupleId}/${id}_t.jpg`
  await upload(path, full.blob)
  await upload(thumbPath, thumb.blob)
  const { error } = await supabase.from('photos').insert({
    path,
    thumb_path: thumbPath,
    width: full.width,
    height: full.height,
    taken_on: opt.takenOn,
    event_id: opt.eventId ?? null,
    kind: opt.kind ?? 'photo',
  })
  if (error) {
    await removeFiles([path, thumbPath])
    throw error
  }
}

// 배경·프로필처럼 한 장만 두는 사진. 새 경로를 돌려준다.
export async function uploadSingle(file: File, coupleId: string, prefix: 'cover' | 'profile') {
  const { full } = await shrink(file)
  const path = `${coupleId}/${prefix}-${crypto.randomUUID()}.jpg`
  await upload(path, full.blob)
  return path
}

// 비공개 사진은 1시간짜리 서명 링크로 보여 준다. 같은 경로는 캐시.
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter(Boolean) as string[])].sort()
  return useQuery({
    queryKey: ['signed-urls', list],
    enabled: list.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, 60 * 60)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl
      return map
    },
  })
}

export function useSignedUrl(path: string | null | undefined) {
  const q = useSignedUrls([path])
  return path ? q.data?.[path] : undefined
}
