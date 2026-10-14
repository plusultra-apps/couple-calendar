import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Wish, WishTag } from '../../types/database'

export const wishKeys = { all: ['wishes'] as const }

// 태그별 이모지
export const TAG_EMOJI: Record<WishTag, string> = {
  맛집: '🍽️',
  카페: '☕',
  여행: '✈️',
  데이트: '💑',
  영화: '🎬',
  전시: '🖼️',
  쇼핑: '🛍️',
  기타: '✨',
}

export const tagEmoji = (tag: string) => TAG_EMOJI[tag as WishTag] ?? '✨'

// 안 한 것 먼저, 그 안에서는 최근에 넣은 것 먼저
export function sortWishes(list: Wish[]): Wish[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return b.created_at.localeCompare(a.created_at)
  })
}

export function useWishes() {
  return useQuery({
    queryKey: wishKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('wishes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return sortWishes(data)
    },
  })
}

export type WishDraft = { title: string; url: string | null; tag: WishTag; memo: string | null } & Partial<
  Pick<Wish, 'place_id' | 'place_name' | 'place_address' | 'place_x' | 'place_y' | 'photo_url' | 'photos'>
>

export function useSaveWish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...draft }: WishDraft & { id?: string }) => {
      const { error } = id
        ? await supabase.from('wishes').update(draft).eq('id', id)
        : await supabase.from('wishes').insert(draft)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wishKeys.all }),
  })
}

export function useDeleteWish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wishes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wishKeys.all }),
  })
}

// 완료 체크는 바로 화면에 반영(낙관적 업데이트)하고 실패하면 되돌린다
export function useToggleDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from('wishes').update({ done }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: wishKeys.all })
      const prev = qc.getQueryData<Wish[]>(wishKeys.all)
      if (prev) qc.setQueryData<Wish[]>(wishKeys.all, sortWishes(prev.map((w) => (w.id === id ? { ...w, done } : w))))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(wishKeys.all, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: wishKeys.all }),
  })
}

// URL 정리: 앞뒤 공백 제거, 스킴이 없으면 https:// 를 붙인다. 형식이 이상하면 null 이 아닌 오류.
export function normalizeUrl(raw: string): { url: string | null; error?: string } {
  const s = raw.trim()
  if (!s) return { url: null }
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[a-z][a-z0-9+.-]*:/i.test(s) ? null : `https://${s}`
  if (!withScheme) return { url: null, error: 'http 또는 https 로 시작하는 링크만 넣을 수 있어요' }
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new Error('host')
    return { url: withScheme }
  } catch {
    return { url: null, error: '링크 주소를 다시 확인해 주세요' }
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
