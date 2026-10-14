import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PokerGameWithPlayers, PokerHand, PokerRound } from '../../types/database'
import type { Rules } from './model'

// 인디언 포커 쿼리 키. 실시간(app/realtime.ts)은 poker_* 표가 바뀌면 ['poker'] 전체를 무효화한다.
export const pokerKeys = {
  all: ['poker'] as const,
  game: ['poker', 'game'] as const,
  today: ['poker', 'today'] as const,
  round: (gameId: string) => ['poker', 'round', gameId] as const,
  roundById: (roundId: string) => ['poker', 'round-id', roundId] as const,
  hands: (roundId: string) => ['poker', 'hands', roundId] as const,
  peek: (roundId: string) => ['poker', 'peek', roundId] as const,
}

// 커플의 끝나지 않은 게임(최대 1개) + 두 사람 점수판
export async function fetchCurrentGame(): Promise<PokerGameWithPlayers | null> {
  const { data, error } = await supabase
    .from('poker_games')
    .select('*, poker_players(*)')
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// poll: 실시간이 끊겨도 상대 행동을 놓치지 않게 기다리는 동안만 몇 초마다 다시 받는다
export function usePokerGame(pollWhile?: (g: PokerGameWithPlayers | null | undefined) => boolean) {
  return useQuery({
    queryKey: pokerKeys.game,
    queryFn: fetchCurrentGame,
    refetchInterval: (q) => (pollWhile?.(q.state.data) ? 5000 : false),
  })
}

// 오늘(최근 12시간 안에 시작한 게임들) 사람별 마신 양 — 술자리가 자정을 넘겨도 이어지게 12시간으로 본다
export function usePokerToday() {
  return useQuery({
    queryKey: pokerKeys.today,
    queryFn: async () => {
      const since = new Date(Date.now() - 12 * 3600_000).toISOString()
      const { data, error } = await supabase
        .from('poker_players')
        .select('user_id, drunk_q, poker_games!inner(created_at)')
        .gte('poker_games.created_at', since)
      if (error) throw error
      const sum: Record<string, number> = {}
      for (const p of data) sum[p.user_id] = (sum[p.user_id] ?? 0) + p.drunk_q
      return sum
    },
  })
}

// 게임의 최신 판
export function usePokerRound(gameId: string | undefined) {
  return useQuery({
    queryKey: pokerKeys.round(gameId ?? ''),
    enabled: !!gameId,
    queryFn: async (): Promise<PokerRound | null> => {
      const { data, error } = await supabase
        .from('poker_rounds')
        .select('*')
        .eq('game_id', gameId!)
        .order('round_no', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// 특정 판 (결과를 보는 사이 상대가 다음 판을 시작했을 때 지난 결과를 계속 보여 주려고)
export function usePokerRoundById(roundId: string | null) {
  return useQuery({
    queryKey: pokerKeys.roundById(roundId ?? ''),
    enabled: !!roundId,
    queryFn: async (): Promise<PokerRound | null> => {
      const { data, error } = await supabase.from('poker_rounds').select('*').eq('id', roundId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// 판의 카드. RLS 때문에 진행 중인 판에서는 상대 카드만, 끝난 판은 둘 다 온다.
export function usePokerHands(roundId: string | undefined) {
  return useQuery({
    queryKey: pokerKeys.hands(roundId ?? ''),
    enabled: !!roundId,
    queryFn: async (): Promise<PokerHand[]> => {
      const { data, error } = await supabase.from('poker_hands').select('*').eq('round_id', roundId!)
      if (error) throw error
      return data
    },
  })
}

// 내 엿보기 힌트 (본인 것만 읽힌다)
export function usePokerPeekHint(roundId: string | undefined) {
  return useQuery({
    queryKey: pokerKeys.peek(roundId ?? ''),
    enabled: !!roundId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('poker_peeks').select('hint').eq('round_id', roundId!).maybeSingle()
      if (error) throw error
      return data?.hint ?? null
    },
  })
}

// ── 쓰기: 전부 RPC. 끝나면 ['poker'] 를 다시 받아 온 뒤에 resolve ──

function usePokerMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: pokerKeys.all }),
  })
}

export function usePokerOpen() {
  return usePokerMutation(async (r: Rules) => {
    const { data, error } = await supabase.rpc('poker_open', { p_base: r.base, p_max: r.max, p_water: r.water })
    if (error) throw error
    return data
  })
}

export function usePokerJoin() {
  return usePokerMutation(async (gameId: string) => {
    const { error } = await supabase.rpc('poker_join', { p_game: gameId })
    if (error) throw error
  })
}

export function usePokerNextRound() {
  return usePokerMutation(async (gameId: string) => {
    const { data, error } = await supabase.rpc('poker_next_round', { p_game: gameId })
    if (error) throw error
    return data
  })
}

export type PokerAction = 'raise' | 'call' | 'fold'

export function usePokerAct() {
  return usePokerMutation(async ({ roundId, action }: { roundId: string; action: PokerAction }) => {
    const { error } = await supabase.rpc('poker_act', { p_round: roundId, p_action: action })
    if (error) throw error
  })
}

export function usePokerPeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (roundId: string) => {
      const { data, error } = await supabase.rpc('poker_peek', { p_round: roundId })
      if (error) throw error
      return data
    },
    onSuccess: (hint, roundId) => {
      qc.setQueryData(pokerKeys.peek(roundId), hint)
      return qc.invalidateQueries({ queryKey: pokerKeys.all })
    },
  })
}

export function usePokerUseHalf() {
  return usePokerMutation(async (roundId: string) => {
    const { data, error } = await supabase.rpc('poker_use_half', { p_round: roundId })
    if (error) throw error
    return data
  })
}

export function usePokerEnd() {
  return usePokerMutation(async (gameId: string) => {
    const { error } = await supabase.rpc('poker_end', { p_game: gameId })
    if (error) throw error
  })
}
