import { createContext, useContext, type ReactNode } from 'react'
import type { CoupleWithMembers, Profile } from '../types/database'

type CoupleCtx = {
  userId: string
  couple: CoupleWithMembers
  me: Profile
  partner: Profile | null
}

const Ctx = createContext<CoupleCtx | null>(null)

export function CoupleProvider({
  userId,
  couple,
  children,
}: {
  userId: string
  couple: CoupleWithMembers
  children: ReactNode
}) {
  const me = couple.members.find((m) => m.id === userId)!
  const partner = couple.members.find((m) => m.id !== userId) ?? null
  return <Ctx.Provider value={{ userId, couple, me, partner }}>{children}</Ctx.Provider>
}

// 커플 연결 이후 화면에서 사용
export function useCoupleCtx() {
  const v = useContext(Ctx)
  if (!v) throw new Error('CoupleProvider 밖에서 호출했습니다')
  return v
}

export const US_AVATAR = '💞'

// 고를 수 있는 동물 아바타
export const AVATARS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐨', '🐹', '🐥', '🐯', '🐷', '🐸', '🦄', '🐧', '🐳', '🦁']

// 일정 소유자 색 · 이름 · 아바타
export function useOwnerInfo() {
  const { couple, userId } = useCoupleCtx()
  return (ownerId: string | null) => {
    if (!ownerId) return { color: couple.us_color, name: '우리', avatar: US_AVATAR, isMe: false }
    const m = couple.members.find((p) => p.id === ownerId)
    return {
      color: m?.color ?? couple.us_color,
      name: m?.nickname ?? '알 수 없음',
      avatar: m?.avatar ?? '🙂',
      isMe: ownerId === userId,
    }
  }
}

export function nicknameOf(couple: CoupleWithMembers, id: string | null | undefined) {
  return couple.members.find((m) => m.id === id)?.nickname ?? ''
}
