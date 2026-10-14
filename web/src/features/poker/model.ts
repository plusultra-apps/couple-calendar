// 몽글 인디언 포커 — 화면에서 쓰는 순수 계산 (술 단위 q: 1q = ¼잔)
import type { Profile } from '../../types/database'

export const BASE_OPTIONS = [1, 2] as const
export const MAX_OPTIONS = [2, 4, 6] as const
export const WATER_OPTIONS = [4, 8, 12] as const
export const JOKER = 21

export type Rules = { base: number; max: number; water: number }
export const DEFAULT_RULES: Rules = { base: 1, max: 4, water: 8 }

// 1→'¼잔', 2→'½잔', 4→'1잔', 5→'1¼잔'
export function glassText(q: number): string {
  if (q <= 0) return '0잔'
  const whole = Math.floor(q / 4)
  const frac = ['', '¼', '½', '¾'][q % 4]
  return `${whole === 0 ? frac : `${whole}${frac}`}잔`
}

export const rulesSummary = (r: Rules) =>
  `기본 ${glassText(r.base)} · 최대 ${glassText(r.max)} · 물 ${glassText(r.water)}마다`

// 소주잔(viewBox 0 0 60 70, 입구 y=4 · 바닥 y=66) 안쪽을 f(0~1)만큼 채우는 사다리꼴
export const GLASS_OUTLINE = 'M6 4 H54 L48 66 H12 Z'
export function fillPath(f: number): string {
  if (f <= 0) return ''
  const k = Math.min(1, f)
  const y = 66 - 58 * k
  const xl = 6 + ((y - 4) * 6) / 62
  const xr = 54 - ((y - 4) * 6) / 62
  return `M${xl.toFixed(1)} ${y.toFixed(1)} L${xr.toFixed(1)} ${y.toFixed(1)} L48 66 L12 66 Z`
}
// 채움 f 의 수면 높이 (빨간 선 그릴 때)
export const fillY = (f: number) => 66 - 58 * Math.min(1, Math.max(0, f))

// q 를 잔(4q) 단위로 나눈 채움 비율들. 최소 1잔.
export function glassesFor(q: number, min = 1): number[] {
  const n = Math.max(min, Math.ceil(q / 4))
  return Array.from({ length: n }, (_, i) => Math.max(0, Math.min(4, q - i * 4)) / 4)
}

// 상단 정보줄의 작은 잔 3개 (최대 3잔까지 표시)
export const meter = (q: number) => glassesFor(Math.min(q, 12), 3).slice(0, 3)

// 카드 등급: 5장마다 색이 바뀐다
export type CardTier = { label: string; ink: string; fill: string; stroke: string; bg: string; border: string }
export function cardTier(n: number): CardTier {
  if (n >= JOKER)
    return { label: '조커', ink: 'text-card-joker', fill: 'fill-card-joker', stroke: 'stroke-ink', bg: 'bg-card-joker-bg', border: 'border-ink' }
  const t = Math.floor((n - 1) / 5)
  const names = ['쫄보', '애매', '든든', '왕']
  const ink = ['text-card-weak', 'text-card-meh', 'text-card-good', 'text-card-king'][t]
  const fill = ['fill-card-weak', 'fill-card-meh', 'fill-card-good', 'fill-card-king'][t]
  const king = t === 3
  return {
    label: names[t],
    ink,
    fill,
    stroke: king ? 'stroke-card-king' : 'stroke-ink',
    bg: king ? 'bg-card-king-bg' : 'bg-surface',
    border: king ? 'border-card-king' : 'border-ink',
  }
}
export const cardLabel = (n: number) => (n >= JOKER ? 'J' : String(n))

// 엿보기 힌트
export const HINT_TEXT: Record<string, string> = {
  '3': '3의 배수예요',
  '4': '4의 배수예요',
  '5': '5의 배수예요',
  lonely: '외톨이 숫자예요',
}
export const hintText = (h: string | null | undefined) => (h ? (HINT_TEXT[h] ?? h) : '')

// 취함 단계 (게임 누적)
export function drunkStage(q: number): string {
  if (q < 4) return '멀쩡'
  if (q < 8) return '알딸딸'
  if (q < 10) return '헤롱헤롱'
  return '물 마셔!'
}

// 반잔 원샷권을 쓰면 바뀌는 벌칙 (1 이면 면제)
export const halfOf = (drink: number) => (drink <= 1 ? 0 : Math.floor((drink + 1) / 2))

// 이번 판 벌칙으로 water 의 배수를 새로 넘었나
export function crossedWater(drunkAfter: number, drink: number, water: number): boolean {
  if (water <= 0 || drink <= 0) return false
  const before = drunkAfter - drink
  return Math.floor(drunkAfter / water) > Math.floor(before / water)
}

// 상대 행동 말풍선
export function actionBubble(action: string | null | undefined): string | null {
  if (action === 'raise') return '레이즈! +¼잔'
  if (action === 'call') return '콜!'
  if (action === 'fold') return '다이…'
  return null
}

// 마스코트: 토끼 아바타면 토끼, 나머지는 곰
export type MascotKind = 'bear' | 'rabbit'
export const mascotOf = (p: Pick<Profile, 'avatar'> | null | undefined): MascotKind => (p?.avatar === '🐰' ? 'rabbit' : 'bear')

// 이름 뒤 조사: 받침 있으면 a(이·은), 없으면 b(가·는). 한글이 아니면 b
export function josa(name: string, a: string, b: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  const has = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${name}${has ? a : b}`
}

// 오늘의 룰: 휴대폰마다 마지막으로 고른 값을 기억 (localStorage)
const RULES_KEY = 'ourcal.poker.rules'
export function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (!raw) return DEFAULT_RULES
    const v = JSON.parse(raw) as Partial<Rules>
    return {
      base: (BASE_OPTIONS as readonly number[]).includes(v.base ?? 0) ? v.base! : DEFAULT_RULES.base,
      max: (MAX_OPTIONS as readonly number[]).includes(v.max ?? 0) ? v.max! : DEFAULT_RULES.max,
      water: (WATER_OPTIONS as readonly number[]).includes(v.water ?? 0) ? v.water! : DEFAULT_RULES.water,
    }
  } catch {
    return DEFAULT_RULES
  }
}
export function saveRules(r: Rules) {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(r))
  } catch {
    // 저장 못 해도 이번 화면에서는 쓴다
  }
}
