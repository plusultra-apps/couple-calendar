import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export const externalKeys = { all: ['external-calendars'] as const }

type SyncResult = { id: string; ok: boolean; count?: number; error?: string }

// 내 외부 캘린더 목록 (상대 것은 RLS 로 보이지 않는다)
export function useExternalCalendars() {
  return useQuery({
    queryKey: externalKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_calendars')
        .select('id, name, ics_url, last_synced_at, last_error, created_at')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

// 서버에서 ICS 를 읽어 바쁜 시간을 갈아끼운다. calendar_id 가 없으면 내 캘린더 전부.
async function syncExternal(calendarId?: string): Promise<SyncResult[]> {
  const { data, error } = await supabase.functions.invoke<{ results: SyncResult[] }>('sync-external', {
    body: calendarId ? { calendar_id: calendarId } : {},
  })
  if (error) throw error
  return data?.results ?? []
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: externalKeys.all })
    qc.invalidateQueries({ queryKey: ['busy'] })
  }
}

export function useSyncExternal() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (calendarId?: string) => {
      const results = await syncExternal(calendarId)
      const failed = results.find((r) => !r.ok)
      if (failed) throw new Error(failed.error ?? '동기화하지 못했어요')
      return results
    },
    onSettled: invalidate,
  })
}

// 추가 후 바로 동기화. 동기화 실패는 목록의 오류 문구로 보여 주고 추가 자체는 성공으로 본다.
export function useAddExternalCalendar() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { name: string; ics_url: string }) => {
      const { data, error } = await supabase.from('external_calendars').insert(input).select('id').single()
      if (error) throw error
      await syncExternal(data.id).catch(() => undefined)
      return data.id
    },
    onSettled: invalidate,
  })
}

export function useDeleteExternalCalendar() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('external_calendars').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}
