import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Copy, Download, LogOut, Share2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AVATARS, useCoupleCtx } from '../../app/couple'
import { THEMES, useTheme } from '../../app/theme'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { LunarDateInput } from '../../components/LunarDateInput'
import { Button, Card, ErrorText, Input, Toggle } from '../../components/ui'
import { DateButton } from '../../components/DateTimePicker'
import { daysTogether } from '../../lib/anniversary'
import { todayKey } from '../../lib/dates'
import { supabase, toMessage } from '../../lib/supabase'
// 핸드폰 달력 연동(피드 구독)·회사 캘린더 가져오기는 당분간 숨김 — 다시 쓰려면 주석을 풀면 된다
// import { ExternalCalendarsSettings } from '../external/ExternalCalendarsSettings'
// import { FeedSettings } from '../feed/FeedSettings'
import { IosInstallSteps } from '../install/IosInstallSteps'
import { isIOS, isStandalone, promptInstall, useCanInstall } from '../install/platform'
import { PushSettings } from '../push/PushSettings'
import { downloadBackup } from './exportData'
import { useUpdateCouple, useUpdateProfile } from './queries'

const APP_VERSION = '0.1.0'

// 고를 수 있는 파스텔 색 (사용자 색은 인라인 스타일로 칠한다)
const PALETTE = ['#A7C7E7', '#F8B4C4', '#B5E2C8', '#FFD59E', '#C3B1E1', '#FFC8A2', '#A0D8E8', '#E8C1D6']

export function SettingsPage() {
  return (
    <div className="pb-8">
      <PageHeader title="설정" />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <ProfileSection />
        <ThemeSection />
        <UsSection />
        <PlaySection />
        <PushSettings />
        {/* 핸드폰 기본 캘린더 연동·회사 캘린더 가져오기 — 당분간 숨김 (위 import 주석과 함께 되돌리면 된다) */}
        {/* <FeedSettings /> */}
        {/* <ExternalCalendarsSettings /> */}
        <InstallSection />
        <ExportSection />
        <TutorialSection />
        <LogoutSection />
      </div>
    </div>
  )
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-bold">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </div>
  )
}

// 저장 직후 잠깐 "저장했어요" 표시
function useSavedFlash() {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(t)
  }, [saved])
  return [saved, () => setSaved(true)] as const
}

function SaveButton({ dirty, pending, saved }: { dirty: boolean; pending: boolean; saved: boolean }) {
  return (
    <Button type="submit" disabled={!dirty || pending}>
      {pending ? (
        '저장 중…'
      ) : saved && !dirty ? (
        <span className="flex items-center justify-center gap-1">
          <Check className="h-5 w-5" aria-hidden /> 저장했어요
        </span>
      ) : (
        '저장'
      )}
    </Button>
  )
}

function ColorSwatches({
  value,
  onChange,
  label,
  takenBy,
}: {
  value: string
  onChange: (c: string) => void
  label: string
  takenBy?: { color: string; name: string }[]
}) {
  const lower = value.toLowerCase()
  const clash = takenBy?.find((t) => t.color.toLowerCase() === lower)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label={label}>
        {PALETTE.map((c) => {
          const active = c.toLowerCase() === lower
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`색 ${c}`}
              onClick={() => onChange(c)}
              className={`flex aspect-square items-center justify-center rounded-full transition active:scale-95 ${
                active ? 'ring-2 ring-ink/60 ring-offset-2 ring-offset-surface' : ''
              }`}
              style={{ backgroundColor: c }}
            >
              {active && <Check className="h-4 w-4 text-ink" aria-hidden />}
            </button>
          )
        })}
      </div>
      {clash && <p className="text-xs text-ink-soft">{clash.name}와(과) 같은 색이에요. 캘린더에서 구분이 어려울 수 있어요.</p>}
    </div>
  )
}

// ── 같이 놀기 ──

