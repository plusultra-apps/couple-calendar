import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function usePhotoLikes() {
  return useQuery({
    queryKey: ['photo-likes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('photo_likes').select('photo_id, user_id')
      if (error) throw error
      return data
    },
  })
}

export function useToggleLike(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ photoId, on }: { photoId: string; on: boolean }) => {
      const { error } = on
        ? await supabase
            .from('photo_likes')
            .upsert({ photo_id: photoId }, { onConflict: 'photo_id,user_id', ignoreDuplicates: true })
        : await supabase.from('photo_likes').delete().match({ photo_id: photoId, user_id: userId })
      if (error) throw error
    },
    // 하트는 바로 바뀌게
    onMutate: async ({ photoId, on }) => {
      await qc.cancelQueries({ queryKey: ['photo-likes'] })
      const prev = qc.getQueryData<{ photo_id: string; user_id: string }[]>(['photo-likes'])
      if (prev) {
        qc.setQueryData(
          ['photo-likes'],
          on
            ? [...prev.filter((l) => !(l.photo_id === photoId && l.user_id === userId)), { photo_id: photoId, user_id: userId }]
            : prev.filter((l) => !(l.photo_id === photoId && l.user_id === userId)),
        )
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['photo-likes'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['photo-likes'] }),
  })
}
