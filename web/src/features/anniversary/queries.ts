import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCoupleCtx } from '../../app/couple'
import type { AnnivInput } from '../../lib/anniversary'
import { supabase } from '../../lib/supabase'
import type { Anniversary } from '../../types/database'

export const annivKeys = { all: ['anniversaries'] as const }

export function useCustomAnniversaries() {
  return useQuery({
    queryKey: annivKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('anniversaries').select('*').order('base_date')
      if (error) throw error
      return data
    },
  })
}

// lib/anniversary.ts 계산에 넣을 입력값
export function useAnnivInput(): AnnivInput {
  const { couple } = useCoupleCtx()
  const customs = useCustomAnniversaries()
  return useMemo(
    () => ({
      startedOn: couple.started_on,
      coupleDays: { every: couple.day_every, marks: couple.day_marks },
      members: couple.members,
      customs: customs.data ?? [],
    }),
    [couple, customs.data],
  )
}

export type AnnivDraft = Pick<
  Anniversary,
  'title' | 'base_date' | 'is_lunar' | 'kind' | 'emoji' | 'count_days' | 'day_every' | 'day_marks'
>

export function useSaveAnniversary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...draft }: AnnivDraft & { id?: string }) => {
      const { error } = id
        ? await supabase.from('anniversaries').update(draft).eq('id', id)
        : await supabase.from('anniversaries').insert(draft)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: annivKeys.all }),
  })
}

export function useDeleteAnniversary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('anniversaries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: annivKeys.all }),
  })
}
