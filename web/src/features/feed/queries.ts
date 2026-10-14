import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export const feedKeys = { token: ['feed-token'] as const }

// 구독 주소 (https). 캘린더 앱이 주기적으로 가져간다.
export const feedUrl = (token: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feed?token=${token}`

// 아이폰 캘린더 구독 창을 여는 주소
export const webcalUrl = (token: string) => feedUrl(token).replace(/^https?:\/\//, 'webcal://')

const rotate = async () => {
  const { data, error } = await supabase.rpc('rotate_feed_token')
  if (error) throw error
  return data
}

// 내 구독 토큰. 없으면 처음 열 때 발급한다.
export function useFeedToken() {
  return useQuery({
    queryKey: feedKeys.token,
    queryFn: async () => {
      const { data, error } = await supabase.from('feed_tokens').select('token').maybeSingle()
      if (error) throw error
      return data?.token ?? (await rotate())
    },
    staleTime: Infinity,
  })
}

// 재발급: 이전 주소는 바로 막힌다
export function useRotateFeedToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rotate,
    onSuccess: (token) => qc.setQueryData(feedKeys.token, token),
  })
}
