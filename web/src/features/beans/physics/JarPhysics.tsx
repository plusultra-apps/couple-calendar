import Matter from 'matter-js'
import { useEffect, useRef, useState } from 'react'
import { beanClack, beanSoundOn, setBeanSoundOn, unlockBeanSound } from './beanSound'
import { beanSprite } from './beanSprite'

// 병 안의 콩: 실제처럼 중력으로 떨어지고, 쌓이고, 굴러간다.
// 폰을 기울이면 중력 방향이 바뀌고, 흔들면 콩이 튀어 오르며 부딪힐 때마다 소리가 난다.

export type JarBean = { id: string; color: string }

const W = 172 // 병 안쪽 너비 (CSS px)
const H = 214 // 병 안쪽 높이
const G = 9.81
const JERK_SHAKE = 14 // 이 정도로 빨리 흔들면 "흔들었다"

type Body = Matter.Body & { plugin: { id: string; color: string; pitch: number; lastSound: number } }
type Entry = { body: Body; sprite: HTMLCanvasElement; w: number; h: number }

// 같은 id 는 항상 같은 크기·소리 (새로고침해도 같다)
function hashOf(s: string) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

// compact: 지난 병처럼 보기만 할 때 (버튼 없이, 기울이기 없이)
export function JarPhysics({ beans, compact = false }: { beans: JarBean[]; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const syncRef = useRef<(b: JarBean[]) => void>(() => {})
  const beansRef = useRef(beans)
  beansRef.current = beans
  const shakeRef = useRef<(strength: number) => void>(() => {})
  const motionRef = useRef<{ request: () => Promise<void> } | null>(null)

  const [motion, setMotion] = useState<'checking' | 'need' | 'on' | 'none'>('checking')
  const [sound, setSound] = useState(beanSoundOn())

  // 물리 세계 + 그리기 + 센서: 병이 화면에 있는 동안만 돈다
  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } })
    const world = engine.world
    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(W / 2, H + 20, W + 40, 40, { isStatic: true, friction: 0.8, restitution: 0.1, label: 'wall' }),
      Matter.Bodies.rectangle(-20, H / 2, 40, H * 3, { isStatic: true, label: 'wall' }),
      Matter.Bodies.rectangle(W + 20, H / 2, 40, H * 3, { isStatic: true, label: 'wall' }),
    ])

    const entries = new Map<string, Entry>()

    const makeBean = (b: JarBean) => {
      const h = hashOf(b.id)
      // 콩 크기 7.5~9. 100개가 병 안에 자연스럽게 쌓일 정도로 작게 잡았다.
      const r = 7.5 + ((h % 100) / 100) * 1.5
      const pitch = 3200 - (r - 7.5) * 500 // 작은 콩일수록 높은 소리
      const body = Matter.Bodies.circle(18 + Math.random() * (W - 36), 14, r, {
        restitution: 0.3,
        friction: 0.5,
        frictionAir: 0.015,
        density: 0.0016,
        label: 'bean',
      }) as Body
      body.plugin = { id: b.id, color: b.color, pitch, lastSound: 0 }
      const w = r * 2.8 // 그림 크기 (물리 원보다 약간 크게 그려서 콩이 꽉 찬 느낌)
      const hgt = w * 0.75
      return { body, sprite: beanSprite(b.color), w, h: hgt }
    }

    // 목록과 맞춘다: 새 콩은 위에서 떨어뜨리고, 빠진 콩은 없앤다
    syncRef.current = (list) => {
      const want = new Set(list.map((b) => b.id))
      for (const [id, e] of entries) {
        if (!want.has(id)) {
          Matter.Composite.remove(world, e.body)
          entries.delete(id)
        }
      }
      for (const b of list) {
        if (!entries.has(b.id)) {
          const e = makeBean(b)
          entries.set(b.id, e)
          Matter.Composite.add(world, e.body)
        }
      }
    }
    syncRef.current(beansRef.current)

    // 흔들기: 콩들을 무작위로 튕긴다
    shakeRef.current = (strength) => {
      for (const { body } of entries.values()) {
        if (Math.random() < 0.5) {
          Matter.Body.setVelocity(body, {
            x: body.velocity.x + (Math.random() - 0.5) * strength * 0.5,
            y: body.velocity.y - Math.random() * strength * 0.4,
          })
        }
      }
    }

    // 부딪힐 때 소리: 세게 부딪힐수록 크게, 콩마다 다른 높이
    Matter.Events.on(engine, 'collisionStart', (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA as Body
        const b = pair.bodyB as Body
        const beanA = a.label === 'bean'
        const beanB = b.label === 'bean'
        if (!beanA && !beanB) continue
        const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y)
        if (rel < 1.2) continue
        const bean = (beanA ? a : b) as Body
        const now = performance.now()
        if (now - bean.plugin.lastSound < 70) continue // 같은 콩이 연달아 울리지 않게
        bean.plugin.lastSound = now
        beanClack(Math.min(1, rel / 9), bean.plugin.pitch)
      }
    })

    // 폰 기울기 → 중력 방향. 눕혀 두면 아래로.
    const grav = { x: 0, y: 1 }
    let prev: { x: number; y: number; z: number } | null = null
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc || acc.x == null || acc.y == null) return
      const ax = acc.x
      const ay = acc.y
      const az = acc.z ?? 0
      const jerk = prev ? Math.hypot(ax - prev.x, ay - prev.y, az - prev.z) : 0
      prev = { x: ax, y: ay, z: az }

      let gx = -ax
      let gy = ay
      const mag = Math.hypot(gx, gy)
      if (mag > G * 0.2) {
        gx /= mag
        gy /= mag
      } else {
        gx = 0
        gy = 1
      }
      grav.x += (gx - grav.x) * 0.15
      grav.y += (gy - grav.y) * 0.15
      engine.gravity.x = grav.x
      engine.gravity.y = grav.y

      if (jerk > JERK_SHAKE) shakeRef.current(Math.min(12, jerk * 0.6))
    }

    // 그리기
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const { body, sprite, w, h } of entries.values()) {
        ctx.save()
        ctx.translate(body.position.x, body.position.y)
        ctx.rotate(body.angle)
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h)
        ctx.restore()
      }
    }

    let raf = 0
    let last = performance.now()
    const frame = (t: number) => {
      Matter.Engine.update(engine, Math.min(33, t - last))
      last = t
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // 센서 연결 (iOS 는 권한 버튼을 눌러야 연결된다)
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    let attached = false
    const attach = () => {
      if (attached) return
      attached = true
      window.addEventListener('devicemotion', onMotion)
      setMotion('on')
    }
    if (compact || !DM) setMotion('none') // 지난 병은 기울이지 않는다
    else if (typeof DM.requestPermission === 'function') setMotion('need')
    else attach()

    // 리셋용 노출 (권한 버튼에서 쓴다)
    motionRef.current = {
      request: async () => {
        unlockBeanSound()
        try {
          const r = await DM!.requestPermission!()
          if (r === 'granted') attach()
          else setMotion('none')
        } catch {
          setMotion('none')
        }
      },
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('devicemotion', onMotion)
      Matter.Engine.clear(engine)
      syncRef.current = () => {}
      shakeRef.current = () => {}
      motionRef.current = null
    }
  }, [])

  // 콩 목록이 바뀌면 물리 세계도 맞춘다
  useEffect(() => {
    syncRef.current(beans)
  }, [beans])

  const onTapJar = () => {
    unlockBeanSound()
    shakeRef.current(10)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 병: 뚜껑 → 입구 → 몸통. 콩은 몸통 안(캔버스)에서만 움직인다 */}
      <div className="relative h-[260px] w-[180px] touch-none select-none" onPointerDown={onTapJar} role="img" aria-label="콩 병. 누르면 흔들려요">
        <div className="pointer-events-none absolute top-0 left-1/2 h-[20px] w-[104px] -translate-x-1/2 rounded-full border-4 border-line-deep bg-partner/70" />
        <div className="pointer-events-none absolute top-[17px] left-1/2 h-[24px] w-[120px] -translate-x-1/2 bg-white/55" />
        <div className="pointer-events-none absolute top-[36px] bottom-0 left-0 right-0 rounded-[32px] rounded-t-[56px] border-4 border-line-deep/70 bg-white/55 shadow-inner" />
        <canvas ref={canvasRef} className="absolute top-[46px] left-[4px] h-[214px] w-[172px]" />
      </div>

      {!compact && (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {motion === 'need' && (
          <button
            type="button"
            onClick={() => motionRef.current?.request()}
            className="font-display rounded-full border-2 border-accent-deep bg-accent px-3.5 py-1.5 text-[14px] text-white active:scale-95"
          >
            📳 폰 기울이기 켜기
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            unlockBeanSound()
            const next = !sound
            setBeanSoundOn(next)
            setSound(next)
          }}
          className="font-display rounded-full border-2 border-line bg-surface px-3.5 py-1.5 text-[14px] active:scale-95"
        >
          {sound ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'}
        </button>
      </div>
      )}
    </div>
  )
}
