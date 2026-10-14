// 튜토리얼 연습용 가짜 데이터 (화면 안에서만 쓰고 어디에도 저장하지 않는다)
import { addDays } from 'date-fns'
import { combine, toKey, type DateKey } from '../../lib/dates'
import type { CoupleWithMembers, EventWithSecret, Profile } from '../../types/database'
import type { CalItem } from '../calendar/items'

export const DEMO_PARTNER_ID = 'demo-partner'

// 아직 상대가 연결 전이어도 둘이 쓰는 모습으로 보여 주기 위해 가짜 상대를 넣는다
export function demoCouple(real: CoupleWithMembers, userId: string): CoupleWithMembers {
  if (real.members.some((m) => m.id !== userId)) return real
  const me = real.members.find((m) => m.id === userId)!
  const partner: Profile = {
    id: DEMO_PARTNER_ID,
    nickname: '애인',
    avatar: me.avatar === '🐰' ? '🐻' : '🐰',
    color: me.color.toLowerCase() === '#f8b4c4' ? '#A7C7E7' : '#F8B4C4',
    couple_id: real.id,
    birthday: null,
    birthday_is_lunar: false,
    created_at: me.created_at,
    photo_path: null,
    notify_off: [],
    quiet_hours: true,
  }
  return { ...real, members: [...real.members, partner] }
}

// 오늘 기준 며칠 뒤 날짜들로 연습 달력을 만든다
export function demoDates(today = new Date()) {
  const key = (n: number) => toKey(addDays(today, n))
  return {
    day: key(2), // 날짜 창을 열어 볼 날
    stamp1: key(3),
    stamp2: key(5),
    key,
  }
}

type Who = 'me' | 'partner' | 'us'

export function makeItem(
  couple: CoupleWithMembers,
  meId: string,
  o: {
    id: string
    title: string
    who: Who
    start: DateKey
    end?: DateKey
    from?: string // 'HH:mm' 없으면 종일
    to?: string
    location?: string
    hidden?: boolean
  },
): CalItem {
  const partnerId = couple.members.find((m) => m.id !== meId)?.id ?? null
  const ownerId = o.who === 'us' ? null : o.who === 'me' ? meId : partnerId
  const member = couple.members.find((m) => m.id === ownerId)
  const allDay = !o.from
  const endKey = o.end ?? o.start
  const start = allDay ? combine(o.start, '00:00') : combine(o.start, o.from!)
  const end = allDay ? combine(endKey, '00:00') : combine(endKey, o.to!)
  return {
    key: `demo:${o.id}`,
    kind: 'event',
    title: o.title,
    color: member?.color ?? couple.us_color,
    allDay,
    start,
    end,
    startKey: o.start,
    endKey,
    ownerId,
    avatar: member?.avatar,
    hidden: o.hidden,
    // 일정 줄에서 장소를 보여 주려고 필요한 칸만 채운 가짜 일정
    event: { location: o.location ?? null, rrule: null } as unknown as EventWithSecret,
  }
}

export function demoItems(couple: CoupleWithMembers, meId: string, d: ReturnType<typeof demoDates>): CalItem[] {
  const k = d.key
  const it = (o: Parameters<typeof makeItem>[2]) => makeItem(couple, meId, o)
  return [
    it({ id: 'work', title: '출근', who: 'partner', start: d.day, from: '08:00', to: '18:30' }),
    it({ id: 'pilates1', title: '필라테스', who: 'me', start: d.day, from: '21:30', to: '22:30' }),
    it({ id: 'pilates2', title: '필라테스', who: 'me', start: k(-3), from: '20:00', to: '21:00' }),
    it({ id: 'pilates3', title: '필라테스', who: 'me', start: k(7), from: '20:00', to: '21:00' }),
    it({ id: 'cafe', title: '카페 투어', who: 'us', start: k(-1), from: '14:00', to: '17:00', location: '연남동' }),
    it({ id: 'movie', title: '영화 보기', who: 'us', start: k(6), from: '19:00', to: '21:30', location: 'CGV 용산' }),
    it({ id: 'trip', title: '부산 여행', who: 'us', start: k(9), end: k(11), location: '부산' }),
    it({ id: 'wedding', title: '친구 결혼식', who: 'partner', start: k(13) }),
    it({ id: 'team', title: '팀 회식', who: 'me', start: k(4), from: '19:00', to: '22:00' }),
    it({ id: 'diary', title: '혼자 일기', who: 'me', start: k(8), from: '22:00', to: '23:00', hidden: true }),
  ]
}

export type DemoWish = { id: string; title: string; tag: string; emoji: string; place?: string; note?: string; hue: number }

export const DEMO_WISHES: DemoWish[] = [
  { id: 'w1', title: '을지로 노포 투어', tag: '맛집', emoji: '🍜', place: '을지로3가', note: '골뱅이 골목도 가 보자', hue: 20 },
  { id: 'w2', title: '제주도 한 달 살기', tag: '여행', emoji: '✈️', note: '내년 봄?', hue: 200 },
]

export const DEMO_PLACES = [
  { name: '성수 연남 감자탕', address: '서울 성동구 성수동2가', category: '음식점 > 한식', hue: 30 },
  { name: '서울숲 피크닉존', address: '서울 성동구 성수동1가', category: '여행 > 공원', hue: 130 },
  { name: '어니언 성수', address: '서울 성동구 아차산로9길', category: '음식점 > 카페', hue: 45 },
]

// 사진 대신 쓰는 그림 (그라데이션 + 이모지)
export const DEMO_PHOTOS = [
  { emoji: '🌇', from: '#FFB199', to: '#FF0844' },
  { emoji: '🍝', from: '#F6D365', to: '#FDA085' },
  { emoji: '📸', from: '#A1C4FD', to: '#C2E9FB' },
  { emoji: '🎡', from: '#D4FC79', to: '#96E6A1' },
  { emoji: '🌊', from: '#89F7FE', to: '#66A6FF' },
  { emoji: '🍰', from: '#FBC2EB', to: '#A6C1EE' },
]
