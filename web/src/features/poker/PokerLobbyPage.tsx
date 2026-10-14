import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { useGoBack } from '../../app/navigation'
import { Button, EmptyState, ErrorText, Spinner } from '../../components/ui'
import { useSignedUrls } from '../../lib/photos'
import { toMessage } from '../../lib/supabase'
import type { PokerGameWithPlayers, Profile } from '../../types/database'
import { glassText, josa, loadRules, mascotOf, rulesSummary, saveRules, type Rules } from './model'
import { MascotBody, PokerAvatar } from './PokerMascot'
import { HowToSheet, PokerScreen, RoundButton, RulesSheet } from './PokerUI'
import { pokerKeys, usePokerEnd, usePokerGame, usePokerJoin, usePokerOpen, usePokerToday } from './queries'

type LobbyState = 'none' | 'mine' | 'theirs' | 'playing'

// /poker — 로비: 게임 열기 · 상대 기다리기 · 참가하기
export function PokerLobbyPage() {
  const { userId, me, partner } = useCoupleCtx()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const qc = useQueryClient()
  const game = usePokerGame((d) => d?.status === 'waiting' && d.created_by === userId)
  const today = usePokerToday()
  const urls = useSignedUrls([me.photo_path, partner?.photo_path])
  const open = usePokerOpen()
  const join = usePokerJoin()
  const end = usePokerEnd()

  const [localRules, setLocalRules] = useState<Rules>(loadRules)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [error, setError] = useState('')

  const g = game.data ?? null
  const state: LobbyState = !g ? 'none' : g.status === 'playing' ? 'playing' : g.created_by === userId ? 'mine' : 'theirs'
  const rules: Rules = g ? { base: g.base_q, max: g.max_q, water: g.water_q } : localRules

  // 내가 연 게임에 상대가 들어오면 바로 게임 화면으로 (처음부터 진행 중이면 자동으로 넘기지 않는다 — 뒤로 가기 무한 반복 방지)
  const prev = useRef<LobbyState | null>(null)
  useEffect(() => {
    if (game.isLoading) return
    if (prev.current === 'mine' && state === 'playing') navigate('/poker/play')
    prev.current = state
  }, [state, game.isLoading, navigate])

  const busy = open.isPending || join.isPending || end.isPending
  const partnerName = partner?.nickname || '상대'

  const run = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(toMessage(e))
    }
  }

  const start = () =>
    run(async () => {
      saveRules(localRules)
      const id = await open.mutateAsync(localRules)
      // 동시에 상대도 열었으면 open 이 상대 게임을 돌려준다 → 바로 참가
      const cur = qc.getQueryData<PokerGameWithPlayers | null>(pokerKeys.game)
      if (cur && cur.id === id && cur.status === 'waiting' && cur.created_by !== userId) {
        await join.mutateAsync(id)
        navigate('/poker/play')
      } else if (cur?.status === 'playing') {
        navigate('/poker/play')
      }
    })

  const joinGame = () =>
    run(async () => {
      if (!g) return
      await join.mutateAsync(g.id)
      navigate('/poker/play')
    })

  const stop = (ask: string) =>
    run(async () => {
      if (!g || !window.confirm(ask)) return
      await end.mutateAsync(g.id)
    })

  const changeRules = (r: Rules) => {
    setLocalRules(r)
    saveRules(r)
  }

  if (!partner)
    return (
      <PokerScreen>
        <TopBar onBack={() => goBack('/settings')} onHelp={() => setHelpOpen(true)} />
        <EmptyState emoji="🃏" title="둘이 연결되면 할 수 있어요">
          설정에서 초대 코드로 상대와 먼저 연결해 주세요.
        </EmptyState>
        <HowToSheet open={helpOpen} onOpenChange={setHelpOpen} />
      </PokerScreen>
    )

  const todayMe = today.data?.[me.id] ?? 0
  const todayPartner = today.data?.[partner.id] ?? 0

  return (
    <PokerScreen>
      <TopBar onBack={() => goBack('/settings')} onHelp={() => setHelpOpen(true)} />

      <LobbyScene me={me} partner={partner} />

      <div className="mt-2.5 flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-[34px] leading-tight">몽글 인디언 포커</h1>
        <p className="text-sm text-ink-soft">내 카드는 나만 몰라요. 표정으로 승부!</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {game.isLoading ? (
          <Spinner />
        ) : (
          <span className="flex items-center gap-2 rounded-full bg-free/35 py-1 pr-3 pl-1 text-[13px] font-bold text-ink">
            <PokerAvatar
              profile={partner}
              url={partner.photo_path ? urls.data?.[partner.photo_path] : undefined}
              size={28}
              online={state === 'theirs' || state === 'playing'}
            />
            {state === 'none' && `${partnerName}에게 한 판 하자고 해요`}
            {state === 'mine' && (
              <>
                {josa(partnerName, '이', '가')} 들어오길 기다리는 중
                <span className="h-2 w-2 animate-pulse rounded-full bg-anniv" aria-hidden />
              </>
            )}
            {state === 'theirs' && `${josa(partnerName, '이', '가')} 기다리고 있어요!`}
            {state === 'playing' && `${josa(partnerName, '과', '와')} 게임 중`}
          </span>
        )}
        {(todayMe > 0 || todayPartner > 0) && (
          <span className="rounded-full bg-ink/6 px-3 py-[7px] text-[13px] text-ink">
            오늘 {me.nickname || '나'} {glassText(todayMe)} · {partnerName} {glassText(todayPartner)}
          </span>
        )}
      </div>

      {game.error && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <ErrorText>{toMessage(game.error)}</ErrorText>
          <button type="button" onClick={() => game.refetch()} className="text-sm font-bold text-accent-deep">
            다시 불러오기
          </button>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-6">
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="flex h-[60px] items-center gap-3 rounded-[18px] bg-surface px-4 text-left shadow-[0_0_0_2px_var(--color-line)] active:scale-[0.99]"
        >
          <span className="font-display shrink-0 text-base">오늘의 룰</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{rulesSummary(rules)}</span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-soft" aria-hidden />
        </button>

        <ErrorText>{error}</ErrorText>

        {game.isLoading ? null : state === 'none' ? (
          <>
            <Button onClick={start} disabled={busy} className="h-[60px] rounded-[18px] text-2xl">
              {open.isPending ? '여는 중…' : '게임 시작'}
            </Button>
            <p className="py-2 text-center text-[13px] text-ink-soft">시작하면 {partnerName}에게 알림이 가요</p>
          </>
        ) : state === 'mine' ? (
          <>
            <div className="flex h-[60px] items-center justify-center gap-2 rounded-[18px] bg-partner/25 text-ink">
              <Spinner className="h-5 w-5" />
              <span className="font-display text-lg">{partnerName} 기다리는 중…</span>
            </div>
            <Button variant="ghost" onClick={() => stop('기다리기를 그만할까요?')} disabled={busy} className="h-11 text-base">
              {end.isPending ? '닫는 중…' : '그만 기다릴래'}
            </Button>
          </>
        ) : state === 'theirs' ? (
          <>
            <Button onClick={joinGame} disabled={busy} className="h-[60px] rounded-[18px] text-2xl">
              {join.isPending ? '들어가는 중…' : '참가하기'}
            </Button>
            <Button variant="ghost" onClick={() => stop(`${partnerName}의 초대를 닫을까요?`)} disabled={busy} className="h-11 text-base">
              다음에 할래
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => navigate('/poker/play')} disabled={busy} className="h-[60px] rounded-[18px] text-2xl">
              게임으로 돌아가기
            </Button>
            <Button variant="ghost" onClick={() => stop('게임을 끝낼까요? 지금까지 마신 양은 오늘 기록에 남아요.')} disabled={busy} className="h-11 text-base">
              {end.isPending ? '끝내는 중…' : '게임 그만하기'}
            </Button>
          </>
        )}
      </div>

      <RulesSheet open={rulesOpen} onOpenChange={setRulesOpen} rules={rules} onChange={changeRules} locked={!!g} />
      <HowToSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </PokerScreen>
  )
}

