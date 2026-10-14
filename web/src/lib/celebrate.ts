// 하트·반짝이가 퐁 터지는 축하 효과. 라이브러리 없이 Web Animations API 로 그린다.
// origin: 터지는 위치(화면 좌표). 없으면 화면 아래 가운데.

const EMOJIS = ['💖', '💕', '✨', '💗', '🌸', '💝']

export function celebrate(origin?: { x: number; y: number }, count = 14, emojis: string[] = EMOJIS) {
  if (typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const x0 = origin?.x ?? window.innerWidth / 2
  const y0 = origin?.y ?? window.innerHeight - 120

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.textContent = emojis[i % emojis.length]
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'fixed',
      left: `${x0}px`,
      top: `${y0}px`,
      fontSize: `${14 + Math.random() * 14}px`,
      pointerEvents: 'none',
      zIndex: '9999',
      willChange: 'transform, opacity',
    })
    document.body.appendChild(el)

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
    const dist = 70 + Math.random() * 110
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const rot = (Math.random() - 0.5) * 80

    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1.15) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 40}px)) scale(0.9) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ).onfinish = () => el.remove()
  }
}

// 클릭한 요소 위치에서 터뜨리기
export function celebrateAt(target: EventTarget | null, count = 8, emojis?: string[]) {
  const el = target as HTMLElement | null
  const r = el?.getBoundingClientRect?.()
  celebrate(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined, count, emojis)
}
