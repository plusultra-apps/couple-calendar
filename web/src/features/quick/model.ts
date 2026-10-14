import { addDays } from 'date-fns'
import { combine, type DateKey } from '../../lib/dates'
import { buildRRule, type RepeatPreset } from '../../lib/recurrence'
import type { QuickTemplate } from '../../types/database'
import type { EventInput } from '../events/queries'

// 빠른 선택 칩 하나: 직접 만든 '자주 쓰는 일정' 또는 최근 일정에서 뽑은 추천
export type QuickItem = {
  key: string
  source: 'template' | 'suggest'
  templateId?: string
  emoji: string
  title: string
  ownerId: string | null // NULL = 우리
  allDay: boolean
  startTime: string | null // 'HH:mm'
  endTime: string | null
  repeat: Exclude<RepeatPreset, 'none'> | null
  location: string | null
  count?: number // 추천: 최근에 몇 번 했는지
}

export const fromTemplate = (t: QuickTemplate): QuickItem => ({
  key: `t:${t.id}`,
  source: 'template',
  templateId: t.id,
  emoji: t.emoji,
  title: t.title,
  ownerId: t.owner_id,
  allDay: t.all_day,
  startTime: t.start_time?.slice(0, 5) ?? null,
  endTime: t.end_time?.slice(0, 5) ?? null,
  repeat: (t.repeat as QuickItem['repeat']) ?? null,
  location: t.location,
})

// 제목으로 어울리는 이모지 고르기
const EMOJI_RULES: [RegExp, string][] = [
  [/필라테스|요가|스트레칭/, '🧘'],
  [/운동|헬스|PT|짐|gym|크로스핏/i, '🏋️'],
  [/러닝|달리기|조깅|마라톤/, '🏃'],
  [/수영/, '🏊'],
  [/등산|산책|걷기/, '🥾'],
  [/데이트/, '💕'],
  [/영화|cgv|메가박스|롯데시네마/i, '🎬'],
  [/카페|커피/, '☕'],
  [/저녁|점심|밥|식사|맛집|브런치|오마카세/, '🍽️'],
  [/술|회식|맥주|와인|이자카야/, '🍻'],
  [/여행|제주|부산|강릉|해외|비행/, '✈️'],
  [/병원|치과|진료|검진/, '🏥'],
  [/회의|미팅|출근|업무|야근|출장/, '💼'],
  [/공부|스터디|시험|학원|수업/, '📚'],
  [/생일|생신|파티/, '🎂'],
  [/쇼핑|장보기|마트/, '🛍️'],
  [/전시|공연|콘서트|뮤지컬/, '🎨'],
  [/청소|빨래|집안일/, '🧹'],
  [/게임/, '🎮'],
  [/교회|성당|예배|미사/, '⛪'],
]

export function guessEmoji(title: string): string {
  return EMOJI_RULES.find(([re]) => re.test(title))?.[1] ?? '⭐'
}

// 처음 쓰는 커플에게 보여줄 추천 도장
export const STARTERS: Omit<QuickItem, 'key' | 'source' | 'ownerId'>[] = [
  { emoji: '🏋️', title: '운동', allDay: false, startTime: '19:00', endTime: '20:30', repeat: null, location: null },
  { emoji: '💕', title: '데이트', allDay: false, startTime: '18:00', endTime: '22:00', repeat: null, location: null },
  { emoji: '🍽️', title: '저녁 약속', allDay: false, startTime: '19:00', endTime: '21:00', repeat: null, location: null },
  { emoji: '☕', title: '카페', allDay: false, startTime: '14:00', endTime: '16:00', repeat: null, location: null },
  { emoji: '🎬', title: '영화', allDay: false, startTime: '20:00', endTime: '22:30', repeat: null, location: null },
  { emoji: '🌙', title: '야근', allDay: false, startTime: '19:00', endTime: '22:00', repeat: null, location: null },
  { emoji: '🏠', title: '집콕', allDay: true, startTime: null, endTime: null, repeat: null, location: null },
]

// 빠른 일정 → 그 날짜의 일정 입력값
export function toEventInput(item: QuickItem, date: DateKey, opts: { withRepeat?: boolean } = {}): EventInput {
  const base = {
    owner_id: item.ownerId,
    title: item.title,
    location: item.location ?? '',
    memo: '',
    is_private: false,
    hidden: false,
    rrule: opts.withRepeat && item.repeat ? buildRRule(item.repeat, null, date) : null,
  }
  if (item.allDay || !item.startTime || !item.endTime) {
    return { ...base, all_day: true, start_date: date, end_date: date, starts_at: null, ends_at: null }
  }
  const start = combine(date, item.startTime)
  let end = combine(date, item.endTime)
  if (end <= start) end = addDays(end, 1) // 밤을 넘기는 일정
  return {
    ...base,
    all_day: false,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    start_date: null,
    end_date: null,
  }
}

// 'HH:mm' 두 개를 '오후 7:00 – 8:30' 처럼
export function timeRangeLabel(item: Pick<QuickItem, 'allDay' | 'startTime' | 'endTime'>): string {
  if (item.allDay || !item.startTime) return '종일'
  const f = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h < 12 ? '오전' : '오후'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${ampm} ${h12}:${String(m).padStart(2, '0')}`
  }
  return item.endTime ? `${f(item.startTime)} – ${f(item.endTime)}` : f(item.startTime)
}
