import type { Profile } from '../../types/database'
import { cardLabel, cardTier, JOKER, mascotOf, type MascotKind } from './model'

// 곰·토끼 몽글이 (시안 Game/Main/Result 의 SVG). 좌표계 viewBox 0 0 200 218, 얼굴 가운데 (100,154).
// 몸 색은 profiles.color (사용자 색이라 인라인), 눈·코·볼터치는 테마 토큰.

export type Face = 'smile' | 'happy' | 'smug' | 'dizzy' | 'win'
// card: 숫자 = 앞면, 'back' = 뒷면(?), 없으면 카드 없음
export type ForeheadCard = number | 'back' | null

const EYE_Y = 154

function Eyes({ face }: { face: Face }) {
  if (face === 'happy')
    return (
      <g fill="none" className="stroke-ink" strokeWidth="3.5" strokeLinecap="round">
        <path d={`M64 ${EYE_Y} Q72 ${EYE_Y - 8} 80 ${EYE_Y}`} />
        <path d={`M120 ${EYE_Y} Q128 ${EYE_Y - 8} 136 ${EYE_Y}`} />
      </g>
    )
  if (face === 'win')
    return (
      <g fill="none" className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M62 ${EYE_Y + 2} L74 ${EYE_Y - 8} L86 ${EYE_Y + 2}`} />
        <path d={`M114 ${EYE_Y + 2} L126 ${EYE_Y - 8} L138 ${EYE_Y + 2}`} />
      </g>
    )
  if (face === 'dizzy')
    return (
      <g fill="none" className="stroke-ink" strokeWidth="4" strokeLinecap="round">
        <path d={`M72 ${EYE_Y} m-9 0 a9 9 0 1 1 9 9 a6 6 0 1 1 -6 -6 a3 3 0 1 1 3 3`} />
        <path d={`M128 ${EYE_Y} m-9 0 a9 9 0 1 1 9 9 a6 6 0 1 1 -6 -6 a3 3 0 1 1 3 3`} />
      </g>
    )
  return (
    <g>
      <circle cx="72" cy={EYE_Y} r="6.5" className="fill-ink" />
      <circle cx="128" cy={EYE_Y} r="6.5" className="fill-ink" />
      <circle cx="74" cy={EYE_Y - 2} r="2" className="fill-white" />
      <circle cx="130" cy={EYE_Y - 2} r="2" className="fill-white" />
      {face === 'smug' && (
        <g fill="none" className="stroke-ink" strokeWidth="3.5" strokeLinecap="round">
          <path d={`M60 ${EYE_Y - 12} L82 ${EYE_Y - 9}`} />
          <path d={`M140 ${EYE_Y - 12} L118 ${EYE_Y - 9}`} />
        </g>
      )}
    </g>
  )
}

function Mouth({ face }: { face: Face }) {
  if (face === 'win') return <path d="M84 168 Q100 192 116 168 Z" className="fill-ink" />
  const d =
    face === 'dizzy'
      ? 'M86 184 q4.7 -5 9.3 0 t9.3 0 t9.3 0'
      : face === 'smug'
        ? 'M92 182 Q104 184 110 176'
        : 'M91 180 Q100 188 109 180'
  return <path d={d} fill="none" className="stroke-ink" strokeWidth="3.5" strokeLinecap="round" />
}

// 이마에 붙인 카드
function Forehead({ card }: { card: Exclude<ForeheadCard, null> }) {
  if (card === 'back')
    return (
      <g transform="rotate(-5 100 86)">
        <rect x="64" y="40" width="72" height="100" rx="12" className="fill-ink" opacity="0.12" transform="translate(0 4)" />
        <rect x="64" y="40" width="72" height="100" rx="12" className="fill-accent stroke-ink" strokeWidth="3" />
        <rect x="72" y="48" width="56" height="84" rx="8" fill="none" className="stroke-white" opacity="0.7" strokeWidth="2" strokeDasharray="4 3" />
        <text x="100" y="106" textAnchor="middle" className="font-display fill-white" fontSize="44">
          ?
        </text>
      </g>
    )
  const t = cardTier(card)
  const joker = card >= JOKER
  return (
    <g transform="rotate(4 100 88)">
      <rect x="64" y="40" width="72" height="100" rx="12" className="fill-ink" opacity="0.12" transform="translate(0 4)" />
      <rect
        x="64"
        y="40"
        width="72"
        height="100"
        rx="12"
        className={`${joker ? 'fill-card-joker-bg' : card >= 16 ? 'fill-card-king-bg' : 'fill-surface'} ${t.stroke}`}
        strokeWidth="3"
      />
      <text x="77" y="58" textAnchor="middle" className={`font-display ${t.fill}`} fontSize="12">
        {cardLabel(card)}
      </text>
      {joker ? (
        <path
          transform="translate(78 62) scale(1.8)"
          d="M12 2 L14.8 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.2 8.6 Z"
          className="fill-us stroke-card-joker"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      ) : (
        <>
          {card === 20 && (
            <path
              transform="translate(88 44) scale(0.7)"
              d="M3 20 L5 6 L12 13 L17 3 L22 13 L29 6 L31 20 Z"
              className="fill-crown stroke-card-king"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
          <text x="100" y="106" textAnchor="middle" className={`font-display ${t.fill}`} fontSize="50">
            {card}
          </text>
        </>
      )}
      <text x="100" y="128" textAnchor="middle" className={`font-display ${t.fill}`} fontSize="11">
        {t.label}
      </text>
    </g>
  )
}

// 몸통 그룹 (다른 SVG 안에 넣어 쓸 수 있게 <g> 로)
export function MascotBody({ kind, color, face = 'smile', card = null }: { kind: MascotKind; color: string; face?: Face; card?: ForeheadCard }) {
  return (
    <g>
      {kind === 'bear' ? (
        <>
          <circle cx="50" cy="100" r="22" style={{ fill: color }} />
          <circle cx="50" cy="100" r="11" className="fill-white" opacity="0.5" />
          <circle cx="150" cy="100" r="22" style={{ fill: color }} />
          <circle cx="150" cy="100" r="11" className="fill-white" opacity="0.5" />
        </>
      ) : (
        <>
          <ellipse cx="66" cy="70" rx="17" ry="44" style={{ fill: color }} transform="rotate(-14 66 70)" />
          <ellipse cx="66" cy="72" rx="7" ry="28" className="fill-white" opacity="0.55" transform="rotate(-14 66 72)" />
          <ellipse cx="134" cy="70" rx="17" ry="44" style={{ fill: color }} transform="rotate(14 134 70)" />
          <ellipse cx="134" cy="72" rx="7" ry="28" className="fill-white" opacity="0.55" transform="rotate(14 134 72)" />
        </>
      )}
      <ellipse cx="100" cy="154" rx="74" ry="62" style={{ fill: color }} />
      <ellipse cx="72" cy="126" rx="16" ry="8" className="fill-white" opacity="0.35" />
      {face === 'dizzy' && <ellipse cx="100" cy="162" rx="62" ry="36" className="fill-blush" opacity="0.28" />}
      {kind === 'bear' && <ellipse cx="100" cy="178" rx="26" ry="18" className="fill-white" opacity="0.55" />}
      <Eyes face={face} />
      {face !== 'win' &&
        (kind === 'bear' ? (
          <ellipse cx="100" cy="170" rx="7" ry="5" className="fill-ink" />
        ) : (
          <ellipse cx="100" cy="168" rx="4" ry="3" className="fill-pour-line" />
        ))}
      <ellipse cx="56" cy="174" rx="11" ry="6" className="fill-blush" opacity="0.45" />
      <ellipse cx="144" cy="174" rx="11" ry="6" className="fill-blush" opacity="0.45" />
      <Mouth face={face} />
      {card !== null && <Forehead card={card} />}
    </g>
  )
}

export function PokerMascot({
  profile,
  face,
  card,
  width,
  label,
  className = '',
}: {
  profile: Pick<Profile, 'avatar' | 'color'>
  face?: Face
  card?: ForeheadCard
  width?: number
  label?: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 200 218"
      width={width}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      <MascotBody kind={mascotOf(profile)} color={profile.color} face={face} card={card} />
    </svg>
  )
}

// 얼굴만 (아바타 배지·사진 없을 때 아바타)
export function MascotFace({
  profile,
  face = 'smile',
  size,
  className = '',
}: {
  profile: Pick<Profile, 'avatar' | 'color'>
  face?: Face
  size: number
  className?: string
}) {
  return (
    <svg viewBox="22 86 156 136" width={size} height={size} aria-hidden className={className}>
      <MascotBody kind={mascotOf(profile)} color={profile.color} face={face} />
    </svg>
  )
}

// 프로필 동그라미: 사진이 있으면 사진 + 작은 마스코트 배지, 없으면 마스코트 얼굴
export function PokerAvatar({
  profile,
  url,
  size = 44,
  face = 'smile',
  online,
}: {
  profile: Pick<Profile, 'avatar' | 'color' | 'nickname'>
  url?: string
  size?: number
  face?: Face
  online?: boolean
}) {
  const border = size >= 40 ? 3 : 2
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface"
        style={{ border: `${border}px solid ${profile.color}` }}
      >
        {url ? (
          <img src={url} alt={`${profile.nickname} 프로필`} className="h-full w-full object-cover" />
        ) : (
          <MascotFace profile={profile} face={face} size={size - border * 2} />
        )}
      </span>
      {url && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-surface shadow-[0_0_0_2px_var(--color-surface)]"
          style={{ width: size * 0.5, height: size * 0.5, right: -size * 0.12, bottom: -size * 0.08 }}
        >
          <MascotFace profile={profile} face={face} size={size * 0.46} />
        </span>
      )}
      {online && (
        <span
          className="absolute right-[-2px] bottom-[-1px] h-[9px] w-[9px] rounded-full bg-free-deep shadow-[0_0_0_2px_var(--color-surface)]"
          aria-hidden
        />
      )}
    </span>
  )
}
