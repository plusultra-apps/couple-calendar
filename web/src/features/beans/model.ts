// 콩 기록의 규칙: 병 크기, 항목 색·이모지, 식물이 자라는 단계

// 병 하나를 채우는 콩 수. 다 채우면 다음 병으로 넘어간다.
export const BEAN_GOAL = 100

// 항목 색 (설정의 내 색과 같은 파스텔)
export const BEAN_COLORS = ['#C3B1E1', '#F8B4C4', '#FFC8A2', '#FFD59E', '#B5E2C8', '#A7C7E7', '#A0D8E8', '#E8C1D6']

// 항목 이모지 고르기
export const EMOJI_CHOICES = [
  '🍽️', '🧸', '💋', '🎬', '☕', '🛍️', '🚶', '🎡', '🍰', '🌙', '💌', '🏖️',
  '🎤', '🛁', '🤗', '💑', '🍻', '🎁', '🌷', '🎂', '🚗', '📸', '🧁', '💗',
]

export type BeanType = {
  id: string
  label: string
  emoji: string
  color: string
  sort_order: number
  archived: boolean
}

// 식물이 자라는 단계: 콩 누적 개수 기준 (병을 비워도 줄지 않는다)
export const STAGES = [
  { min: 0, name: '씨앗', emoji: '🫘' },
  { min: 5, name: '새싹', emoji: '🌱' },
  { min: 15, name: '어린 나무', emoji: '🌿' },
  { min: 30, name: '나무', emoji: '🌳' },
  { min: 60, name: '꽃나무', emoji: '🌸' },
  { min: 100, name: '열매 나무', emoji: '🍎' },
  { min: 200, name: '전설의 나무', emoji: '✨' },
]

export function stageOf(total: number) {
  let i = 0
  while (i + 1 < STAGES.length && total >= STAGES[i + 1].min) i++
  const cur = STAGES[i]
  const next = STAGES[i + 1] ?? null
  const span = next ? next.min - cur.min : 1
  return {
    index: i,
    stage: cur,
    next,
    left: next ? next.min - total : 0,
    progress: next ? Math.min(1, (total - cur.min) / span) : 1,
  }
}
