import { useQueryClient } from '@tanstack/react-query'
import { Droplet, Eye, Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useCoupleCtx } from '../../app/couple'
import { useGoBack } from '../../app/navigation'
import { PageSpinner } from '../../app/Layout'
import { Sheet } from '../../components/Sheet'
import { Button, EmptyState, ErrorText, Spinner } from '../../components/ui'
import { celebrate } from '../../lib/celebrate'
import { useSignedUrls } from '../../lib/photos'
import { toMessage } from '../../lib/supabase'
import type { PokerGameWithPlayers, PokerPlayer, PokerRound, Profile } from '../../types/database'
import { DrunkMeter, Glass } from './Glass'
import {
  actionBubble,
  crossedWater,
  drunkStage,
  glassesFor,
  glassText,
  halfOf,
  hintText,
  josa,
  meter,
  rulesSummary,
} from './model'
import { PlayingCard } from './PlayingCard'
import { PokerAvatar, PokerMascot } from './PokerMascot'
import { BetButton, Pill, PokerScreen, RoundButton } from './PokerUI'
import {
  pokerKeys,
  usePokerAct,
  usePokerEnd,
  usePokerGame,
  usePokerHands,
  usePokerNextRound,
  usePokerPeek,
  usePokerPeekHint,
  usePokerRound,
  usePokerRoundById,
  usePokerUseHalf,
} from './queries'

// 화면 공용 정보
type Ctx = {
  game: PokerGameWithPlayers
  userId: string
  me: Profile
  partner: Profile
  mePlayer: PokerPlayer | undefined
  partnerPlayer: PokerPlayer | undefined
  urls: Record<string, string> | undefined
}

const nameOf = (p: Profile, fallback: string) => p.nickname || fallback

// /poker/play — 게임 (최신 판의 status 로 베팅 화면 ↔ 결과 화면)
export function PokerGamePage() {
  const { userId, me, partner } = useCoupleCtx()
  const goBack = useGoBack()
  const game = usePokerGame()
  const urls = useSignedUrls([me.photo_path, partner?.photo_path])

  if (game.isLoading) return <PageSpinner />
  if (game.error)
    return (
      <PokerScreen center>
        <div className="my-auto flex flex-col items-center gap-3">
          <ErrorText>{toMessage(game.error)}</ErrorText>
          <Button variant="soft" onClick={() => game.refetch()} className="w-48">
            다시 불러오기
          </Button>
        </div>
      </PokerScreen>
    )

  const g = game.data
  if (g?.status === 'waiting') return <Navigate to="/poker" replace />
  if (!g || !partner)
    return (
      <PokerScreen center>
        <div className="my-auto flex w-full flex-col items-center">
          <EmptyState emoji="🃏" title="진행 중인 게임이 없어요">
            게임이 끝났거나 오래 쉬어서 닫혔어요. 로비에서 새로 시작해요.
          </EmptyState>
          <Button onClick={() => goBack('/poker')} className="max-w-xs">
            로비로 가기
          </Button>
        </div>
      </PokerScreen>
    )

  const ctx: Ctx = {
    game: g,
    userId,
    me,
    partner,
    mePlayer: g.poker_players.find((p) => p.user_id === userId),
    partnerPlayer: g.poker_players.find((p) => p.user_id === partner.id),
    urls: urls.data,
  }
  return <GameTable key={g.id} ctx={ctx} />
}

