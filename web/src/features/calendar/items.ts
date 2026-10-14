import { useMemo, useState } from 'react'
import { useCoupleCtx } from '../../app/couple'
import { anniversariesBetween } from '../../lib/anniversary'
import { fromKey, type DateKey } from '../../lib/dates'
import { expand } from '../../lib/recurrence'
import type { EventWithSecret } from '../../types/database'
import { useAnnivInput } from '../anniversary/queries'
import { displayTitle, isMasked, useBusyRange, useEventsRange } from '../events/queries'

// 달력·일정 목록·비는 날 찾기가 공통으로 쓰는 항목
export type CalItem = {
  key: string
  kind: 'event' | 'anniv' | 'busy'
  title: string
  color: string
  allDay: boolean
  start: Date
  end: Date
  startKey: DateKey
  endKey: DateKey // 포함
  ownerId: string | null // event: NULL = 우리, busy: 해당 사람, anniv: null
  event?: EventWithSecret
  masked?: boolean // 상대의 비공개 일정
  emoji?: string
  avatar?: string // 주인 아바타 (우리 일정·기념일은 없음)
  hidden?: boolean // 나만 보는 일정
}

export type Filters = { me: boolean; partner: boolean; us: boolean; busy: boolean; anniv: boolean }

const FILTER_KEY = 'ourcal.filters'
const DEFAULT_FILTERS: Filters = { me: true, partner: true, us: true, busy: true, anniv: true }

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}') }
    } catch {
      return DEFAULT_FILTERS
    }
  })
  const update = (patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(FILTER_KEY, JSON.stringify(next))
      } catch {
        /* 저장 실패는 무시 */
      }
      return next
    })
  }
  return [filters, update] as const
}

// 시작 순: 종일·여러 날 일정 먼저, 긴 것 먼저, 그다음 시작 시각
export function compareItems(a: CalItem, b: CalItem) {
  if (a.startKey !== b.startKey) return a.startKey.localeCompare(b.startKey)
  const aSpan = a.allDay || a.endKey !== a.startKey
  const bSpan = b.allDay || b.endKey !== b.startKey
  if (aSpan !== bSpan) return aSpan ? -1 : 1
  if (a.endKey !== b.endKey) return b.endKey.localeCompare(a.endKey)
  return a.start.getTime() - b.start.getTime()
}

export function useCalendarItems(from: DateKey, to: DateKey, filters?: Filters) {
  const { couple, userId } = useCoupleCtx()
  const events = useEventsRange(from, to)
  const busy = useBusyRange(from, to)
  const annivInput = useAnnivInput()

  const items = useMemo(() => {
    const avatarOf = (ownerId: string | null) =>
      ownerId ? couple.members.find((m) => m.id === ownerId)?.avatar : undefined
    const colorOf = (ownerId: string | null) =>
      ownerId ? (couple.members.find((m) => m.id === ownerId)?.color ?? couple.us_color) : couple.us_color
    const ownerVisible = (ownerId: string | null) => {
      if (!filters) return true
      if (!ownerId) return filters.us
      return ownerId === userId ? filters.me : filters.partner
    }

    const out: CalItem[] = []

    for (const e of events.data ?? []) {
      if (!ownerVisible(e.owner_id)) continue
      for (const s of expand(e, from, to)) {
        out.push({
          key: `e:${e.id}:${s.startKey}`,
          kind: 'event',
          title: displayTitle(e),
          color: colorOf(e.owner_id),
          allDay: e.all_day,
          ...s,
          ownerId: e.owner_id,
          event: e,
          masked: isMasked(e),
          hidden: e.hidden,
          avatar: avatarOf(e.owner_id),
        })
      }
    }

    if (!filters || filters.busy) {
      for (const b of busy.data ?? []) {
        if (filters && !(b.user_id === userId ? filters.me : filters.partner)) continue
        for (const s of expand(b, from, to)) {
          out.push({
            key: `b:${b.id}:${s.startKey}`,
            kind: 'busy',
            title: '바쁨',
            color: 'var(--color-busy)',
            allDay: b.all_day,
            ...s,
            ownerId: b.user_id,
            avatar: avatarOf(b.user_id),
          })
        }
      }
    }

    if (!filters || filters.anniv) {
      for (const a of anniversariesBetween(annivInput, from, to)) {
        const d = fromKey(a.date)
        out.push({
          key: `a:${a.key}`,
          kind: 'anniv',
          title: a.title,
          color: 'var(--color-anniv)',
          allDay: true,
          start: d,
          end: d,
          startKey: a.date,
          endKey: a.date,
          ownerId: null,
          emoji: a.emoji,
        })
      }
    }

    return out.sort(compareItems)
  }, [events.data, busy.data, annivInput, couple, userId, filters, from, to])

  return { items, isLoading: events.isPending, error: events.error ?? busy.error }
}
