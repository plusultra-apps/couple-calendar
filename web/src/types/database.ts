// 앱에서 쓰는 DB 타입 별칭. 원본은 자동 생성 파일 database.types.ts
import type { Tables } from './database.types'

export type { Database, Json } from './database.types'

export type Couple = Tables<'couples'>
export type Profile = Tables<'profiles'>
export type EventRow = Tables<'events'>
export type EventSecret = Tables<'event_secrets'>
export type EventComment = Tables<'event_comments'>
export type EventReaction = Tables<'event_reactions'>
export type Anniversary = Tables<'anniversaries'>
export type Wish = Tables<'wishes'>
export type PushSubscriptionRow = Tables<'push_subscriptions'>
export type ExternalCalendar = Tables<'external_calendars'>
export type ExternalBusy = Tables<'external_busy'>
export type QuickTemplate = Tables<'quick_templates'>
export type Photo = Tables<'photos'>
export type AppNotification = Tables<'notifications'>
export type PokerGame = Tables<'poker_games'>
export type PokerPlayer = Tables<'poker_players'>
export type PokerRound = Tables<'poker_rounds'>
export type PokerHand = Tables<'poker_hands'>
export type PokerPeek = Tables<'poker_peeks'>

export type CoupleWithMembers = Couple & { members: Profile[] }

// 인디언 포커: 게임 + 두 사람의 점수판
export type PokerGameWithPlayers = PokerGame & { poker_players: PokerPlayer[] }

// 일정 + (본인 비공개 일정이면) 실제 내용
export type EventWithSecret = EventRow & { event_secrets: EventSecret | null }

export const WISH_TAGS = ['맛집', '카페', '여행', '데이트', '영화', '전시', '쇼핑', '기타'] as const
export type WishTag = (typeof WISH_TAGS)[number]

export const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🎉'] as const
