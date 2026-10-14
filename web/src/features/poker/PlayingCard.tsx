import { Star } from 'lucide-react'
import { cardLabel, cardTier, JOKER } from './model'

// 카드 한 장. value 가 null 이면 뒷면(?). size: md = 내 카드 자리(64×88), lg = 결과 공개(112×156)
export function PlayingCard({
  value,
  size = 'lg',
  rotate = 0,
  winner = false,
  dim = false,
  label,
}: {
  value: number | null
  size?: 'md' | 'lg'
  rotate?: number
  winner?: boolean
  dim?: boolean
  label?: string
}) {
  const box = size === 'lg' ? 'h-[156px] w-[112px] rounded-2xl p-2.5' : 'h-[88px] w-16 rounded-xl p-1.5'
  const style = { transform: rotate ? `rotate(${rotate}deg)` : undefined }

  if (value === null)
    return (
      <div
        role="img"
        aria-label={label ?? '뒤집힌 카드'}
        className={`relative flex shrink-0 items-center justify-center border-[3px] border-ink bg-accent shadow-[0_6px_0_color-mix(in_srgb,var(--color-ink)_12%,transparent)] ${box}`}
        style={style}
      >
        <span className="absolute inset-1.5 rounded-lg border-2 border-dashed border-white/70" />
        <span className={`font-display text-white ${size === 'lg' ? 'text-6xl' : 'text-[34px]'}`}>?</span>
      </div>
    )

  const t = cardTier(value)
  const joker = value >= JOKER
  return (
    <div
      role="img"
      aria-label={label ?? `${joker ? '조커' : value} 카드`}
      className={`relative flex shrink-0 flex-col items-center border-[3px] ${t.border} ${t.bg} shadow-[0_6px_0_color-mix(in_srgb,var(--color-ink)_12%,transparent)] ${box} ${
        winner ? 'ring-[6px] ring-anniv ring-offset-0' : ''
      } ${dim ? 'opacity-85' : ''}`}
      style={style}
    >
      <span className={`font-display self-start leading-none ${t.ink} ${size === 'lg' ? 'text-[15px]' : 'text-xs'}`}>{cardLabel(value)}</span>
      <span className="my-auto flex flex-col items-center">
        {value === 20 && (
          <svg width={size === 'lg' ? 30 : 18} viewBox="0 0 34 24" aria-hidden>
            <path d="M3 20 L5 6 L12 13 L17 3 L22 13 L29 6 L31 20 Z" className="fill-crown stroke-card-king" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        )}
        {joker ? (
          <Star className={`fill-us text-card-joker ${size === 'lg' ? 'h-14 w-14' : 'h-8 w-8'}`} strokeWidth={1.6} aria-hidden />
        ) : (
          <span className={`font-display leading-none ${t.ink} ${size === 'lg' ? (value >= 10 ? 'text-[58px]' : 'text-[64px]') : 'text-[30px]'}`}>
            {value}
          </span>
        )}
      </span>
      <span className={`font-display ${t.ink} ${size === 'lg' ? 'text-[13px]' : 'text-[10px]'}`}>{t.label}</span>
      {winner && (
        <span className="font-display absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent-deep px-2.5 py-1 text-[13px] whitespace-nowrap text-white">
          승리
        </span>
      )}
    </div>
  )
}
