import { useState } from 'react'
import { Button, Card, ErrorText, Segmented, Spinner, Toggle } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { useCoupleCtx } from '../../app/couple'
import { useUpdateProfile } from '../settings/queries'
import { usePush, type PushStatus } from './usePush'

const HINT: Partial<Record<PushStatus, string>> = {
  unsupported: '이 브라우저는 알림을 지원하지 않아요. 크롬이나 사파리 최신 버전에서 사용해 주세요.',
  'needs-install': '아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요. 사파리 공유 버튼 → "홈 화면에 추가" 후 그 앱에서 켜 주세요.',
  denied: '알림 권한이 거부되어 있어요. 휴대폰 설정 → 앱(또는 브라우저) → 알림에서 러브로그 알림을 허용한 뒤 다시 시도해 주세요.',
}

// 설정 > 알림
export function PushSettings() {
  const { status, busy, enable, disable, sendTest } = usePush()
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [testing, setTesting] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setError('')
    setInfo('')
    try {
      await fn()
    } catch (e) {
      setError(toMessage(e))
    }
  }

  const onToggle = (on: boolean) => run(on ? enable : disable)

  const onTest = () =>
    run(async () => {
      setTesting(true)
      try {
        const sent = await sendTest()
        setInfo(sent > 0 ? `${sent}대의 기기로 테스트 알림을 보냈어요` : '알림을 받을 기기가 없어요. 먼저 알림 받기를 켜 주세요')
      } finally {
        setTesting(false)
      }
    })

  const hint = HINT[status]
  const usable = status === 'on' || status === 'off'

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">알림</h2>
      {status === 'loading' ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : (
        <Toggle
          checked={status === 'on'}
          disabled={!usable || busy}
          onChange={onToggle}
          label="알림 받기"
          description="상대가 일정·사진·댓글·위시를 남기거나 기념일이 다가오면 이 기기로 알려 줘요"
        />
      )}
      {hint && <p className="rounded-2xl bg-bg p-3 text-sm text-ink-soft">{hint}</p>}
      {status === 'on' && (
        <Button variant="soft" onClick={onTest} disabled={testing}>
          {testing ? '보내는 중…' : '테스트 알림 보내기'}
        </Button>
      )}
      {info && <p className="text-sm text-ink-soft">{info}</p>}
      <ErrorText>{error}</ErrorText>
      <NotifyPrefs />
    </Card>
  )
}

// 받을 알림 종류 (서버 알림 종류 이름과 같음: supabase/functions/_shared/push.ts Kind)
// tab = 설정 화면에서 묶는 탭 (일정 / 소통 / 기타)
type PrefTab = 'cal' | 'social' | 'etc'
const PREF_TABS: { value: PrefTab; label: string }[] = [
  { value: 'cal', label: '일정' },
  { value: 'social', label: '소통' },
  { value: 'etc', label: '기타' },
]
const KINDS: { kind: string; tab: PrefTab; label: string; description?: string }[] = [
  { kind: 'reminder', tab: 'cal', label: '⏰ 미리 알림', description: '일정 시작 1시간 전 · 아침 7시 오늘 요약 · 기념일 D-7·D-1·당일 · 생일 D-3·D-1·당일' },
  { kind: 'event', tab: 'cal', label: '📅 일정 추가·수정·삭제', description: '수정은 날짜·시간·제목·장소가 바뀔 때만' },
  { kind: 'anniv', tab: 'cal', label: '🎉 기념일 추가' },
  { kind: 'comment', tab: 'social', label: '💬 댓글·반응' },
  { kind: 'like', tab: 'social', label: '❤️ 사진 하트' },
  { kind: 'photo', tab: 'social', label: '📸 사진 올리기' },
  { kind: 'wish', tab: 'etc', label: '✨ 위시 담기·이루기' },
  { kind: 'game', tab: 'etc', label: '🃏 게임 초대', description: '인디언 포커 한 판 하자고 할 때' },
  { kind: 'update', tab: 'etc', label: '🆕 앱 업데이트 소식', description: '새 기능이 생기거나 고쳐졌을 때' },
]

// 종류별 끄기 · 조용한 시간. 꺼도 앱 안 알림함(🔔)에는 남는다.
function NotifyPrefs() {
  const { me } = useCoupleCtx()
  const update = useUpdateProfile(me.id)
  const [off, setOff] = useState<string[]>(me.notify_off)
  const [quiet, setQuiet] = useState(me.quiet_hours)
  const [tab, setTab] = useState<PrefTab>('cal')
  const [error, setError] = useState('')

  const save = async (patch: { notify_off?: string[]; quiet_hours?: boolean }) => {
    setError('')
    try {
      await update.mutateAsync(patch)
    } catch (e) {
      setError(toMessage(e))
      setOff(me.notify_off)
      setQuiet(me.quiet_hours)
    }
  }
  const toggleKind = (kind: string, on: boolean) => {
    const next = on ? off.filter((k) => k !== kind) : [...off, kind]
    setOff(next)
    save({ notify_off: next })
  }

  const shown = KINDS.filter((k) => k.tab === tab)

  return (
    <div className="mt-1 flex flex-col border-t-2 border-dashed border-line pt-3">
      <p className="px-1 font-bold">받을 알림</p>
      <p className="mb-2 px-1 text-xs text-ink-soft">꺼 둔 알림도 캘린더의 🔔 알림함에는 모여요</p>
      <Segmented value={tab} options={PREF_TABS} onChange={setTab} />
      <div className="mt-1 flex min-h-[9rem] flex-col divide-y divide-line">
        {shown.map((k) => (
          <Toggle
            key={k.kind}
            checked={!off.includes(k.kind)}
            onChange={(on) => toggleKind(k.kind, on)}
            label={k.label}
            description={k.description}
          />
        ))}
      </div>
      {/* 조용한 시간은 모든 알림에 걸리는 설정이라 탭과 상관없이 늘 보여 준다 */}
      <div className="mt-2 border-t-2 border-dashed border-line pt-2">
        <Toggle
          checked={quiet}
          onChange={(on) => {
            setQuiet(on)
            save({ quiet_hours: on })
          }}
          label="🌙 조용한 시간 (밤 11시 ~ 아침 7시)"
          description="그 사이 온 알림은 울리지 않고 모아 두었다가 아침 7시에 한 번에 알려 줘요"
        />
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