function PlaySection() {
  const navigate = useNavigate()
  return (
    <Card>
      <SectionTitle sub="둘이 술 한잔할 때 하는 미니 게임">같이 놀기</SectionTitle>
      <button
        type="button"
        onClick={() => navigate('/poker')}
        className="flex w-full items-center gap-3 rounded-2xl bg-bg px-4 py-3 text-left transition active:scale-[0.98]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-partner/40 text-2xl" aria-hidden>
          🃏
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block text-lg leading-tight">몽글 인디언 포커</span>
          <span className="block text-xs text-ink-soft">내 카드는 나만 몰라요. 표정으로 승부!</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
      </button>
    </Card>
  )
}

// ── 사용법 (튜토리얼) ──

function TutorialSection() {
  const navigate = useNavigate()
  return (
    <Card>
      <SectionTitle sub="연습용 화면으로 하나씩 눌러 보며 배워요. 실제 데이터는 바뀌지 않아요.">사용법</SectionTitle>
      <Button variant="soft" onClick={() => navigate('/tutorial')}>
        사용법 다시 보기
      </Button>
    </Card>
  )
}

// ── 테마 (이 휴대폰에만) ──

function ThemeSection() {
  const [theme, setTheme] = useTheme()
  return (
    <Card>
      <SectionTitle sub="이 휴대폰에서만 바뀌어요. 상대 화면은 그대로예요.">테마</SectionTitle>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="테마">
        {THEMES.map((t) => {
          const active = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(t.id)}
              className="flex flex-col items-center gap-1 active:scale-95"
            >
              {/* 미리보기: 배경 + 강조색 */}
              <span
                className={`relative flex aspect-square w-full flex-col justify-end gap-1 overflow-hidden rounded-2xl border-2 p-1.5 transition ${
                  active ? 'border-ink/60' : 'border-line'
                }`}
                style={{ backgroundColor: t.bg }}
              >
                <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: t.soft }} />
                <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: t.accent }} />
                {active && (
                  <span
                    className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: t.accent }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </span>
              <span className={`text-xs ${active ? 'font-bold' : 'text-ink-soft'}`}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ── 내 프로필 ──
function ProfileSection() {
  const { me, partner, couple } = useCoupleCtx()
  const update = useUpdateProfile(me.id)
  const [saved, flash] = useSavedFlash()
  const [nickname, setNickname] = useState(me.nickname)
  const [color, setColor] = useState(me.color)
  const [avatar, setAvatar] = useState(me.avatar)
  const [birthday, setBirthday] = useState(me.birthday ?? '')
  const [lunar, setLunar] = useState(me.birthday_is_lunar)
  const [error, setError] = useState('')

  const dirty =
    nickname.trim() !== me.nickname ||
    color !== me.color ||
    avatar !== me.avatar ||
    (birthday || null) !== me.birthday ||
    lunar !== me.birthday_is_lunar

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const name = nickname.trim()
    if (!name) return setError('닉네임을 입력해 주세요')
    if (lunar && !birthday) return setError('음력 생일 날짜를 다시 확인해 주세요')
    try {
      await update.mutateAsync({ nickname: name, color, avatar, birthday: birthday || null, birthday_is_lunar: lunar })
      setNickname(name)
      flash()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <Card>
      <SectionTitle>내 프로필</SectionTitle>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">닉네임</span>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="상대에게 보일 이름" />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-bold text-ink-soft">내 캐릭터 · 달력에서 내 일정 앞에 붙어요</span>
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="내 캐릭터">
            {AVATARS.map((a) => {
              const active = a === avatar
              const taken = partner?.avatar === a
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={taken ? `${a} (${partner?.nickname} 사용 중)` : a}
                  onClick={() => setAvatar(a)}
                  className={`relative flex aspect-square items-center justify-center rounded-full text-2xl transition active:scale-90 ${
                    active ? 'animate-pop ring-3 ring-accent' : ''
                  }`}
                  style={{ backgroundColor: active ? color : 'var(--color-bg)' }}
                >
                  {a}
                  {taken && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-surface px-1 text-[9px] font-bold text-ink-soft shadow">
                      {partner?.nickname?.slice(0, 2)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <ColorSwatches
          label="내 색"
          value={color}
          onChange={setColor}
          takenBy={[
            ...(partner ? [{ color: partner.color, name: partner.nickname || '상대' }] : []),
            { color: couple.us_color, name: '우리 일정' },
          ]}
        />

        <div className="flex flex-col gap-2">
          <Toggle checked={lunar} onChange={setLunar} label="음력 생일" description="음력으로 고르면 매년 그해 양력 날짜로 챙겨드려요" />
          {lunar ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">생일 (음력)</span>
              <LunarDateInput value={birthday} onChange={setBirthday} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="px-1 text-sm font-bold text-ink-soft">생일</span>
              <DateButton value={birthday} max={todayKey()} onChange={setBirthday} title="생일" placeholder="생일 고르기" quick={false} />
            </div>
          )}
        </div>

        <ErrorText>{error}</ErrorText>
        <SaveButton dirty={dirty} pending={update.isPending} saved={saved} />
      </form>
    </Card>
  )
}

// ── 우리 ──
function UsSection() {
  const { couple, partner, me } = useCoupleCtx()
  const update = useUpdateCouple(couple.id)
  const [saved, flash] = useSavedFlash()
  const [startedOn, setStartedOn] = useState(couple.started_on)
  const [usColor, setUsColor] = useState(couple.us_color)
  const [error, setError] = useState('')

  const dirty = startedOn !== couple.started_on || usColor !== couple.us_color

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!startedOn) return setError('사귄 날을 골라 주세요')
    if (startedOn > todayKey()) return setError('사귄 날은 오늘보다 늦을 수 없어요')
    try {
      await update.mutateAsync({ started_on: startedOn, us_color: usColor })
      flash()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <Card>
      <SectionTitle sub={`오늘로 ${daysTogether(couple.started_on).toLocaleString()}일째예요`}>우리</SectionTitle>

      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: me.color }} />
        <span className="truncate text-sm font-semibold">{me.nickname || '나'}</span>
        <span className="text-accent" aria-hidden>
          ♥
        </span>
        {partner ? (
          <>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: partner.color }} />
            <span className="truncate text-sm font-semibold">{partner.nickname || '상대'}</span>
          </>
        ) : (
          <span className="text-sm text-ink-soft">상대를 기다리는 중</span>
        )}
      </div>

      {!partner && <InviteCode code={couple.invite_code} />}

      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-bold text-ink-soft">우리가 사귄 날</span>
          <DateButton value={startedOn} max={todayKey()} onChange={setStartedOn} title="우리가 사귄 날" quick={false} />
        </div>
        <ColorSwatches
          label="‘우리’ 일정 색"
          value={usColor}
          onChange={setUsColor}
          takenBy={[
            { color: me.color, name: '내 색' },
            ...(partner ? [{ color: partner.color, name: partner.nickname || '상대' }] : []),
          ]}
        />
        <ErrorText>{error}</ErrorText>
        <SaveButton dirty={dirty} pending={update.isPending} saved={saved} />
      </form>
    </Card>
  )
}

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function share() {
    setError('')
    const text = `우리달력에서 같이 일정 관리해요\n초대 코드: ${code}\n${window.location.origin}`
    if (navigator.share) {
      try {
        await navigator.share({ title: '우리달력 초대', text })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        // 공유가 안 되면 복사로 넘어간다
      }
    }
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('복사하지 못했어요. 코드를 직접 알려 주세요')
    }
  }

  return (
    <div className="mb-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-partner bg-partner/10 px-4 py-5 text-center">
      <p className="text-sm text-ink-soft">상대에게 이 코드를 알려 주세요</p>
      <p className="font-mono text-3xl font-extrabold tracking-[0.35em] select-all">{code}</p>
      <button
        type="button"
        onClick={share}
        className="flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold shadow-sm active:bg-line"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden /> 복사했어요
          </>
        ) : 'share' in navigator ? (
          <>
            <Share2 className="h-4 w-4" aria-hidden /> 초대 코드 보내기
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden /> 코드 복사
          </>
        )}
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// ── 앱 설치 ──
function InstallSection() {
  const standalone = isStandalone()
  const canInstall = useCanInstall()
  const [guideOpen, setGuideOpen] = useState(false)
  const ios = isIOS()

  return (
    <Card>
      <SectionTitle sub="홈 화면에 추가하면 앱처럼 열리고 알림도 받을 수 있어요">앱 설치</SectionTitle>
      {standalone ? (
        <p className="flex items-center gap-2 rounded-2xl bg-us/25 px-4 py-3 text-sm font-semibold">
          <Check className="h-5 w-5" aria-hidden /> 설치된 앱으로 사용 중
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {canInstall && (
            <Button onClick={() => void promptInstall()}>
              <span className="flex items-center justify-center gap-1.5">
                <Download className="h-5 w-5" aria-hidden /> 지금 앱 설치하기
              </span>
            </Button>
          )}
          <HowTo
            title="아이폰"
            highlight={ios}
            steps={['사파리에서 열기', '아래 공유 버튼 누르기', '‘홈 화면에 추가’ 선택']}
          />
          <HowTo
            title="갤럭시"
            highlight={!ios}
            steps={['크롬에서 열기', '오른쪽 위 ⋮ 메뉴 누르기', '‘앱 설치’ 또는 ‘홈 화면에 추가’ 선택']}
          />
          {ios && (
            <Button variant="soft" onClick={() => setGuideOpen(true)}>
              그림으로 자세히 보기
            </Button>
          )}
        </div>
      )}
      {ios && (
        <Sheet
          open={guideOpen}
          onOpenChange={setGuideOpen}
          title="홈 화면에 추가하기"
          footer={<Button onClick={() => setGuideOpen(false)}>알겠어요</Button>}
        >
          <IosInstallSteps />
        </Sheet>
      )}
    </Card>
  )
}

