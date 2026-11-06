import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { BeanType } from './model'

export type Bean = { id: string; type_id: string | null; kind: string | null; taken_on: string; created_at: string }

export const beanKeys = { all: ['beans'] as const, types: ['bean-types'] as const }

// 커플의 콩 기록 (최신순). 2000개까지만 가져온다.
export function useBeans() {
  return useQuery({
    queryKey: beanKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bean_logs')
        .select('id, type_id, kind, taken_on, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return data as Bean[]
    },
  })
}

// 콩 항목 전부 (보관된 것도 포함: 옛 기록의 이름·색을 보여 주려고)
export function useBeanTypes() {
  return useQuery({
    queryKey: beanKeys.types,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bean_types')
        .select('id, label, emoji, color, sort_order, archived')
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data as BeanType[]
    },
  })
}

// 항목 만들기·고치기
export function useSaveBeanType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: { id?: string; label: string; emoji: string; color: string; sort_order?: number }) => {
      const { id, ...fields } = draft
      const { error } = id
        ? await supabase.from('bean_types').update(fields).eq('id', id)
        : await supabase.from('bean_types').insert(fields)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: beanKeys.types }),
  })
}

// 항목 지우기 = 보관. 버튼에서만 숨기고, 지금까지의 콩은 그대로 남는다.
export function useArchiveBeanType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bean_types').update({ archived: true }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: beanKeys.types }),
  })
}

// 콩 추가: 누르는 즉시 화면에 먼저 넣고, 실패하면 되돌린다 (빠르게 여러 번 눌러도 끊기지 않게)
export function useAddBean() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ type_id, taken_on }: { type_id: string; taken_on: string }) => {
      const { error } = await supabase.from('bean_logs').insert({ type_id, taken_on })
      if (error) throw error
    },
    onMutate: async ({ type_id, taken_on }) => {
      await qc.cancelQueries({ queryKey: beanKeys.all })
      const prev = qc.getQueryData<Bean[]>(beanKeys.all)
      const temp: Bean = { id: `tmp-${crypto.randomUUID()}`, type_id, kind: null, taken_on, created_at: new Date().toISOString() }
      qc.setQueryData<Bean[]>(beanKeys.all, [temp, ...(prev ?? [])])
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(beanKeys.all, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: beanKeys.all }),
  })
}

// 콩 빼기 (한 개씩)
export function useDeleteBean() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bean_logs').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: beanKeys.all })
      const prev = qc.getQueryData<Bean[]>(beanKeys.all)
      qc.setQueryData<Bean[]>(beanKeys.all, (prev ?? []).filter((b) => b.id !== id))
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(beanKeys.all, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: beanKeys.all }),
  })
}
