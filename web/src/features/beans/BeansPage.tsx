import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { DateButton } from '../../components/DateTimePicker'
import { PageHeader } from '../../components/PageHeader'
import { Button, Card, EmptyState, ErrorText, Spinner } from '../../components/ui'
import { celebrate, celebrateAt } from '../../lib/celebrate'
import { fmt, fmtTime, fromKey, todayKey } from '../../lib/dates'
import { toMessage } from '../../lib/supabase'
import { BeanTypeSheet } from './BeanTypeSheet'
import { JarPhysics } from './physics/JarPhysics'
import { JarViewSheet } from './JarViewSheet'
import { BeanCalendar } from './BeanCalendar'
import { BEAN_GOAL, stageOf, type BeanType } from './model'
import { useAddBean, useBeans, useBeanTypes, useDeleteBean, type Bean } from './queries'

const MAX_ACTIVE = 8
const FALLBACK: BeanType = { id: '', label: '기타', emoji: '💗', color: 'var(--color-line-deep)', sort_order: 0, archived: false }

// 콩 기록 (커플 공용). 항목을 직접 만들고, 누를 때마다 콩을 하나씩 넣는다. 콩이 쌓이면 식물이 자란다.
export function BeansPage() {
  const beans = useBeans()
  const types = useBeanTypes()
  const add = useAddBean()
  const del = useDeleteBean()
  const [day, setDay] = useState(todayKey())
  const [showDate, setShowDate] = useState(false)
  const [managing, setManaging] = useState(false)
  const [error, setError] = useState('')
  const [levelUp, setLevelUp] = useState('')
  const [jarView, setJarView] = useState<number | null>(null) // 지난 병 보기 (몇 번째 병인지, 0부터)
  const [calOpen, setCalOpen] = useState(false)

  const list = beans.data ?? []
  const allTypes = types.data ?? []
  const typeMap = useMemo(() => new Map(allTypes.map((t) => [t.id, t])), [allTypes])
  const active = allTypes.filter((t) => !t.archived)
  const total = list.length
  const stage = stageOf(total)

  // 단계가 바뀌면 잠깐 알려 준다
  useEffect(() => {
    if (!levelUp) return
    const t = window.setTimeout(() => setLevelUp(''), 3200)
    return () => window.clearTimeout(t)
  }, [levelUp])

  if (beans.isPending || types.isPending) {
    return (
      <>
        <PageHeader title="콩 기록" back />
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </>
    )
  }
  if (beans.isError || types.isError) {
    return (
      <>
        <PageHeader title="콩 기록" back />
        <div className="px-4 pt-4">
          <ErrorText>{toMessage(beans.error ?? types.error)}</ErrorText>
        </div>
      </>
    )
  }

  // 병 계산: 1~100개 = 1번째 병, 101~200개 = 2번째 병 ...
  const jarsDone = total > 0 ? Math.floor((total - 1) / BEAN_GOAL) : 0
  const filled = total - jarsDone * BEAN_GOAL
  const jarNo = jarsDone + 1
  const inJar = list.slice(0, filled).reverse()

  // 지난 병: 가득 찬 병들은 오래된 콩부터 100개씩 나눠 보관한다
  const chrono = [...list].reverse()
  const doneJars = Array.from({ length: jarsDone }, (_, k) => chrono.slice(k * BEAN_GOAL, (k + 1) * BEAN_GOAL))

  const thisMonth = todayKey().slice(0, 7)
  const monthCount = (id: string) => list.filter((b) => b.type_id === id && b.taken_on.startsWith(thisMonth)).length
  const todayCount = list.filter((b) => b.taken_on === todayKey()).length
  const typeOf = (b: Bean) => (b.type_id ? typeMap.get(b.type_id) : undefined) ?? FALLBACK

  const tap = async (t: BeanType, e: MouseEvent<HTMLButtonElement>) => {
    setError('')
    celebrateAt(e.currentTarget, 4, [t.emoji, '✨'])
    const next = total + 1
    if (next % BEAN_GOAL === 0) celebrate()
    const before = stageOf(total).index
    const after = stageOf(next)
    if (after.index > before) {
      setLevelUp(`${after.stage.emoji} ${after.stage.name}으로 자랐어요!`)
      celebrate()
    }
    try {
      await add.mutateAsync({ type_id: t.id, taken_on: day })
    } catch (err) {
      setError(toMessage(err))
    }
  }

  const undoLast = async () => {
    const last = list[0]
    if (!last || last.id.startsWith('tmp-')) return
    const t = typeOf(last)
    const when = `${fmt(fromKey(last.taken_on), 'M월 d일 (EEE)')} ${fmtTime(new Date(last.created_at))}`
    if (!window.confirm(`마지막 콩 하나를 뺄까요?\n\n${t.emoji} ${t.label} · ${when}\n\n뺀 콩은 다시 되돌릴 수 없어요.`)) return
    setError('')
    try {
      await del.mutateAsync(last.id)
    } catch (err) {
      setError(toMessage(err))
    }
  }

  const removeOne = async (b: Bean) => {
    if (!window.confirm(`${typeOf(b).label} 콩을 뺄까요?`)) return
    setError('')
    try {
      await del.mutateAsync(b.id)
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title="콩 기록"
        back
        right={
          <button type="button" onClick={() => setManaging(true)} className="font-display h-10 rounded-full border-2 border-line bg-surface px-3.5 text-[15px] active:scale-95">
            항목 관리
          </button>
        }
      />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        {/* 식물: 콩이 쌓이면 씨앗 → 새싹 → 나무 … 로 자란다 */}
        <Card className="flex flex-col items-center gap-2 p-5">
          <span className="animate-float text-7xl leading-none drop-shadow-sm" aria-hidden>
            {stage.stage.emoji}
          </span>
          <p className="font-display text-2xl">{stage.stage.name}</p>
          <p className="text-sm text-ink-soft">지금까지 콩 {total}개</p>
          <div className="mt-1 h-3.5 w-full overflow-hidden rounded-full border-2 border-line bg-bg" role="progressbar" aria-valuenow={Math.round(stage.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${stage.progress * 100}%` }} />
          </div>
          <p className="min-h-[1.25rem] text-sm text-ink-soft">
            {stage.next ? `다음은 ${stage.next.emoji} ${stage.next.name} · ${stage.left}개 남았어요` : '최고 단계예요 ✨'}
          </p>
          {levelUp && <p className="font-display animate-pop rounded-full bg-partner/40 px-4 py-1.5 text-base">{levelUp}</p>}
        </Card>

        {/* 병: 콩이 실제처럼 쌓이고 굴러간다 */}
        <Card className="flex flex-col items-center gap-2 p-5">
          <JarPhysics beans={inJar.map((b) => ({ id: b.id, color: typeOf(b).color }))} />
          <p className="font-display text-lg">
            {jarNo}번째 병 · {filled}/{BEAN_GOAL}
          </p>
          {filled === BEAN_GOAL && <p className="text-sm text-ink-soft">가득 찼어요! 🎉</p>}
        </Card>

        {/* 지난 병: 가득 찬 병은 여기 남는다 */}
        {doneJars.length > 0 && (
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="font-display text-lg">지난 병</h2>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {doneJars.map((jar, k) => (
                <button key={k} type="button" onClick={() => setJarView(k)} className="flex shrink-0 flex-col items-center gap-1.5 active:scale-95">
                  {/* 작은 병 모양: 안의 색은 항목별 콩 색 */}
                  <span className="relative block h-[96px] w-[78px]">
                    <span className="absolute top-0 left-1/2 h-[10px] w-[46px] -translate-x-1/2 rounded-full border-2 border-line-deep bg-partner/70" />
                    <span className="absolute top-[9px] left-1/2 h-[10px] w-[52px] -translate-x-1/2 bg-white/55" />
                    <span className="absolute top-[18px] right-0 bottom-0 left-0 flex flex-wrap-reverse content-start justify-center gap-[2px] overflow-hidden rounded-[20px] rounded-t-[30px] border-[3px] border-line-deep/70 bg-white/60 p-1.5">
                      {jar.map((b) => (
                        <span key={b.id} className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: typeOf(b).color }} />
                      ))}
                    </span>
                  </span>
                  <span className="font-display text-sm">{k + 1}번째 병</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* 날짜 + 항목 버튼 (여러 번 눌러도 된다) */}
        <Card className="flex flex-col gap-4 p-4">
          {/* 평소에는 오늘로 기록. 어제 일을 나중에 적을 때만 날짜를 고른다 */}
          {showDate ? (
            <div className="flex flex-col gap-1.5">
              <DateButton value={day} max={todayKey()} onChange={setDay} title="언제 있었던 일?" />
              <button type="button" onClick={() => { setDay(todayKey()); setShowDate(false) }} className="self-center text-sm text-ink-soft underline underline-offset-4">
                오늘로 돌아가기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowDate(true)} className="self-center text-sm text-ink-soft underline underline-offset-4">
              다른 날짜에 적기
            </button>
          )}

          {active.length === 0 ? (
            <EmptyState emoji="🫙" title="항목이 없어요">
              <Button variant="soft" onClick={() => setManaging(true)}>
                항목 만들기
              </Button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {active.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={(e) => tap(t, e)}
                  className="flex flex-col items-center gap-1 rounded-[22px] border-2 border-line bg-surface px-1.5 py-3 transition active:scale-95"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: t.color }} aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="max-w-full truncate font-display text-[15px]">{t.label}</span>
                  <span className="text-[11px] text-ink-soft">이번 달 {monthCount(t.id)}회</span>
                </button>
              ))}
              {active.length < MAX_ACTIVE && (
                <button
                  type="button"
                  onClick={() => setManaging(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded-[22px] border-2 border-dashed border-line-deep px-1.5 py-3 text-ink-soft active:scale-95"
                >
                  <Plus className="h-7 w-7" aria-hidden />
                  <span className="text-[13px]">항목 추가</span>
                </button>
              )}
            </div>
          )}

          <p className="text-center text-sm text-ink-soft">오늘 {todayCount}개</p>
          <ErrorText>{error}</ErrorText>
          <Button variant="ghost" onClick={undoLast} disabled={total === 0 || del.isPending}>
            마지막 콩 하나 빼기
          </Button>
        </Card>

        {/* 기록: 버튼을 누르면 달력이 펼쳐진다 */}
        <Card className="flex flex-col gap-3 p-4">
          <button
            type="button"
            onClick={() => setCalOpen((o) => !o)}
            aria-expanded={calOpen}
            className="font-display flex w-full items-center justify-between rounded-[18px] border-2 border-line bg-surface px-4 py-3 text-left active:scale-[0.98]"
          >
            <span className="text-lg">기록 달력</span>
            <ChevronDown className={`h-5 w-5 text-ink-soft transition ${calOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {calOpen && <BeanCalendar beans={list} typeOf={typeOf} onRemove={removeOne} />}
        </Card>
      </div>

      <BeanTypeSheet open={managing} onOpenChange={setManaging} types={allTypes} />
      {jarView !== null && doneJars[jarView] && (
        <JarViewSheet
          open
          onOpenChange={(o) => !o && setJarView(null)}
          no={jarView + 1}
          range={`${fmt(fromKey(doneJars[jarView][0].taken_on), 'yyyy.M.d')} ~ ${fmt(fromKey(doneJars[jarView][doneJars[jarView].length - 1].taken_on), 'yyyy.M.d')}`}
          beans={doneJars[jarView].map((b) => ({ id: b.id, type: typeOf(b) }))}
        />
      )}
    </>
  )
}
