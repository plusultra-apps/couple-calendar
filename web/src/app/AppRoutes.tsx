import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { useFirstRunTutorial } from '../features/tutorial/firstRun'
import { StackLayout, TabLayout } from './Layout'

// 메인(캘린더) 외에는 필요할 때 불러온다
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const WishPage = named(() => import('../features/wish/WishPage'), 'WishPage')
const AnniversaryPage = named(() => import('../features/anniversary/AnniversaryPage'), 'AnniversaryPage')
const MemoriesPage = named(() => import('../features/photos/MemoriesPage'), 'MemoriesPage')
const SettingsPage = named(() => import('../features/settings/SettingsPage'), 'SettingsPage')
const FreeTimePage = named(() => import('../features/free/FreeTimePage'), 'FreeTimePage')
const TutorialPage = named(() => import('../features/tutorial/TutorialPage'), 'TutorialPage')
const SharePage = named(() => import('../features/wish/SharePage'), 'SharePage')
const EventDetailPage = named(() => import('../features/events/EventDetailPage'), 'EventDetailPage')
const EventEditorPage = named(() => import('../features/events/EventEditorPage'), 'EventEditorPage')
const NotificationsPage = named(() => import('../features/notifications/NotificationsPage'), 'NotificationsPage')
const PokerLobbyPage = named(() => import('../features/poker/PokerLobbyPage'), 'PokerLobbyPage')
const PokerGamePage = named(() => import('../features/poker/PokerGamePage'), 'PokerGamePage')

export function AppRoutes() {
  useFirstRunTutorial()
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route index element={<CalendarPage />} />
        <Route path="wish" element={<WishPage />} />
        <Route path="memories" element={<MemoriesPage />} />
        <Route path="anniv" element={<AnniversaryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route element={<StackLayout />}>
        <Route path="event/new" element={<EventEditorPage />} />
        <Route path="event/:id" element={<EventDetailPage />} />
        <Route path="event/:id/edit" element={<EventEditorPage />} />
        <Route path="free" element={<FreeTimePage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="poker" element={<PokerLobbyPage />} />
        <Route path="poker/play" element={<PokerGamePage />} />
      </Route>
      <Route
        path="tutorial"
        element={
          <Suspense fallback={null}>
            <TutorialPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
