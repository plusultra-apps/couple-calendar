import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { useMemo } from 'react'
import { toTimeInput } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { parseRRule } from '../../lib/recurrence'
import type { QuickTemplate } from '../../types/database'
import { fromTemplate, guessEmoji, type QuickItem } from './model'

export const quickKeys = { templates: ['quick-templates'] as const, history: ['events', 'quick-history'] as const }

export function useQuickTemplates() {
  return useQuery({
    queryKey: quickKeys.templates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_templates')
        .select('*')
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export type TemplateDraft = Pick<
  QuickTemplate,
  'emoji' | 'title' | 'owner_id' | 'all_day' | 'start_time' | 'end_time' | 'repeat' | 'location'
>

export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...draft }: TemplateDraft & { id?: string; sort_order?: number }) => {
      const { error } = id
        ? await supabase.from('quick_templates').update(draft).eq('id', id)
        : await supabase.from('quick_templates').insert(draft)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: quickKeys.templates }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quick_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: quickKeys.templates }),
  })
}

// 최근 120일 일정에서 2번 이상 한 것을 추천으로 뽑는다 (가장 흔한 시간대와 함께)
function useHistory() {
  return useQuery({
    queryKey: quickKeys.history,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('title, owner_id, all_day, starts_at, ends_at, rrule, location')
        .eq('is_private', false)
        .gte('created_at', subDays(new Date(), 120).toISOString())
        .order('created_at', { ascending: false })
        .limit(400)
      if (error) throw error
      return data
    },
  })
}

const mode = <T,>(list: T[]): T | undefined => {
  const counts = new Map<T, number>()
  for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

// 빠른 선택 칩 목록: 내가 만든 것 먼저, 그다음 추천(중복 제목 제외)
export function useQuickItems(limitSuggest = 6) {
  const templates = useQuickTemplates()
  const history = useHistory()

  const items = useMemo(() => {
    const own = (templates.data ?? []).map(fromTemplate)
    const taken = new Set(own.map((t) => t.title.trim()))

    const groups = new Map<string, NonNullable<typeof history.data>>()
    for (const e of history.data ?? []) {
      const title = e.title.trim()
      if (!title || taken.has(title)) continue
      const key = `${title}\u0000${e.owner_id ?? ''}`
      groups.set(key, [...(groups.get(key) ?? []), e])
    }

    const suggestions: QuickItem[] = [...groups.entries()]
      .map(([key, list]) => {
        // 반복 일정 하나는 여러 번 한 것으로 친다
        const weight = list.reduce((n, e) => n + (e.rrule ? 3 : 1), 0)
        const allDay = list.filter((e) => e.all_day).length > list.length / 2
        const times = list.filter((e) => !e.all_day && e.starts_at && e.ends_at)
        const startTime = allDay ? null : (mode(times.map((e) => toTimeInput(new Date(e.starts_at!)))) ?? null)
        const endTime = allDay ? null : (mode(times.map((e) => toTimeInput(new Date(e.ends_at!)))) ?? null)
        const repeat = mode(list.map((e) => parseRRule(e.rrule).preset).filter((p) => p !== 'none'))
        return {
          key: `s:${key}`,
          source: 'suggest' as const,
          emoji: guessEmoji(list[0].title),
          title: list[0].title.trim(),
          ownerId: list[0].owner_id,
          allDay: allDay || !startTime || !endTime,
          startTime,
          endTime,
          repeat: (repeat as QuickItem['repeat']) ?? null,
          location: mode(list.map((e) => e.location).filter(Boolean)) ?? null,
          count: weight,
        }
      })
      .filter((s) => s.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, limitSuggest)

    return [...own, ...suggestions]
  }, [templates.data, history.data, limitSuggest])

  return { items, templates: templates.data ?? [], isLoading: templates.isPending }
}