function GameTable({ ctx }: { ctx: Ctx }) {
  const { game, userId } = ctx
  const latest = usePokerRound(game.id)
  const next = usePokerNextRound()
  const qc = useQueryClient()
  const [error, setError] = useState('')

  // 결과를 보는 동안 상대가 '다음 판'을 눌러도 내가 넘어가기 전까지 그 결과를 붙잡아 둔다 (반잔권 쓸 시간)
  // 판 객체 자체를 들고 있어야 상대가 넘어간 순간 화면이 스피너로 깜빡이거나 결과 화면이 다시 마운트(축하 재생)되지 않는다.
  const [hold, setHold] = useState<PokerRound | null>(null)
  const holdId = hold?.id ?? null
  const latestRound = latest.data ?? null
  // (렌더 중 상태 맞추기: 끝난 판이 처음 보이면 붙잡고, 같은 판이 갱신되면(반잔권 등) 따라간다)
  if (latestRound?.status === 'done' && (hold === null || (hold.id === latestRound.id && hold !== latestRound))) setHold(latestRound)
  const held = usePokerRoundById(holdId && holdId !== latestRound?.id ? holdId : null)

  const newerStarted = !!holdId && !!latestRound && latestRound.id !== holdId
  const round = hold ? (latestRound?.id === hold.id ? latestRound : (held.data ?? hold)) : latestRound

  // 실시간 보조: 내가 누를 차례가 아닐 때는 몇 초마다 다시 확인 (화면이 보일 때만)
  const waiting = !(latestRound?.status === 'betting' && latestRound.turn_user === userId)
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') qc.invalidateQueries({ queryKey: pokerKeys.all })
    }, 6000)
    return () => clearInterval(t)
  }, [waiting, qc])

  const deal = async () => {
    setError('')
    try {
      if (!newerStarted) await next.mutateAsync(game.id)
      setHold(null)
    } catch (e) {
      setError(toMessage(e))
    }
  }

  if (latest.isLoading) return <PageSpinner />
  if (latest.error)
    return (
      <PokerScreen center>
        <div className="my-auto flex flex-col items-center gap-3">
          <ErrorText>{toMessage(latest.error)}</ErrorText>
          <Button variant="soft" onClick={() => latest.refetch()} className="w-48">
            다시 불러오기
          </Button>
        </div>
      </PokerScreen>
    )

  if (!round)
    return (
      <PokerScreen center>
        <div className="my-auto flex w-full flex-col items-center gap-3">
          <EmptyState emoji="🃏" title="카드를 나누는 중이에요">
            잠시 기다려도 그대로면 아래 버튼을 눌러 주세요.
          </EmptyState>
          <ErrorText>{error}</ErrorText>
          <Button onClick={deal} disabled={next.isPending} className="max-w-xs">
            {next.isPending ? '나누는 중…' : '카드 받기'}
          </Button>
        </div>
      </PokerScreen>
    )

  if (round.status === 'done')
    return <ResultView ctx={ctx} round={round} onNext={deal} nextPending={next.isPending} newerStarted={newerStarted} error={error} />
  return <BettingView key={round.id} ctx={ctx} round={round} myTurn={round.turn_user === userId} />
}

// ── 베팅 ──

