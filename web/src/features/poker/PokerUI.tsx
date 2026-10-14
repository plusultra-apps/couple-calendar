import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button } from '../../components/ui'
import { BASE_OPTIONS, glassText, MAX_OPTIONS, WATER_OPTIONS, type Rules } from './model'

// 포커 화면 공용 틀: 가운데가 밝은 둥근 조명 배경 + 안전 영역
export function PokerScreen({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <div
      className={`relative flex min-h-full flex-col overflow-x-hidden bg-[radial-gradient(ellipse_120%_60%_at_50%_42%,var(--color-surface)_0%,var(--color-bg)_70%)] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+20px)] ${
        center ? 'items-center' : ''
      }`}
    >
      {children}
    </div>
  )
}

// 둥근 회색 아이콘 버튼 (뒤로 · ? · 메뉴)
export function RoundButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/8 text-xl text-ink active:scale-95"
      {...props}
    >
      {children}
    </button>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-display rounded-full bg-ink/8 px-3 py-1.5 text-sm ${className}`}>{children}</span>
}

// 다이 · 레이즈 · 콜 버튼 (두 줄: 큰 글 + 작은 설명)
export function BetButton({
  title,
  sub,
  look,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title: string; sub: string; look: 'fold' | 'raise' | 'call' }) {
  const style = {
    fold: 'border-2 border-line bg-surface text-ink [--shade:var(--color-line)]',
    raise: 'bg-partner text-ink [--shade:color-mix(in_srgb,var(--color-partner)_75%,black_10%)]',
    call: 'bg-accent-deep text-white [--shade:color-mix(in_srgb,var(--color-accent-deep)_75%,black_15%)]',
  }[look]
  return (
    <button
      type="button"
      className={`press-3d flex h-[68px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] transition disabled:opacity-45 ${style} ${className}`}
      {...props}
    >
      <span className={`font-display leading-none ${look === 'call' ? 'text-[22px]' : 'text-xl'}`}>{title}</span>
      <span className={`text-[11px] ${look === 'call' ? 'text-white/85' : 'text-ink-soft'}`}>{sub}</span>
    </button>
  )
}

function Chips({ value, options, unit, onPick, disabled }: { value: number; options: readonly number[]; unit: string; onPick: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex gap-2" role="radiogroup">
      {options.map((v) => {
        const on = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled && !on}
            onClick={() => onPick(v)}
            className={`font-display h-11 flex-1 rounded-[14px] text-base transition active:scale-95 disabled:opacity-40 ${
              on ? 'bg-ink text-surface' : 'bg-bg text-ink shadow-[inset_0_0_0_2px_var(--color-line)]'
            }`}
          >
            {glassText(v)}
            {unit}
          </button>
        )
      })}
    </div>
  )
}

// 오늘의 룰: 판돈·최대·물 한 잔 간격. 게임이 이미 열렸으면 보기만.
export function RulesSheet({
  open,
  onOpenChange,
  rules,
  onChange,
  locked,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rules: Rules
  onChange: (r: Rules) => void
  locked: boolean
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="오늘의 룰"
      footer={<Button onClick={() => onOpenChange(false)}>좋아요</Button>}
    >
      <div className="flex flex-col gap-4">
        {locked && <p className="text-sm text-ink-soft">게임이 열려 있어서 지금은 바꿀 수 없어요. 그만하고 새로 시작하면 바꿀 수 있어요.</p>}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-ink-soft">기본 판돈</span>
          <Chips value={rules.base} options={BASE_OPTIONS} unit="" disabled={locked} onPick={(base) => onChange({ ...rules, base })} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-ink-soft">최대 판돈</span>
          <Chips value={rules.max} options={MAX_OPTIONS} unit="" disabled={locked} onPick={(max) => onChange({ ...rules, max })} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-ink-soft">물 한 잔 타임</span>
          <Chips value={rules.water} options={WATER_OPTIONS} unit="마다" disabled={locked} onPick={(water) => onChange({ ...rules, water })} />
        </div>
        <p className="rounded-[14px] bg-bg px-3.5 py-3 text-[13px] leading-relaxed text-ink">
          덱 1~20 + 조커 · 20이나 조커 들고 다이하면 2배
          <br />
          아이템: 엿보기 1회 · 반잔 원샷권 1장
        </p>
      </div>
    </Sheet>
  )
}

// ? 버튼: 게임 방법
export function HowToSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const items: [string, string][] = [
    ['🃏 카드', '1~20 한 벌과 조커(제일 셈) 21장. 판마다 한 장씩 이마에 붙여요. 내 카드는 못 보고 상대 카드만 보여요.'],
    ['🍶 판돈', '기본 판돈으로 시작해요. 차례마다 레이즈(+¼잔) · 콜(바로 공개) · 다이(포기) 중 하나를 골라요.'],
    ['⚖️ 승부', '콜하면 카드를 공개해서 낮은 사람이 판돈만큼 마셔요. 다이하면 기본 판돈만 마시지만, 20이나 조커를 들고 다이하면 2배!'],
    ['👀 엿보기', '게임마다 한 번, 내 카드가 3·4·5 중 무엇의 배수인지 힌트를 받아요. 아무것도 아니면 "외톨이 숫자". 상대는 내가 엿본 것만 알아요.'],
    ['🥃 반잔 원샷권', '진 판에서 한 번 써서 벌칙을 반으로 줄여요(¼잔이면 면제). 3판 연속 지면 한 장 더 받아요.'],
    ['💧 물 한 잔 타임', '정한 양만큼 마실 때마다 물 한 잔 마시고 가요.'],
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="게임 방법" footer={<Button onClick={() => onOpenChange(false)}>알겠어요</Button>}>
      <ul className="flex flex-col gap-3">
        {items.map(([t, d]) => (
          <li key={t} className="rounded-2xl bg-bg px-4 py-3">
            <p className="font-display text-base">{t}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{d}</p>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