function TopBar({ onBack, onHelp }: { onBack: () => void; onHelp: () => void }) {
  return (
    <div className="flex h-[52px] items-center justify-between">
      <RoundButton label="뒤로" onClick={onBack}>
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </RoundButton>
      <RoundButton label="게임 방법" onClick={onHelp}>
        ?
      </RoundButton>
    </div>
  )
}

// 곰과 토끼가 이마에 카드를 붙이고 술상 앞에 마주 앉은 그림 (왼쪽 = 나, 오른쪽 = 상대)
function LobbyScene({ me, partner }: { me: Profile; partner: Profile }) {
  return (
    <svg
      viewBox="0 0 350 270"
      className="mx-auto mt-2 w-full max-w-[350px]"
      role="img"
      aria-label={`${me.nickname}와(과) ${partner.nickname}가 이마에 카드를 붙이고 술상 앞에 마주 앉아 있다`}
    >
      <ellipse cx="175" cy="248" rx="168" ry="20" className="fill-partner" opacity="0.35" />
      <g transform="translate(-4 38) scale(0.86)">
        <MascotBody kind={mascotOf(me)} color={me.color} face="smile" card="back" />
      </g>
      <g transform="translate(182 38) scale(0.86)">
        <MascotBody kind={mascotOf(partner)} color={partner.color} face="happy" card={17} />
      </g>
      <g transform="translate(150 106)">
        <rect x="18" y="0" width="14" height="12" rx="3" className="fill-free-deep" />
        <path
          d="M17 12 H33 V26 Q46 34 46 52 V118 Q46 128 36 128 H14 Q4 128 4 118 V52 Q4 34 17 26 Z"
          className="fill-free stroke-ink"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="10" y="66" width="30" height="34" rx="6" className="fill-white" />
        <text x="25" y="89" textAnchor="middle" className="font-display fill-card-weak" fontSize="13">
          몽글
        </text>
        <rect x="11" y="38" width="5" height="22" rx="2.5" className="fill-white" opacity="0.6" />
      </g>
    </svg>
  )
}
