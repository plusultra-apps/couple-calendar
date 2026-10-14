import { useState } from 'react'
import { supabase, toMessage } from '../../lib/supabase'

// 개발 모드(npm run dev)에서만 렌더링한다. 배포 빌드에서는 import.meta.env.DEV 가 false 라 제거된다.
// 계정은 DB 에 미리 만들어 둔 커플: dev1(하늘) ↔ dev2(핑크)
const DEV_ACCOUNTS = [
  { email: 'dev1@example.com', label: '개발자1', color: 'bg-me' },
  { email: 'dev2@example.com', label: '개발자2', color: 'bg-partner' },
]

export function DevLogin() {
  const [error, setError] = useState('')
  const password = import.meta.env.VITE_DEV_PASSWORD
  if (!password) return null

  async function login(email: string) {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: password! })
    if (error) setError(toMessage(error))
  }

  return (
    <div className="rounded-3xl border border-dashed border-ink-soft/40 p-4">
      <p className="mb-3 text-center text-xs text-ink-soft">개발자 로그인 (개발 모드 전용)</p>
      <div className="grid grid-cols-2 gap-2">
        {DEV_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => login(a.email)}
            className={`h-11 rounded-2xl text-sm font-semibold ${a.color}`}
          >
            {a.label}로 들어가기
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </div>
  )
}
