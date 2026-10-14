import { CalendarDays, Gift, Images, Settings, Sparkles } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { InstallPrompt } from '../features/install/InstallPrompt'

const TABS = [
  { to: '/', label: '캘린더', icon: CalendarDays, end: true },
  { to: '/wish', label: '위시', icon: Sparkles, end: false },
  { to: '/memories', label: '추억', icon: Images, end: false },
  { to: '/anniv', label: '기념일', icon: Gift, end: false },
  { to: '/settings', label: '설정', icon: Settings, end: false },
]

// 하단 탭이 있는 메인 화면들
export function TabLayout() {
  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      {/* 설치 안내는 위에 (아래 버튼들에 가리지 않게) */}
      <InstallPrompt />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      {/* 둥둥 떠 있는 알약 모양 탭 */}
      <div className="shrink-0 px-3 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <nav className="grid grid-cols-5 rounded-full border-2 border-line bg-surface/95 p-1.5 shadow-[0_5px_0_var(--color-line)] backdrop-blur">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              replace
              className={({ isActive }) =>
                `font-display flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] transition active:scale-90 ${
                  isActive ? 'bg-partner/35 text-accent-deep' : 'text-ink-soft'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-6 w-6 ${isActive ? 'animate-pop' : ''}`} strokeWidth={isActive ? 2.6 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

// 탭 없이 전체 화면을 쓰는 하위 화면들 (일정 편집·상세 등)
export function StackLayout() {
  return (
    <div className="mx-auto h-dvh max-w-md overflow-y-auto">
      <Suspense fallback={<PageSpinner />}>
        <Outlet />
      </Suspense>
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-60 items-center justify-center">
      <Spinner />
    </div>
  )
}
