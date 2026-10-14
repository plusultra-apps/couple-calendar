import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// 알림함: 받은 알림(최근 60일, 서버가 매일 정리). 쓰기는 서버(notify·remind 함수)만 한다.
export const notificationKeys = { all: ['notifications'] as const }

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}

// 안 읽은 알림 수 (캘린더 종 배지)
export function useUnreadCount() {
  const { data } = useNotifications()
  return data?.filter((n) => !n.read_at).length ?? 0
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    // ids 가 없으면 안 읽은 것 전부
    mutationFn: async (ids?: string[]) => {
      let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      if (ids) q = q.in('id', ids)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useClearNotifications() {
  const qc = useQueryClient()
  return useMutation({
    // 읽은 알림만 지운다
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').delete().not('read_at', 'is', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
