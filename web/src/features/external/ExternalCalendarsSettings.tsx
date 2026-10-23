import { formatDistanceToNowStrict } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button, Card, ErrorText, Field, Spinner } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { useAddExternalCalendar, useDeleteExternalCalendar, useExternalCalendars, useSyncExternal } from './queries'

type Calendar = NonNullable<ReturnType<typeof useExternalCalendars>['data']>[number]

// 설정 > 회사 캘린더 가져오기
export function ExternalCalendarsSettings() {
  const calendars = useExternalCalendars()
  const [adding, setAdding] = useState(false)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">회사 캘린더 가져오기</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 items-center gap-1 rounded-full bg-partner/30 px-3 text-sm font-semibold active:bg-partner/50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          추가
        </button>
      </div>
      <p className="text-sm text-ink-soft">
        구글·아웃룩 캘린더 일정의 <b className="text-ink">시간만</b> 가져와 회색 "바쁨"으로 보여 줘요. 제목·내용은
        저장하지 않아서 상대에게도 바쁜 시간만 보여요. 30분마다 자동으로 새로 가져와요.
      </p>

      {calendars.isPending ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : calendars.isError ? (
        <ErrorText>{toMessage(calendars.error)}</ErrorText>
      ) : calendars.data.length === 0 ? (
        <p className="rounded-2xl bg-bg p-4 text-center text-sm text-ink-soft">연결된 캘린더가 없어요</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {calendars.data.map((c) => (
            <CalendarRow key={c.id} calendar={c} />
          ))}
        </ul>
      )}

      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </Card>
  )
}

function syncText(c: Calendar): string {
  if (!c.last_synced_at) return '아직 동기화 전이에요'
  return `${formatDistanceToNowStrict(new Date(c.last_synced_at), { locale: ko, addSuffix: true })} 동기화`
}

const iconButton =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft active:bg-line disabled:opacity-50'

function CalendarRow({ calendar: c }: { calendar: Calendar }) {
  const sync = useSyncExternal()
  const remove = useDeleteExternalCalendar()
  const [error, setError] = useState('')

  const onSync = () => {
    setError('')
    sync.mutate(c.id, { onError: (e) => setError(toMessage(e)) })
  }
  const onDelete = () => {
    if (!window.confirm(`‘${c.name}’ 연결을 끊을까요?\n가져온 바쁜 시간도 함께 지워져요.`)) return
    setError('')
    remove.mutate(c.id, { onError: (e) => setError(toMessage(e)) })
  }

  return (
    <li className="flex items-center gap-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.name}</p>
        {sync.isPending ? (
          <p className="text-xs text-ink-soft">동기화 중…</p>
        ) : c.last_error ? (
          // 마지막 동기화가 실패했으면 오류를 보여 준다
          <p className="text-xs text-holiday">{c.last_error}</p>
        ) : (
          <p className="text-xs text-ink-soft">{syncText(c)}</p>
        )}
        {error && error !== c.last_error && <p className="text-xs text-holiday">{error}</p>}
      </div>
      <button type="button" className={iconButton} onClick={onSync} disabled={sync.isPending} aria-label="지금 동기화">
        <RefreshCw className={`h-5 w-5 ${sync.isPending ? 'animate-spin' : ''}`} aria-hidden />
      </button>
      <button type="button" className={iconButton} onClick={onDelete} disabled={remove.isPending} aria-label="삭제">
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
    </li>
  )
}

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddExternalCalendar()
  const [name, setName] = useState('회사')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    const icsUrl = url.trim()
    if (!/^(https?|webcal):\/\//i.test(icsUrl)) {
      setError('https:// 또는 webcal:// 로 시작하는 주소를 붙여 넣어 주세요')
      return
    }
    add.mutate(
      { name: name.trim() || '회사', ics_url: icsUrl },
      {
        onSuccess: () => {
          setUrl('')
          setName('회사')
          onClose()
        },
        onError: (err) => setError(toMessage(err)),
      },
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="회사 캘린더 추가"
      footer={
        <Button onClick={() => submit()} disabled={add.isPending || !url.trim()}>
          {add.isPending ? '가져오는 중…' : '추가하고 가져오기'}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="이름" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="회사" />
        <Field
          label="ICS 주소"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://….ics"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-col gap-2 rounded-2xl bg-bg p-4 text-sm text-ink-soft">
          <p>
            <b className="text-ink">구글 캘린더</b> · PC 웹에서 캘린더 설정 → 내 캘린더의 설정(해당 캘린더) → 캘린더
            통합 → ‘iCal 형식의 비공개 주소’ 복사
          </p>
          <p>
            <b className="text-ink">아웃룩</b> · 설정 → 일정 → 공유 일정 → 일정 게시 → ICS 링크 복사
          </p>
          <p className="text-xs">주소는 비밀번호처럼 다뤄 주세요. 러브로그는 시간 정보만 저장해요.</p>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
