// 콩 그림. /beans/bean.png 가 있으면 그 사진을 쓰고, 없으면 그림으로 콩을 그린다.
// 사진은 콩 한 알이 가운데 있는 투명 배경 PNG 를 권장한다 (public/beans/bean.png).

const PHOTO_URL = '/beans/bean.png'
const W = 96
const H = 72

let photo: HTMLImageElement | null = null
if (typeof window !== 'undefined') {
  const img = new Image()
  img.onload = () => {
    photo = img
    cache.clear() // 사진이 생기면 다시 그린다
  }
  img.onerror = () => {
    photo = null
  }
  img.src = PHOTO_URL
}

const cache = new Map<string, HTMLCanvasElement>()

// 같은 색 콩은 한 번만 그려 두고 재사용
export function beanSprite(color: string): HTMLCanvasElement {
  const hit = cache.get(color)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  if (photo) drawPhoto(ctx, color)
  else drawBean(ctx, color)
  cache.set(color, c)
  return c
}

// 사진 콩: 가운데 맞춰 그린 뒤 항목 색을 곱해서 입힌다
function drawPhoto(ctx: CanvasRenderingContext2D, color: string) {
  const s = Math.min(W / photo!.naturalWidth, H / photo!.naturalHeight)
  const w = photo!.naturalWidth * s
  const h = photo!.naturalHeight * s
  ctx.drawImage(photo!, (W - w) / 2, (H - h) / 2, w, h)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(photo!, (W - w) / 2, (H - h) / 2, w, h)
  ctx.globalCompositeOperation = 'source-over'
}

// 그림 콩: 콩 모양 타원 + 그라데이션 + 반짝임 + 배꼽(가운데 줄)
function drawBean(ctx: CanvasRenderingContext2D, color: string) {
  ctx.translate(W / 2, H / 2)
  const rx = 38
  const ry = 28
  const g = ctx.createRadialGradient(-12, -12, 4, 0, 0, 46)
  g.addColorStop(0, shade(color, 0.35))
  g.addColorStop(0.6, color)
  g.addColorStop(1, shade(color, -0.25))

  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = shade(color, -0.4)
  ctx.stroke()

  // 배꼽: 콩 한쪽에 살짝 휜 홈
  ctx.beginPath()
  ctx.ellipse(4, 2, 16, 4, -0.15, Math.PI * 0.1, Math.PI * 0.9)
  ctx.strokeStyle = shade(color, -0.45)
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.stroke()

  // 반짝임
  ctx.beginPath()
  ctx.ellipse(-14, -11, 11, 5, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()
}

// 색을 밝게(amt>0) 또는 어둡게(amt<0)
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex // CSS 변수 등은 그대로 (그림 콩은 기본 색 사용)
  const n = parseInt(m[1], 16)
  const mix = (v: number) => {
    const t = amt >= 0 ? 255 : 0
    const p = Math.abs(amt)
    return Math.round(v + (t - v) * p)
  }
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `rgb(${r},${g},${b})`
}
