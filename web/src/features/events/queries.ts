import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDaysKey, fromKey, type DateKey } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { truncateRRule } from '../../lib/recurrence'
import type { EventWithSecret, Json } from '../../types/database'

export const eventKeys = {
  all: ['events'] as const,
  range: (from: DateKey, to: DateKey) => ['events', 'range', from, to] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
}

const SELECT = '*, event_secrets(*)'

// 기간에 걸치는 일정 + 모든 반복 일정 (반복 전개는 화면에서)
export function useEventsRange(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: eventKeys.range(from, to),
    queryFn: async () => {
      const fromIso = fromKey(from).toISOString()
      const toIso = fromKey(addDaysKey(to, 1)).toISOString()
      const { data, error } = await supabase
        .from('events')
        .select(SELECT)
        .or(
          [
            'rrule.not.is.null',
            `and(all_day.eq.true,start_date.lte.${to},end_date.gte.${from})`,
            `and(all_day.eq.false,starts_at.lt.${toIso},ends_at.gte.${fromIso})`,
          ].join(','),
        )
      if (error) throw error
      return data as EventWithSecret[]
    },
    placeholderData: (prev) => prev,
  })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select(SELECT).eq('id', id!).maybeSingle()
      if (error) throw error
      return data as EventWithSecret | null
    },
  })
}

export type EventInput = {
  id?: string
  owner_id: string | null
  title: string
  location: string
  memo: string
  all_day: boolean
  starts_at: string | null
  ends_at: string | null
  start_date: string | null
  end_date: string | null
  rrule: string | null
  is_private: boolean
  hidden: boolean
}

export function useSaveEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EventInput) => {
      const { data, error } = await supabase.rpc('save_event', { p: input as unknown as Json })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

// 반복 일정: 이 날만 빼기 / 이 날부터 끝내기
export function useEditSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      event,
      date,
      mode,
    }: {
      event: EventWithSecret
      date: DateKey
      mode: 'only' | 'following'
    }) => {
      const patch =
        mode === 'only'
          ? { exdates: [...new Set([...(event.exdates ?? []), date])] }
          : { rrule: truncateRRule(event.rrule!, date) }
      const { error } = await supabase.from('events').update(patch).eq('id', event.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

// ── 댓글 ─────────────────────────────────────
export function useComments(eventId: string) {
  return useQuery({
    queryKey: ['comments', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_comments')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAddComment(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('event_comments').insert({ event_id: eventId, body })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', eventId] }),
  })
}

export function useDeleteComment(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', eventId] }),
  })
}

// ── 반응 ─────────────────────────────────────
export function useReactions(eventId: string) {
  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_reactions').select('*').eq('event_id', eventId)
      if (error) throw error
      return data
    },
  })
}

export function useToggleReaction(eventId: string, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ emoji, on }: { emoji: string; on: boolean }) => {
      const { error } = on
        ? // 빠르게 두 번 눌러도 중복 오류가 나지 않게 (ON CONFLICT DO NOTHING)
          await supabase
            .from('event_reactions')
            .upsert({ event_id: eventId, emoji }, { onConflict: 'event_id,user_id,emoji', ignoreDuplicates: true })
        : await supabase.from('event_reactions').delete().match({ event_id: eventId, user_id: userId, emoji })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', eventId] }),
  })
}

// ── 외부 캘린더 바쁨 ─────────────────────────
export function useBusyRange(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: ['busy', from, to],
    queryFn: async () => {
      const fromIso = fromKey(from).toISOString()
      const toIso = fromKey(addDaysKey(to, 1)).toISOString()
      const { data, error } = await supabase
        .from('external_busy')
        .select('*')
        .or(
          [
            `and(all_day.eq.true,start_date.lte.${to},end_date.gte.${from})`,
            `and(all_day.eq.false,starts_at.lt.${toIso},ends_at.gte.${fromIso})`,
          ].join(','),
        )
      if (error) throw error
      return data
    },
    placeholderData: (prev) => prev,
  })
}

// 표시 제목: 비공개 일정은 본인에게만 실제 제목, 상대에게는 '바쁨'
export function displayTitle(e: EventWithSecret): string {
  if (!e.is_private) return e.title
  return e.event_secrets?.title ?? '바쁨'
}

export const isMasked = (e: EventWithSecret) => e.is_private && !e.event_secrets
