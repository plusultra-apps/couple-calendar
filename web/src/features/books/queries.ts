import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database.types'
import { beanKeys } from '../beans/queries'

export type Book = Tables<'book_logs'> // 책 자체 (커플이 함께 쓴다)
export type Progress = Tables<'book_progress'> // 사람마다 따로: 읽은 상태·별점·날짜
export type BookNote = Tables<'book_notes'>
export type BookStatus = 'wish' | 'reading' | 'done'
export type BookRow = Book & { progress: Record<string, Progress> } // progress 는 user_id 별

export const bookKeys = { all: ['books'] as const, notes: (bookId: string) => ['book-notes', bookId] as const }

// 우리 서재: 책 목록 + 두 사람의 읽은 상태 (최신에 담은 순)
export function useBooks() {
  return useQuery({
    queryKey: bookKeys.all,
    queryFn: async (): Promise<BookRow[]> => {
      const [b, p] = await Promise.all([
        supabase.from('book_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('book_progress').select('*'),
      ])
      if (b.error) throw b.error
      if (p.error) throw p.error
      const byBook = new Map<string, Record<string, Progress>>()
      for (const r of p.data) byBook.set(r.book_id, { ...(byBook.get(r.book_id) ?? {}), [r.user_id]: r })
      return b.data.map((bk) => ({ ...bk, progress: byBook.get(bk.id) ?? {} }))
    },
  })
}

// 한 권의 한 줄 기록 (오래된 순)
export function useBookNotes(bookId: string) {
  return useQuery({
    queryKey: bookKeys.notes(bookId),
    queryFn: async () => {
      const { data, error } = await supabase.from('book_notes').select('*').eq('book_id', bookId).order('created_at')
      if (error) throw error
      return data
    },
  })
}

export type BookDraft = { isbn: string; title: string; authors: string; publisher: string; thumbnail: string }

// 검색 결과에서 담기: 책을 서재에 넣고, 담은 사람의 상태를 '읽고 싶어요'로 둔다
export function useSaveBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: BookDraft) => {
      const { data, error } = await supabase
        .from('book_logs')
        .insert({
          isbn: draft.isbn,
          title: draft.title,
          authors: draft.authors || null,
          publisher: draft.publisher || null,
          thumbnail: draft.thumbnail || null,
        })
        .select('id')
        .single()
      if (error) {
        if (error.code === '23505') throw new Error('이미 우리 서재에 있는 책이에요')
        throw error
      }
      const { error: e2 } = await supabase.from('book_progress').insert({ book_id: data.id, status: 'wish' })
      if (e2) throw e2
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  })
}

export type ProgressPatch = Partial<Pick<Progress, 'status' | 'rating' | 'started_on' | 'finished_on'>>

// 내 읽은 상태 바꾸기 (없으면 만든다)
export function useSetProgress(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProgressPatch) => {
      const { error } = await supabase
        .from('book_progress')
        .upsert({ book_id: bookId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'book_id,user_id' })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  })
}

export function useDeleteBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('book_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  })
}

export function useAddNote(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('book_notes').insert({ book_id: bookId, body })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bookKeys.notes(bookId) }),
  })
}

export function useDeleteNote(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('book_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bookKeys.notes(bookId) }),
  })
}

// 완독하면 콩 하나: '독서' 항목이 없으면 만들고, 완독한 날짜에 콩을 넣는다
export function useFinishBean() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (date: string) => {
      const { data: found, error: e1 } = await supabase.from('bean_types').select('id, archived').eq('label', '독서').limit(1)
      if (e1) throw e1
      let typeId = found?.[0]?.id
      if (!typeId) {
        const { data, error } = await supabase
          .from('bean_types')
          .insert({ label: '독서', emoji: '📚', color: '#A7C7E7', sort_order: 9 })
          .select('id')
          .single()
        if (error) throw error
        typeId = data.id
      } else if (found?.[0]?.archived) {
        await supabase.from('bean_types').update({ archived: false }).eq('id', typeId)
      }
      const { error } = await supabase.from('bean_logs').insert({ type_id: typeId, taken_on: date })
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['bean-types'] })
      qc.invalidateQueries({ queryKey: beanKeys.all })
    },
  })
}

// 책 검색 (카카오, Edge Function book-search 경유)
export type SearchBook = { isbn: string; title: string; authors: string; publisher: string; thumbnail: string; year: string }

export async function searchBooks(query: string, page: number) {
  const { data, error } = await supabase.functions.invoke<{ books?: SearchBook[]; end?: boolean; error?: string }>('book-search', {
    body: { query, page },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error === 'kakao_key_missing' ? '책 검색 키가 아직 설정되지 않았어요' : '책 검색이 잘 되지 않아요. 잠시 뒤 다시 해 주세요')
  return { books: data?.books ?? [], end: data?.end ?? true }
}
