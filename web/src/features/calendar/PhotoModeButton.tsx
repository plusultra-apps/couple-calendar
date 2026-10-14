import { Camera } from 'lucide-react'

// 사진 보기 켜기/끄기: 켜면 달력 칸에 그날 대표 사진이 가득 보인다
export function PhotoModeButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={on ? '일정 보기로' : '사진 보기로'}
      aria-pressed={on}
      data-tut="photo-mode"
      onClick={onClick}
      className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 ${
        on
          ? 'animate-pop border-accent-deep bg-accent text-white shadow-[0_3px_0_var(--color-accent-deep)]'
          : 'border-line bg-surface/80 text-ink-soft'
      }`}
    >
      <Camera className="h-[18px] w-[18px]" />
    </button>
  )
}