function BettingView({ ctx, round, myTurn }: { ctx: Ctx; round: PokerRound; myTurn: boolean }) {
  const { game, userId, me, partner, mePlayer, partnerPlayer, urls } = ctx
  const goBack = useGoBack()
  const hands = usePokerHands(round.id)
  const hint = usePokerPeekHint(round.id)
  const act = usePokerAct()
  const peek = usePokerPeek()
  const end = usePokerEnd()
  const [foldOpen, setFoldOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tip, setTip] = useState('')
  const [error, setError] = useState('')

  const partnerName = nameOf(partner, '상대')
  const oppCard = hands.data?.find((h) => h.user_id === partner.id)?.card
  const iPeeked = round.peeked_by.includes(userId)
  const theyPeeked = round.peeked_by.includes(partner.id)
  const peekLeft = mePlayer?.peek_left ?? 0
  const halfLeft = mePlayer?.half_left ?? 0
  const canPeek = peekLeft > 0 && !iPeeked
  const atMax = round.pot_q >= game.max_q
  const busy = act.isPending || peek.isPending
  const bubble =
    round.last_actor === partner.id ? actionBubble(round.last_action) : myTurn ? '떨리지? 히히' : '흐음… 고민 중'

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      return true
    } catch (e) {
      setError(toMessage(e))
      return false
    }
  }
  const doAct = (action: 'raise' | 'call' | 'fold') => run(() => act.mutateAsync({ roundId: round.id, action }))

  // 반잔권 안내는 잠깐만
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(''), 2500)
    return () => clearTimeout(t)
  }, [tip])

  return (
    <PokerScreen>
      {/* 상단: 상대 정보 · 라운드 · 메뉴 */}
      <div className="flex h-[52px] items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <PokerAvatar profile={partner} url={partner.photo_path ? urls?.[partner.photo_path] : undefined} size={44} />
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="font-display truncate text-[17px] leading-none">{partnerName}</span>
            <DrunkMeter fills={meter(partnerPlayer?.drunk_q ?? 0)} color={partner.color} text={glassText(partnerPlayer?.drunk_q ?? 0)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill>{round.round_no}라운드</Pill>
          <RoundButton label="메뉴" onClick={() => setMenuOpen(true)}>
            <Menu className="h-5 w-5" strokeWidth={2.4} />
          </RoundButton>
        </div>
      </div>

      {/* 상대 몽글이 + 이마 카드 */}
      <div className="relative mt-1 flex h-[min(262px,32dvh)] justify-center">
        {hands.isLoading ? (
          <div className="flex items-center">
            <Spinner />
          </div>
        ) : (
          <PokerMascot
            profile={partner}
            face="smug"
            card={oppCard ?? null}
            className="h-full w-auto"
            label={oppCard ? `${partnerName}, 이마에 ${oppCard === 21 ? '조커' : oppCard} 카드` : partnerName}
          />
        )}
        {bubble && (
          <div
            key={`${round.last_action}-${round.pot_q}-${myTurn}`}
            className="font-display animate-pop absolute top-[30px] right-2 max-w-[40%] rounded-[14px_14px_14px_4px] bg-ink px-3 py-2 text-sm text-white"
          >
            {bubble}
          </div>
        )}
        {theyPeeked && (
          <span className="absolute top-2 left-1 flex items-center gap-1 rounded-full bg-free/40 px-2.5 py-1 text-xs font-bold text-ink">
            <Eye className="h-3.5 w-3.5 text-card-weak" aria-hidden /> {partnerName} 엿봤어요
          </span>
        )}
        {hands.error && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <ErrorText>{toMessage(hands.error)}</ErrorText>
          </div>
        )}
      </div>

      {/* 테이블: 판돈 */}
      <div className="relative -mx-1 mt-1.5 flex h-[150px] shrink-0 items-center justify-center gap-[18px] rounded-full bg-partner/30 shadow-[inset_0_0_0_6px_var(--color-bg),inset_0_0_0_8px_var(--color-line-deep)]">
        <div className="flex gap-0.5">
          {glassesFor(round.pot_q).map((f, i) => (
            <Glass key={i} fill={f} width={round.pot_q > 4 ? 52 : 64} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-ink-soft">판돈</span>
          <span key={round.pot_q} className="font-display animate-pop text-[38px] leading-none">
            {glassText(round.pot_q)}
          </span>
          <div className="flex gap-1" aria-label={`최대 ${glassText(game.max_q)}`}>
            {Array.from({ length: game.max_q }, (_, j) => (
              <span key={j} className={`block h-1.5 w-3.5 rounded-[3px] ${j < round.pot_q ? 'bg-accent-deep' : 'bg-line-deep'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* 나: 뒤집힌 내 카드 · 힌트 · 아이템 */}
      <div className="mt-[18px] flex items-center gap-3.5 px-1">
        <PlayingCard value={null} size="md" rotate={-5} label="내 카드 (판이 끝나면 보여요)" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-lg leading-tight">내 카드</span>
          <span className={`text-[13px] ${hint.data ? 'font-bold text-card-weak' : 'text-ink-soft'}`}>
            {hint.data ? `엿보기: ${hintText(hint.data)}` : `${partnerName} 표정을 잘 봐`}
          </span>
          <DrunkMeter fills={meter(mePlayer?.drunk_q ?? 0)} color={me.color} text={glassText(mePlayer?.drunk_q ?? 0)} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(() => peek.mutateAsync(round.id))}
            disabled={!canPeek || busy}
            aria-label={iPeeked ? '이번 판은 엿봤어요' : `엿보기 ${peekLeft}번 남음`}
            className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95 ${
              canPeek ? 'bg-free/35' : 'bg-line/60 opacity-50'
            }`}
          >
            {peek.isPending ? <Spinner className="h-5 w-5" /> : <Eye className="h-[22px] w-[22px] text-card-weak" strokeWidth={2.2} aria-hidden />}
            <Badge n={peekLeft} />
          </button>
          <button
            type="button"
            onClick={() => setTip(halfLeft > 0 ? '반잔 원샷권은 지고 나서 결과 화면에서 써요' : '반잔 원샷권을 다 썼어요. 3판 연속 지면 한 장 더!')}
            aria-label={`반잔 원샷권 ${halfLeft}장`}
            className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-us/30 active:scale-95 ${halfLeft > 0 ? '' : 'opacity-50'}`}
          >
            <HalfIcon />
            <Badge n={halfLeft} />
          </button>
        </div>
      </div>
      {tip && <p className="animate-pop mt-2 text-center text-xs text-ink-soft">{tip}</p>}

      {/* 차례 + 버튼 */}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <p className={`font-display text-center text-base ${myTurn ? 'text-accent-deep' : 'text-ink-soft'}`} aria-live="polite">
          {myTurn ? (
            '내 차례예요!'
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-anniv" aria-hidden />
              {partnerName} 차례예요
            </span>
          )}
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <BetButton look="fold" title="다이" sub={`${glassText(game.base_q)} 마시기`} className="flex-1" disabled={!myTurn || busy} onClick={() => setFoldOpen(true)} />
          <BetButton
            look="raise"
            title={atMax ? '최대' : '레이즈'}
            sub={atMax ? '더는 못 올려요' : '+¼잔'}
            className="flex-1"
            disabled={!myTurn || busy || atMax}
            onClick={() => doAct('raise')}
          />
          <BetButton look="call" title="콜" sub="카드 공개" className="flex-[1.35]" disabled={!myTurn || busy} onClick={() => doAct('call')} />
        </div>
      </div>

      {/* 다이 확인 */}
      <Sheet
        open={foldOpen}
        onOpenChange={setFoldOpen}
        title="다이할까요?"
        footer={
          <div className="flex flex-col gap-2">
            <Button
              onClick={async () => {
                if (await doAct('fold')) setFoldOpen(false)
              }}
              disabled={busy}
            >
              {act.isPending ? '다이하는 중…' : '다이할게요'}
            </Button>
            <Button variant="ghost" onClick={() => setFoldOpen(false)}>
              다시 생각할래
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-2.5 pb-2 text-center">
          <Glass fill={Math.min(1, game.base_q / 4)} width={72} line ticks={false} label={`${glassText(game.base_q)} 선`} />
          <p className="font-display text-[26px]">다이! {glassText(game.base_q)}</p>
          <p className="text-sm text-ink-soft">
            빨간 선까지만 따르세요.
            <br />단, 내 카드가 20이나 조커였다면 2배({glassText(game.base_q * 2)})예요.
          </p>
          <ErrorText>{error}</ErrorText>
        </div>
      </Sheet>

      {/* 메뉴 */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="게임 메뉴">
        <div className="flex flex-col gap-3 pb-2">
          <p className="rounded-2xl bg-bg px-4 py-3 text-sm">
            <span className="font-display">오늘의 룰</span>
            <br />
            <span className="text-ink-soft">{rulesSummary({ base: game.base_q, max: game.max_q, water: game.water_q })}</span>
          </p>
          <Button variant="soft" onClick={() => goBack('/poker')}>
            잠깐 로비로
          </Button>
          <Button
            variant="danger"
            disabled={end.isPending}
            onClick={() =>
              window.confirm('게임을 끝낼까요? 지금 판은 무효가 돼요.') &&
              run(async () => {
                await end.mutateAsync(game.id)
                goBack('/poker')
              })
            }
          >
            {end.isPending ? '끝내는 중…' : '게임 그만하기'}
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </Sheet>
    </PokerScreen>
  )
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -top-[3px] -right-[3px] h-[18px] min-w-[18px] rounded-full bg-ink px-1 text-center text-[11px] leading-[18px] font-bold text-white">
      {n}
    </span>
  )
}

function HalfIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 70) / 60} viewBox="0 0 60 70" aria-hidden>
      <path d="M10.5 37 H49.5 L48 66 H12 Z" className="fill-us" />
      <path d="M6 4 H54 L48 66 H12 Z" fill="none" className="stroke-ink" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}

// ── 결과 ──

function ResultView({
  ctx,
  round,
  onNext,
  nextPending,
  newerStarted,
  error: nextError,
}: {
  ctx: Ctx
  round: PokerRound
  onNext: () => void
  nextPending: boolean
  newerStarted: boolean
  error: string
}) {
  const { game, userId, me, partner, mePlayer, partnerPlayer, urls } = ctx
  const goBack = useGoBack()
  const hands = usePokerHands(round.id)
  const half = usePokerUseHalf()
  const end = usePokerEnd()
  const [error, setError] = useState('')

  const myCard = hands.data?.find((h) => h.user_id === userId)?.card ?? null
  const oppCard = hands.data?.find((h) => h.user_id === partner.id)?.card ?? null
  const iWon = round.winner_id === userId
  const iLost = round.loser_id === userId
  const loserPlayer = iLost ? mePlayer : partnerPlayer
  const loserCard = iLost ? myCard : oppCard
  const drink = round.drink_q ?? 0
  const loserDrunk = loserPlayer?.drunk_q ?? 0
  const water = crossedWater(loserDrunk, drink, game.water_q)
  const doubled = round.result === 'fold' && !round.half_used && loserCard !== null && loserCard >= 20
  const canHalf = iLost && (mePlayer?.half_left ?? 0) > 0 && !round.half_used && drink > 0
  const loserName = iLost ? '나' : nameOf(partner, '상대')

  // 이기면 퐁! (판마다 한 번)
  const cheered = useRef<string | null>(null)
  useEffect(() => {
    if (iWon && cheered.current !== round.id) {
      cheered.current = round.id
      celebrate(undefined, 16, ['🎉', '✨', '🍀', '💖'])
    }
  }, [iWon, round.id])

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(toMessage(e))
    }
  }

  const headline =
    drink > 0 ? `${iLost ? '내가' : josa(loserName, '이', '가')} ${glassText(drink)} 마셔요` : `${iLost ? '나는' : josa(loserName, '은', '는')} 이번 판 면제!`
  const sub = round.half_used
    ? drink > 0
      ? `반잔권으로 반만! 빨간 선까지 ${glassText(drink)}`
      : '반잔권 덕분에 한 모금도 안 마셔요'
    : round.result === 'fold'
      ? `${iLost ? '내가' : josa(loserName, '이', '가')} 다이했어요${doubled ? ' · 20·조커 다이는 2배!' : ''}`
      : `빨간 선까지 따르면 딱 ${glassText(drink)}`
  const glasses = glassesFor(drink)

  return (
    <PokerScreen center>
      {/* 꽃가루 */}
      <svg viewBox="0 0 390 160" aria-hidden className="pointer-events-none absolute top-10 left-0 w-full max-w-[390px]">
        <rect x="236" y="20" width="9" height="15" rx="3" className="fill-anniv" transform="rotate(-20 240 27)" />
        <rect x="330" y="40" width="9" height="15" rx="3" className="fill-me" transform="rotate(25 334 47)" />
        <circle cx="290" cy="14" r="5" className="fill-accent" />
        <circle cx="352" cy="110" r="4" className="fill-us" />
        <rect x="214" y="96" width="8" height="13" rx="3" className="fill-free" transform="rotate(30 218 102)" />
      </svg>

      <Pill className="relative mt-3">{round.round_no}라운드 결과</Pill>

      {/* 두 카드 공개 (왼쪽 나, 오른쪽 상대) */}
      <div className="relative mt-6 flex items-start justify-center gap-7">
        {[
          { p: me, card: myCard, won: iWon, name: nameOf(me, '나') },
          { p: partner, card: oppCard, won: !iWon, name: nameOf(partner, '상대') },
        ].map(({ p, card, won, name }, i) => (
          <div key={p.id} className="flex flex-col items-center gap-2.5">
            {hands.isLoading ? (
              <div className="flex h-[156px] w-[112px] items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <PlayingCard value={card} rotate={i === 0 ? -4 : 4} winner={won} dim={!won} />
            )}
            <PokerAvatar profile={p} url={p.photo_path ? urls?.[p.photo_path] : undefined} size={60} face={won ? 'win' : 'dizzy'} />
            <span className="font-display text-base">{name}</span>
          </div>
        ))}
      </div>
      {hands.error && <ErrorText>{toMessage(hands.error)}</ErrorText>}

      <h1 className="relative mt-6 text-center text-[32px] leading-tight">{headline}</h1>
      <p className="relative mt-1.5 text-center text-sm text-ink-soft">{sub}</p>

      {drink > 0 && (
        <div className="relative mt-4 flex items-end gap-1">
          {glasses.map((f, i) => (
            <Glass
              key={i}
              fill={f}
              width={glasses.length > 1 ? 80 : 110}
              line={i === glasses.length - 1}
              ticks={false}
              label={i === glasses.length - 1 ? `소주잔에 ${Math.round(f * 100)}퍼센트 선` : '가득 찬 소주잔'}
            />
          ))}
        </div>
      )}

      <div className="relative mt-4 flex items-center gap-2 rounded-2xl bg-free/30 px-3.5 py-2.5">
        <Droplet className="h-5 w-5 fill-soju text-card-weak" strokeWidth={2} aria-hidden />
        <span className="text-[13px] font-bold text-ink">
          {water
            ? `${loserName} 오늘 ${glassText(loserDrunk)} · 물 한 잔 마시고 가요`
            : `${loserName} 오늘 ${glassText(loserDrunk)} · ${drunkStage(loserDrunk)}`}
        </span>
      </div>

      <div className="relative mt-auto flex w-full flex-col gap-2 pt-6">
        {canHalf && (
          <Button variant="soft" onClick={() => run(() => half.mutateAsync(round.id))} disabled={half.isPending}>
            <span className="flex items-center justify-center gap-2">
              <HalfIcon size={18} />
              {half.isPending
                ? '쓰는 중…'
                : `반잔권 쓰기 · ${halfOf(drink) === 0 ? '면제' : glassText(halfOf(drink))} (${mePlayer?.half_left ?? 0}장)`}
            </span>
          </Button>
        )}
        {round.half_used && <p className="text-center text-xs font-bold text-ink-soft">🥃 반잔 원샷권을 썼어요</p>}
        {newerStarted && <p className="text-center text-xs text-ink-soft">{nameOf(partner, '상대')}가 다음 판을 시작했어요</p>}
        <ErrorText>{error || nextError}</ErrorText>
        <Button onClick={onNext} disabled={nextPending || end.isPending} className="h-[60px] rounded-[18px] text-2xl">
          {nextPending ? '카드 나누는 중…' : newerStarted ? '다음 판으로' : '다음 판'}
        </Button>
        <Button
          variant="ghost"
          className="h-11 text-base"
          disabled={end.isPending}
          onClick={() =>
            window.confirm('오늘은 여기까지 할까요?') &&
            run(async () => {
              await end.mutateAsync(game.id)
              goBack('/poker')
            })
          }
        >
          {end.isPending ? '끝내는 중…' : '오늘은 그만할래'}
        </Button>
      </div>
    </PokerScreen>
  )
}
