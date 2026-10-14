import { AppRoutes } from './app/AppRoutes'
import { Mascot } from './components/Mascot'
import { CoupleProvider } from './app/couple'
import { useCoupleRealtime } from './app/realtime'
import { useSession } from './app/session'
import { AuthPage } from './features/auth/AuthPage'
import { InstallIntro } from './features/install/InstallIntro'
import { CoupleSetupPage } from './features/couple/CoupleSetupPage'
import { useCouple, useMyProfile } from './features/couple/queries'
import type { CoupleWithMembers } from './types/database'

function App() {
  return (
    <>
      <AppBody />
      <InstallIntro />
    </>
  )
}

function AppBody() {
  const session = useSession()
  if (session === undefined) return <Splash />
  if (session === null) return <AuthPage />
  return <SignedIn userId={session.user.id} />
}

function SignedIn({ userId }: { userId: string }) {
  const profile = useMyProfile(userId)
  const couple = useCouple(profile.data?.couple_id)

  if (profile.isPending) return <Splash />
  if (profile.isError) return <Splash message="프로필을 불러오지 못했어요" retry={() => profile.refetch()} />
  if (!profile.data.couple_id) return <CoupleSetupPage />
  if (couple.isPending) return <Splash />
  if (couple.isError) return <Splash message="커플 정보를 불러오지 못했어요" retry={() => couple.refetch()} />
  return <CoupleApp userId={userId} couple={couple.data} />
}

function CoupleApp({ userId, couple }: { userId: string; couple: CoupleWithMembers }) {
  useCoupleRealtime(couple.id)
  return (
    <CoupleProvider userId={userId} couple={couple}>
      <AppRoutes />
    </CoupleProvider>
  )
}

function Splash({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3">
      <Mascot size={140} />
      {message && <p className="text-sm text-ink-soft">{message}</p>}
      {retry && (
        <button type="button" onClick={retry} className="text-sm font-semibold text-accent">
          다시 시도
        </button>
      )}
    </main>
  )
}

export default App
