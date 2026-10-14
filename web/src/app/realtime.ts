import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 테이블 변경 → 무효화할 쿼리 키 (첫 요소 기준)
const TABLE_KEYS: Record<string, string[][]> = {
  events: [['events']],
  event_secrets: [['events']],
  event_comments: [['comments']],
  event_reactions: [['reactions']],
  anniversaries: [['anniversaries']],
  wishes: [['wishes']],
  external_busy: [['busy']],
  profiles: [['couple'], ['profile']],
  couples: [['couple']],
  quick_templates: [['quick-templates']],
  photos: [['photos']],
  photo_likes: [['photo-likes']],
  notifications: [['notifications']],
  poker_games: [['poker']],
  poker_players: [['poker']],
  poker_rounds: [['poker']],
  poker_hands: [['poker']],
}

// 커플 데이터 실시간 구독. 상대가 바꾸면 내 화면이 즉시 갱신된다.
export function useCoupleRealtime(coupleId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    const invalidate = (table: string) => {
      for (const key of TABLE_KEYS[table] ?? []) qc.invalidateQueries({ queryKey: key })
    }

    // 같은 이름의 채널이 아직 정리 중일 때(StrictMode·빠른 재마운트) 재사용되지 않게 실행마다 고유한 이름을 쓴다
    let channel = supabase.channel(`couple:${coupleId}:${crypto.randomUUID()}`)
    for (const table of ['events', 'event_comments', 'event_reactions', 'anniversaries', 'wishes', 'external_busy', 'profiles', 'quick_templates', 'photos', 'photo_likes', 'notifications', 'poker_games', 'poker_players', 'poker_rounds', 'poker_hands']) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
        () => invalidate(table),
      )
    }
    channel = channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_secrets' }, () => invalidate('event_secrets'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` }, () =>
        invalidate('couples'),
      )
      // DELETE 이벤트는 필터가 적용되지 않으므로 삭제는 따로 받는다
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, () => invalidate('events'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_comments' }, () => invalidate('event_comments'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_reactions' }, () => invalidate('event_reactions'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'wishes' }, () => invalidate('wishes'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'anniversaries' }, () => invalidate('anniversaries'))
    channel.subscribe()

    // 앱으로 돌아오면(백그라운드 → 포그라운드) 놓친 변경을 다시 가져온다
    const onVisible = () => {
      if (document.visibilityState === 'visible') qc.invalidateQueries()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [coupleId, qc])
}
