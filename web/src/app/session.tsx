import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// undefined = 아직 확인 중, null = 로그아웃 상태
const SessionContext = createContext<Session | null | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}

// 로그인 이후 화면에서만 사용
export function useUserId() {
  const session = useSession()
  if (!session) throw new Error('로그인이 필요한 화면입니다')
  return session.user.id
}
