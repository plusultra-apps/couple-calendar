// 러브로그 마스코트: 파랑 곰 몽글이 + 핑크 토끼 몽글이가 하트를 들고 있다
export function Mascot({
  size = 120,
  float = true,
  className = '',
  left = '#A7C7E7',
  right = '#F8B4C4',
}: {
  size?: number
  float?: boolean
  className?: string
  left?: string
  right?: string
}) {
  return (
    <svg
      viewBox="0 0 200 150"
      width={size}
      height={(size * 150) / 200}
      className={`${float ? 'animate-float' : ''} ${className}`}
      role="img"
      aria-label="몽글이 커플"
    >
      {/* 그림자 */}
      <ellipse cx="100" cy="140" rx="70" ry="7" fill="#4B3A4F" opacity="0.08" />

      {/* 왼쪽: 곰 */}
      <g>
        <circle cx="38" cy="50" r="12" fill={left} />
        <circle cx="38" cy="50" r="6" fill="#fff" opacity="0.5" />
        <circle cx="86" cy="46" r="12" fill={left} />
        <circle cx="86" cy="46" r="6" fill="#fff" opacity="0.5" />
        <ellipse cx="62" cy="92" rx="44" ry="44" fill={left} />
        <ellipse cx="50" cy="74" rx="14" ry="9" fill="#fff" opacity="0.35" />
        <circle cx="50" cy="90" r="4.5" fill="#4B3A4F" />
        <circle cx="74" cy="88" r="4.5" fill="#4B3A4F" />
        <circle cx="51.5" cy="88.5" r="1.4" fill="#fff" />
        <circle cx="75.5" cy="86.5" r="1.4" fill="#fff" />
        <ellipse cx="42" cy="101" rx="7" ry="4" fill="#FF8DB3" opacity="0.45" />
        <ellipse cx="83" cy="98" rx="7" ry="4" fill="#FF8DB3" opacity="0.45" />
        <path d="M57 99 Q62 104 67 99" stroke="#4B3A4F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* 오른쪽: 토끼 */}
      <g>
        <ellipse cx="122" cy="34" rx="9" ry="24" fill={right} transform="rotate(-12 122 34)" />
        <ellipse cx="122" cy="36" rx="4" ry="15" fill="#fff" opacity="0.5" transform="rotate(-12 122 36)" />
        <ellipse cx="156" cy="32" rx="9" ry="24" fill={right} transform="rotate(14 156 32)" />
        <ellipse cx="156" cy="34" rx="4" ry="15" fill="#fff" opacity="0.5" transform="rotate(14 156 34)" />
        <ellipse cx="140" cy="94" rx="42" ry="42" fill={right} />
        <ellipse cx="128" cy="76" rx="13" ry="8" fill="#fff" opacity="0.35" />
        <path d="M122 92 Q127 87 132 92" stroke="#4B3A4F" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M148 92 Q153 87 158 92" stroke="#4B3A4F" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="118" cy="102" rx="7" ry="4" fill="#FF6F9C" opacity="0.4" />
        <ellipse cx="162" cy="102" rx="7" ry="4" fill="#FF6F9C" opacity="0.4" />
        <path d="M135 101 Q140 106 145 101" stroke="#4B3A4F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* 가운데 하트 */}
      <g className="origin-center" style={{ transformBox: 'fill-box' }}>
        <path
          d="M101 132 C 86 120 80 112 80 104 C 80 97 86 92 92 92 C 96 92 99 94 101 97 C 103 94 106 92 110 92 C 116 92 122 97 122 104 C 122 112 116 120 101 132 Z"
          fill="#FF6F9C"
          stroke="#fff"
          strokeWidth="3"
        />
        <ellipse cx="93" cy="101" rx="4" ry="2.5" fill="#fff" opacity="0.6" transform="rotate(-30 93 101)" />
      </g>
    </svg>
  )
}
