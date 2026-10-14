import { fillPath, fillY, GLASS_OUTLINE } from './model'

// ¼ 눈금 소주잔. fill = 0~1 채움, line = 수면에 빨간 선(여기까지 따르세요)
export function Glass({
  fill,
  width = 64,
  line = false,
  ticks = true,
  liquidClass = 'fill-soju',
  liquidColor,
  strokeWidth = 3,
  label,
  className = '',
}: {
  fill: number
  width?: number
  line?: boolean
  ticks?: boolean
  liquidClass?: string
  liquidColor?: string
  strokeWidth?: number
  label?: string
  className?: string
}) {
  const y = fillY(fill)
  return (
    <svg
      width={width}
      height={(width * 70) / 60}
      viewBox="0 0 60 70"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 ${className}`}
    >
      <path d={GLASS_OUTLINE} className="fill-surface" />
      {fill > 0 && (
        <path d={fillPath(fill)} className={liquidColor ? undefined : liquidClass} style={liquidColor ? { fill: liquidColor } : undefined} />
      )}
      {ticks && (
        <g fill="none" className="stroke-ink" opacity="0.25" strokeWidth="1.5">
          <path d="M12 51.5 H20" />
          <path d="M10.5 37 H18" />
          <path d="M9 22.5 H17" />
        </g>
      )}
      {line && fill > 0 && <path d={`M1 ${y.toFixed(1)} H59`} fill="none" className="stroke-pour-line" strokeWidth="2.5" />}
      <path d={GLASS_OUTLINE} fill="none" className="stroke-ink" strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  )
}

// 상단 정보줄의 작은 잔 3개 + 글
export function DrunkMeter({ fills, color, text }: { fills: number[]; color: string; text: string }) {
  return (
    <div className="flex items-center gap-[3px]">
      {fills.map((f, i) => (
        <Glass key={i} fill={f} width={13} ticks={false} strokeWidth={6} liquidColor={color} />
      ))}
      <span className="ml-[3px] text-xs text-ink-soft">{text}</span>
    </div>
  )
}
