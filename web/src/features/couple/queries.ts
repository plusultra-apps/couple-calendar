import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useMyProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data
    },
  })
}

// 커플 정보 + 구성원(나, 상대) 프로필
export function useCouple(coupleId: string | null | undefined) {
  return useQuery({
    queryKey: ['couple', coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const [couple, members] = await Promise.all([
        supabase.from('couples').select('*').eq('id', coupleId!).single(),
        supabase.from('profiles').select('*').eq('couple_id', coupleId!).order('created_at'),
      ])
      if (couple.error) throw couple.error
      if (members.error) throw members.error
      return { ...couple.data, members: members.data }
    },
  })
}

export function useCreateCouple() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (startedOn: string) => {
      const { data, error } = await supabase.rpc('create_couple', { p_started_on: startedOn })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useJoinCouple() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_couple', { p_code: code })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
