import { Briefcase, EyeOff, Heart, Lock, MapPin, Repeat } from 'lucide-react'
import { fmt, fmtTime, type DateKey } from '../../lib/dates'
import type { CalItem } from './items'

// 일정 한 줄 요약 시간: '종일', '오후 3:00 – 오후 4:00', '10.2 – 10.4'
export function timeLabel(item: CalItem, day?: DateKey): string {
  if (item.kind === 'anniv') return '기념일'
  if (item.startKey !== item.endKey) {
    const range = `${fmt(item.start, 'M.d')} – ${fmt(item.end, 'M.d')}`
    if (item.allDay) return range
    if (day === item.startKey) return `${fmtTime(item.start)}부터 · ${range}`
    if (day === item.endKey) return `${fmtTime(item.end)}까지 · ${range}`
    return range
  }
  if (item.allDay) return '종일'
  // 끝 시각 미정(길이 0)은 시작 시각만 보여 준다
  if (item.start.getTime() === item.end.getTime()) return fmtTime(item.start)
  return `${fmtTime(item.start)} – ${fmtTime(item.end)}`
}

export function ItemRow({
  item,
  day,
  ownerName,
  onClick,
}: {
  item: CalItem
  day?: DateKey
  ownerName?: string
  onClick?: () => void
}) {
  const e = item.event
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="mb-2 flex w-full items-center gap-3 rounded-[22px] border-2 px-3 py-2.5 text-left transition active:scale-[0.98] disabled:active:scale-100"
      style={{
        backgroundColor: `color-mix(in srgb, ${item.color} 16%, white)`,
        borderColor: `color-mix(in srgb, ${item.color} 45%, white)`,
      }}
    >
      {/* 동그라미: 누구 일정인지 (주인 캐릭터 · 우리 일정은 하트 · 기념일은 기념일 표시) */}
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{ backgroundColor: item.color }}
        aria-hidden
      >
        {item.emoji ??
          (item.kind === 'busy' ? (
            <Briefcase className="h-5 w-5 text-ink-soft" />
          ) : (
            (item.avatar ?? <Heart className="h-5 w-5 fill-white text-white" />)
          ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-display flex items-center gap-1.5 text-[17px]">
          {item.masked && <Lock className="h-3.5 w-3.5 shrink-0 text-ink-soft" />}
          <span className="truncate">{item.title}</span>
          {e?.rrule && <Repeat className="h-3.5 w-3.5 shrink-0 text-ink-soft" />}
        </span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          {item.hidden && (
            <span className="flex items-center gap-0.5 font-bold text-accent-deep">
              <EyeOff className="h-3 w-3" /> 나만
            </span>
          )}
          <span>{timeLabel(item, day)}</span>
          {ownerName && <span>· {ownerName}</span>}
          {e?.location && !item.masked && (
            <span className="flex min-w-0 items-center gap-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{e.location}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