function HowTo({ title, steps, highlight }: { title: string; steps: string[]; highlight: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${highlight ? 'bg-partner/15' : 'bg-bg'}`}>
      <p className="mb-1.5 text-sm font-bold">
        {title}
        {highlight && <span className="ml-1.5 text-xs font-semibold text-accent">지금 이 기기</span>}
      </p>
      <ol className="flex flex-col gap-1 text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink-soft">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── 데이터 내보내기 ──
function ExportSection() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function run() {
    setPending(true)
    setError('')
    setDone('')
    try {
      const n = await downloadBackup()
      setDone(`일정 ${n.events}개, 기념일 ${n.anniversaries}개, 위시 ${n.wishes}개를 저장했어요`)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <SectionTitle sub="일정·댓글·기념일·위시를 JSON 파일 하나로 내려받아요. 혹시 모를 때를 대비한 백업이에요. 가끔 한 번씩 받아 두면 든든해요.">
        데이터 내보내기
      </SectionTitle>
      <div className="flex flex-col gap-2">
        <Button variant="soft" onClick={run} disabled={pending}>
          <span className="flex items-center justify-center gap-1.5">
            <Download className="h-5 w-5" aria-hidden />
            {pending ? '모으는 중…' : '백업 파일 받기'}
          </span>
        </Button>
        {done && <p className="text-center text-xs text-ink-soft">{done}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Card>
  )
}

// ── 로그아웃 · 앱 정보 ──
function LogoutSection() {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)

  async function logout() {
    if (!window.confirm('로그아웃할까요?')) return
    setPending(true)
    try {
      await supabase.auth.signOut()
      qc.clear()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={logout} disabled={pending}>
        <span className="flex items-center justify-center gap-1.5">
          <LogOut className="h-5 w-5" aria-hidden /> {pending ? '로그아웃 중…' : '로그아웃'}
        </span>
      </Button>
      <footer className="flex flex-col items-center gap-1 pt-2 pb-4 text-xs text-ink-soft">
        <img src="/icon.svg" alt="" className="h-8 w-8 opacity-80" />
        <span>우리달력 v{APP_VERSION}</span>
        <span>둘의 시간을 한눈에</span>
      </footer>
    </>
  )
}
