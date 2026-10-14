import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { US_AVATAR, useCoupleCtx } from '../../app/couple'
import { fmt, fromKey, type DateKey } from '../../lib/dates'
import { celebrateAt } from '../../lib/celebrate'
import { toMessage } from '../../lib/supabase'
import type { CalItem } from '../calendar/items'
import { useDeleteEvent, useSaveEvent } from '../events/queries'
import { toEventInput, type QuickItem } from './model'
import { useQuickItems } from './queries'
import { QuickChips, TemplateSheet } from './QuickUI'

type StampTab = 'me' | 'us' | 'partner'
const STAMP_TAB_KEY = 'ourcal.stamp.tab'

// 도장 쟁반에서 마지막으로 본 탭 (휴대폰마다 기억)
function useStampTab() {
  const [tab, setTab] = useState<StampTab>(() => {
    try {
      const v = localStorage.getItem(STAMP_TAB_KEY)
      return v === 'us' || v === 'partner' ? v : 'me'
    } catch {
      return 'me'
    }
  })
  const update = (t: StampTab) => {
    try {
      localStorage.setItem(STAMP_TAB_KEY, t)
    } catch {
      /* 저장 실패는 무시 */
    }
    setTab(t)
  }
  return [tab, update] as const
}

// 달력 도장 찍기: 도장을 고르고 날짜를 누르면 그날 일정이 생기고, 다시 누르면 지워진다
export function useStamp(items: CalItem[]) {
  const [active, setActive] = useState(false)
  const [stamp, setStamp] = useState<QuickItem | null>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const save = useSaveEvent()
  const del = useDeleteEvent()
  const timer = useRef<number | undefined>(undefined)

  const say = (text: string) => {
    window.clearTimeout(timer.current)
    setToast({ text, id: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), 1800)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function stampDay(key: DateKey, el: HTMLElement) {
    if (!stamp) return
    const label = fmt(fromKey(key), 'M월 d일')
    // 같은 도장(제목·주인)이 그날 이미 찍혀 있으면 지운다. 반복 일정은 건드리지 않는다.
    const existing = items.find(
      (i) =>
        i.kind === 'event' &&
        i.startKey === key &&
        !i.event!.rrule &&
        !i.event!.is_private &&
        i.event!.title === stamp.title &&
        i.event!.owner_id === stamp.ownerId,
    )
    try {
      if (existing) {
        await del.mutateAsync(existing.event!.id)
        say(`${label} ${stamp.title} 지웠어요`)
      } else {
        celebrateAt(el, 7, [stamp.emoji, '✨', '💗'])
        await save.mutateAsync(toEventInput(stamp, key))
        say(`${label} ${stamp.title} 찍었어요`)
      }
    } catch (err) {
      say(toMessage(err))
    }
  }

  const close = () => {
    setActive(false)
    setStamp(null)
  }

  return { active, open: () => setActive(true), close, stamp, setStamp, stampDay, toast }
}

export function StampTray({
  stamp,
  onPick,
  onClose,
  toast,
}: {
  stamp: QuickItem | null
  onPick: (item: QuickItem | null) => void
  onClose: () => void
  toast: { text: string; id: number } | null
}) {
  const quick = useQuickItems()
  const [manage, setManage] = useState(false)
  const { me, partner } = useCoupleCtx()
  const [tab, setTab] = useStampTab()
  // 누구 도장인지: 내 것 / 우리(함께) / 상대
  const tabs: { key: StampTab; label: string; owner: string | null }[] = [
    { key: 'me', label: `${me.avatar} 내 도장`, owner: me.id },
    { key: 'us', label: `${US_AVATAR} 우리 도장`, owner: null },
    ...(partner ? [{ key: 'partner' as const, label: `${partner.avatar} ${partner.nickname}`, owner: partner.id }] : []),
  ]
  const current = tabs.find((t) => t.key === tab) ?? tabs[0]
  const shown = quick.items.filter((i) => i.ownerId === current.owner)

  return (
    <>
      {toast && (
        <div
          key={toast.id}
          className="font-display animate-pop fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 mx-auto w-fit rounded-full border-2 border-line bg-surface px-4 py-2 text-base shadow-[0_4px_0_var(--color-line)]"
          role="status"
        >
          {toast.text}
        </div>
      )}
      <div className="animate-pop fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.6rem)] z-30 mx-auto max-w-md px-3">
        <div className="rounded-[28px] border-2 border-partner bg-surface/95 px-4 pt-3 pb-1 shadow-[0_5px_0_color-mix(in_srgb,var(--color-partner)_60%,white)] backdrop-blur">
          <div className="flex items-center gap-2">
            <p className="font-display flex-1 text-[15px]">
              {stamp ? (
                <>
                  <span className="text-xl">{stamp.emoji}</span> 날짜를 톡톡 눌러 찍어요
                  <span className="ml-1 text-xs text-ink-soft">(다시 누르면 지워져요)</span>
                </>
              ) : (
                '찍을 도장을 골라요'
              )}
            </p>
            <button
              type="button"
              aria-label="도장 그만 찍기"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bg active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex gap-1.5" role="tablist" aria-label="누구 도장">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={current.key === t.key}
                onClick={() => setTab(t.key)}
                className={`font-display h-8 min-w-0 truncate rounded-full border-2 px-3 text-[13px] transition active:scale-95 ${
                  current.key === t.key ? 'border-accent-deep bg-accent text-white' : 'border-line bg-surface text-ink-soft'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {shown.length === 0 && !quick.isLoading && (
            <p className="px-1 pt-2 text-xs text-ink-soft">여기엔 아직 도장이 없어요. 끝의 '도장 관리'에서 만들 수 있어요</p>
          )}
          <QuickChips
            items={shown}
            activeKey={stamp?.key}
            onPick={(item) => onPick(stamp?.key === item.key ? null : item)}
            onManage={() => setManage(true)}
          />
        </div>
      </div>
      <TemplateSheet open={manage} onOpenChange={setManage} />
    </>
  )
}
