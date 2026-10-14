import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorText, Field } from '../../components/ui'
import { supabase, toMessage } from '../../lib/supabase'
import { DevLogin } from './DevLogin'
import { Mascot } from '../../components/Mascot'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname.trim() } },
        })
        if (error) throw error
        // 메일 인증이 켜져 있으면 세션 없이 돌아온다
        if (!data.session) {
          setNotice('가입 확인 메일을 보냈어요. 링크를 누른 뒤 로그인해 주세요.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <header className="flex flex-col items-center gap-1">
        <Mascot size={180} />
        <h1 className="text-4xl text-accent-deep">우리달력</h1>
        <p className="font-display text-ink-soft">둘의 시간을 한눈에</p>
      </header>

      <Card>
        <div className="font-display mb-5 grid grid-cols-2 rounded-full border-2 border-line bg-bg p-1 text-base">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-10 rounded-full transition ${mode === m ? 'animate-pop bg-surface text-accent-deep shadow-[0_3px_0_var(--color-line)]' : 'text-ink-soft'}`}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <Field label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} required maxLength={20} />
          )}
          <Field
            label="이메일"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            label="비밀번호"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <ErrorText>{error}</ErrorText>
          {notice && <p className="text-sm text-ink-soft">{notice}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하기'}
          </Button>
        </form>
      </Card>

      {import.meta.env.DEV && <DevLogin />}
    </main>
  )
}
