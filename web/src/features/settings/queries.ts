import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Couple, Profile } from '../../types/database'

// 컬럼 권한: profiles 는 nickname·color·avatar·birthday·birthday_is_lunar·notify_off·quiet_hours, couples 는 started_on·us_color·day_every·day_marks 만 수정 가능
export type ProfilePatch = Partial<Pick<Profile, 'nickname' | 'color' | 'birthday' | 'birthday_is_lunar' | 'avatar' | 'notify_off' | 'quiet_hours'>>
export type CouplePatch = Partial<Pick<Couple, 'started_on' | 'us_color' | 'day_every' | 'day_marks'>>

export function useUpdateProfile(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: ['couple'] }), qc.invalidateQueries({ queryKey: ['profile'] })]),
  })
}

export function useUpdateCouple(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: CouplePatch) => {
      const { error } = await supabase.from('couples').update(patch).eq('id', coupleId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['couple'] }),
  })
}
