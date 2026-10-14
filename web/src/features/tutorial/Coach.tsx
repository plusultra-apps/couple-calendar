import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mascot } from '../../components/Mascot'
import type { Step } from './steps'

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6 // 밝게 뚫는 구멍 여백

// 'day:2026-10-04' 처럼 쓰면 달력의 그 날짜 칸
function findTarget(id: string): HTMLElement | null {
  if (id.startsWith('day:')) return document.querySelector<HTMLElement>(`[data-day="${id.slice(4)}"]`)
  return document.querySelector<HTMLElement>(`[data-tut="${id}"]`)
}

// 대상의 위치를 계속 따라간다 (시트가 올라오거나 스크롤해도)
function useTargetRect(id: string | undefined, stepKey: number) {
  const [rect, setRect] = useState<Rect | null>(null)

  // 단계가 바뀌면 대상이 보이도록 스크롤
  useEffect(() => {
    if (!id) return
    const t = setTimeout(() => findTarget(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
    return () => clearTimeout(t)
  }, [id, stepKey])

  useLayoutEffect(() => {
    if (!id) {
      setRect(null)
      return
    }
    let raf = 0
    let last = ''
    const tick = () => {
      const el = findTarget(id)
      if (el) {
        const r = el.getBoundingClientRect()
        const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
        const sig = `${Math.round(next.top)},${Math.round(next.left)},${Math.round(next.width)},${Math.round(next.height)}`
        if (sig !== last) {
          last = sig
          setRect(r.width > 0 ? next : null)
        }
      } else if (last !== 'none') {
        last = 'none'
        setRect(null)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [id, stepKey])

  return rect
}

// 화면을 어둡게 덮고 대상만 밝게 뚫어 둔다.
// - tap/dbltap 단계: 구멍 안의 진짜 버튼만 누를 수 있다 (나머지는 막힘)
// - next 단계: 구멍도 막고 말풍선의 '다음'으로만 넘어간다
export function Coach({
  step,
  index,
  total,
  onNext,
  onExit,
}: {
  step: Step
  index: number
  total: number
  onNext: () => void
  onExit: () => void
}) {
  const rect = useTargetRect(step.target, index)
  const waiting = !!step.target && !rect // 대상이 아직 화면에 안 나왔다
  const interactive = step.action === 'tap' || step.action === 'dbltap'
  const vw = window.innerWidth
  const vh = window.innerHeight

  // 말풍선은 대상이 위쪽에 있으면 아래에, 아래쪽이면 위에
  const below = rect ? rect.top + rect.height / 2 < vh * 0.5 : false
  const bubbleStyle: React.CSSProperties = rect
    ? below
      ? { top: Math.min(rect.top + rect.height + 14, vh - 220) }
      : { bottom: Math.min(vh - rect.top + 14, vh - 200) }
    : { top: '50%', transform: 'translateY(-50%)' }

  const shade = 'pointer-events-auto absolute bg-ink/60 transition-all duration-300'

  return createPortal(
    <div
      className="fixed inset-0 z-[200] select-none"
      style={{ pointerEvents: 'none' }}
      aria-live="polite"
      data-coach-target={step.target ?? ''}
      data-coach-action={step.action}
    >
      {/* 어두운 막: 구멍 주변 네 조각 */}
      {rect ? (
        <>
          <div className={shade} style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }} />
          <div className={shade} style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <div className={shade} style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
          <div
            className={shade}
            style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
          />
          {/* 반짝이는 테두리 */}
          <div
            className={`pointer-events-none absolute rounded-[22px] border-[3px] border-white shadow-[0_0_0_4px_var(--color-accent),0_0_24px_6px_var(--color-accent)] transition-all duration-300 ${interactive ? 'animate-pulse' : ''}`}
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          >
          </div>
          {/* 누르라는 손가락 */}
          {interactive && (
            <span
              className="animate-float pointer-events-none absolute text-4xl drop-shadow-lg"
              style={{
                left: Math.min(rect.left + rect.width / 2 - 8, vw - 48),
                top: below ? rect.top + rect.height - 6 : rect.top - 40,
              }}
              aria-hidden
            >
              {step.action === 'dbltap' ? '👆👆' : '👆'}
            </span>
          )}
          {/* next 단계는 구멍도 막는다 */}
          {!interactive && (
            <div className="pointer-events-auto absolute" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
          )}
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-ink/60" />
      )}

      {/* 말풍선 */}
      {!waiting && (
        <div className="pointer-events-auto absolute inset-x-3 mx-auto max-w-md" style={bubbleStyle}>
          <div className="animate-pop rounded-[26px] border-2 border-line bg-surface p-4 shadow-[0_6px_0_var(--color-line-deep),0_12px_30px_rgb(0_0_0/0.25)]">
            <div className="mb-1.5 flex items-center gap-2">
              {step.section && (
                <span className="font-display rounded-full bg-partner/40 px-2.5 py-0.5 text-xs text-accent-deep">
                  {step.section}
                </span>
              )}
              <span className="ml-auto text-xs text-ink-soft">
                {index + 1} / {total}
              </span>
              {/* 언제든 그만하기 */}
              <button
                type="button"
                onClick={onExit}
                className="-mr-1 flex h-7 items-center gap-0.5 rounded-full px-2 text-xs font-bold text-ink-soft active:bg-line"
              >
                <X className="h-3.5 w-3.5" /> 그만하기
              </button>
            </div>
            {!step.target && (
              <div className="mb-2 flex justify-center">
                <Mascot size={110} />
              </div>
            )}
            <h3 className="mb-1 text-[19px] leading-snug">{step.title}</h3>
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink">{step.body}</p>
            {/* 진행 막대 */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>
            {interactive ? (
              <p className="font-display mt-3 text-center text-[15px] text-accent-deep">
                {step.action === 'dbltap' ? '반짝이는 곳을 두 번 톡톡 눌러 보세요' : '반짝이는 곳을 눌러 보세요'}
              </p>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="font-display press-3d mt-3 h-12 w-full rounded-full bg-accent text-[17px] text-white [--shade:var(--color-accent-deep)]"
              >
                {step.cta ?? '다음'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>,
    document.body,
  )
}
