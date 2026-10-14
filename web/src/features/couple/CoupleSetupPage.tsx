import { format } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorText, Field } from '../../components/ui'
import { DateButton } from '../../components/DateTimePicker'
import { supabase, toMessage } from '../../lib/supabase'
import { useCreateCouple, useJoinCouple } from './queries'

// 로그인했지만 아직 커플이 없는 사람이 보는 화면
export function CoupleSetupPage() {
  const [startedOn, setStartedOn] = useState('')
  const [code, setCode] = useState('')
  const create = useCreateCouple()
  const join = useJoinCouple()

  function onCreate(e: FormEvent) {
    e.preventDefault()
    create.mutate(startedOn)
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    join.mutate(code)
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 px-5 py-10">
      <header className="text-center">
        <h1 className="text-xl font-bold">커플 연결하기</h1>
        <p className="mt-1 text-sm text-ink-soft">한 사람이 시작하고, 다른 사람이 초대 코드로 들어와요</p>
      </header>

      <Card>
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <h2 className="font-semibold">처음 시작하기</h2>
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-bold text-ink-soft">우리가 사귄 날</span>
            <DateButton
              value={startedOn}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={setStartedOn}
              title="우리가 사귄 날"
              quick={false}
            />
          </div>
          <ErrorText>{create.error && toMessage(create.error)}</ErrorText>
          <Button type="submit" disabled={create.isPending || !startedOn}>
            초대 코드 만들기
          </Button>
        </form>
      </Card>

      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        또는
        <span className="h-px flex-1 bg-line" />
      </div>

      <Card>
        <form onSubmit={onJoin} className="flex flex-col gap-4">
          <h2 className="font-semibold">초대 코드로 연결하기</h2>
          <Field
            label="상대에게 받은 6자리 코드"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            className="h-14 rounded-2xl border border-line bg-surface px-4 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:border-partner"
            required
          />
          <ErrorText>{join.error && toMessage(join.error)}</ErrorText>
          <Button type="submit" disabled={join.isPending || code.length !== 6}>
            연결하기
          </Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
        로그아웃
      </Button>
    </main>
  )
}
