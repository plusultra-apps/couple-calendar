import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useGoBack } from '../app/navigation'

// 화면 상단 헤더. back 을 주면 왼쪽에 뒤로가기 버튼.
export function PageHeader({ title, back, right }: { title: ReactNode; back?: boolean; right?: ReactNode }) {
  const goBack = useGoBack()
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur box-content">
      {back ? (
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => goBack()}
          className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : (
        <span className="w-3" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
      <div className="flex items-center gap-1 pr-1">{right}</div>
    </header>
  )
}

export function IconButton({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-line ${className}`}
    >
      {children}
    </button>
  )
}
