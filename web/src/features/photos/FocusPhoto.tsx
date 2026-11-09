import { useRef, useState, type PointerEvent } from 'react'

export type Focus = { x: number; y: number } // 0~100 %, 보이는 부분의 가운데 위치

const clamp = (v: number) => Math.min(100, Math.max(0, v))

// 칸을 채우는 사진. 편집 중에는 끌어서 보이는 부분을 고른다 (남는 쪽 길이만큼만 움직인다).
export function FocusPhoto({
  url,
  focus,
  editing = false,
  onDrag,
  className = '',
  alt = '',
}: {
  url: string
  focus: Focus
  editing?: boolean
  onDrag?: (f: Focus) => void
  className?: string
  alt?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const start = useRef<{ px: number; py: number; f: Focus } | null>(null)

  function down(e: PointerEvent<HTMLDivElement>) {
    if (!editing) return
    box.current?.setPointerCapture(e.pointerId)
    start.current = { px: e.clientX, py: e.clientY, f: focus }
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    const el = box.current
    if (!s || !el || !nat || !onDrag) return
    const W = el.clientWidth
    const H = el.clientHeight
    // 사진이 칸을 꽉 채우도록 커진 뒤, 칸보다 삐져나온 길이
    const scale = Math.max(W / nat.w, H / nat.h)
    const overX = nat.w * scale - W
    const overY = nat.h * scale - H
    // 손가락을 오른쪽으로 밀면 사진도 오른쪽으로 → 보이는 위치는 왼쪽으로
    const x = overX > 0 ? clamp(s.f.x - ((e.clientX - s.px) / overX) * 100) : s.f.x
    const y = overY > 0 ? clamp(s.f.y - ((e.clientY - s.py) / overY) * 100) : s.f.y
    onDrag({ x: Math.round(x), y: Math.round(y) })
  }

  function up() {
    start.current = null
  }

  return (
    <div
      ref={box}
      className={`relative overflow-hidden ${className} ${editing ? 'touch-none cursor-move' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className="pointer-events-none h-full w-full object-cover"
        style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
      />
    </div>
  )
}
