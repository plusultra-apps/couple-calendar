import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCoupleCtx } from '../../app/couple'
import { removeFiles, uploadPhoto, type UploadOptions } from '../../lib/photos'
import { supabase } from '../../lib/supabase'
import type { Photo } from '../../types/database'

export const photoKeys = { all: ['photos'] as const }

// 사진 목록. 조건: 일정 / 날짜 / 종류. 없으면 전체(최근 순).
export function usePhotos(filter: { eventId?: string; date?: string; kind?: 'fourcut' } = {}) {
  return useQuery({
    queryKey: ['photos', filter],
    queryFn: async () => {
      let q = supabase.from('photos').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false })
      if (filter.eventId) q = q.eq('event_id', filter.eventId)
      if (filter.date) q = q.eq('taken_on', filter.date)
      if (filter.kind) q = q.eq('kind', filter.kind)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return data
    },
  })
}

// 그날 사진 순서: 날짜 창에서 정한 순서(day_order) → 인생네컷 → 일정에 붙은 사진 → 먼저 올린 사진.
// 맨 앞 사진이 달력 사진 보기의 대표 사진.
const kindRank = (p: Photo) => (p.kind === 'fourcut' ? 0 : p.event_id ? 1 : 2)
export const byDayOrder = (a: Photo, b: Photo) =>
  (a.day_order ?? Infinity) - (b.day_order ?? Infinity) || kindRank(a) - kindRank(b) || a.created_at.localeCompare(b.created_at)

// 달력 사진 보기용: 기간 안의 날짜별 대표 사진 한 장과 그날 사진 수
export function useMonthPhotos(from: string, to: string) {
  return useQuery({
    queryKey: ['photos', 'month', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('photos').select('*').gte('taken_on', from).lte('taken_on', to)
      if (error) throw error
      const byDay: Record<string, { photo: Photo; count: number }> = {}
      for (const p of data) {
        const cur = byDay[p.taken_on]
        if (!cur) byDay[p.taken_on] = { photo: p, count: 1 }
        else byDay[p.taken_on] = { photo: byDayOrder(p, cur.photo) < 0 ? p : cur.photo, count: cur.count + 1 }
      }
      return byDay
    },
  })
}

// 그날 사진 순서 저장. ids = 새 순서 (맨 앞 = 대표). 바뀐 것만 고친다.
export function useReorderPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (photos: Photo[]) => {
      const changed = photos.map((p, i) => ({ p, i })).filter(({ p, i }) => p.day_order !== i)
      const results = await Promise.all(changed.map(({ p, i }) => supabase.from('photos').update({ day_order: i }).eq('id', p.id)))
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: photoKeys.all }),
  })
}

export function useUploadPhotos() {
  const qc = useQueryClient()
  const { couple } = useCoupleCtx()
  return useMutation({
    // 한 장씩 올리고 진행 상황을 알려 준다
    mutationFn: async ({
      files,
      onProgress,
      ...opt
    }: Omit<UploadOptions, 'coupleId'> & { files: File[]; onProgress?: (done: number) => void }) => {
      let done = 0
      for (const file of files) {
        await uploadPhoto(file, { ...opt, coupleId: couple.id })
        onProgress?.(++done)
      }
      return done
    },
    onSettled: () => qc.invalidateQueries({ queryKey: photoKeys.all }),
  })
}

export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Photo) => {
      const { error } = await supabase.from('photos').delete().eq('id', p.id)
      if (error) throw error
      await removeFiles([p.path, p.thumb_path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: photoKeys.all }),
  })
}

export function useUpdatePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; caption?: string | null; kind?: string; taken_on?: string }) => {
      const { error } = await supabase.from('photos').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: photoKeys.all }),
  })
}
