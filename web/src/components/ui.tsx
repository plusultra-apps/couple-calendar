import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

// 입체 버튼: 아래 그림자(--shade)가 있고 누르면 쏙 들어간다
export function Button({
  variant = 'primary',
  className = '',
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  const look = {
    primary: 'press-3d bg-accent text-white [--shade:var(--color-accent-deep)]',
    soft: 'press-3d border-2 border-line bg-surface text-ink',
    ghost: 'bg-transparent text-ink-soft active:bg-line/60',
    danger: 'press-3d border-2 border-holiday/30 bg-surface text-holiday [--shade:color-mix(in_srgb,var(--color-holiday)_35%,white)]',
  }[variant]
  return (
    <button
      type="button"
      className={`font-display h-13 w-full rounded-full px-5 text-lg transition disabled:opacity-50 ${look} ${className}`}
      style={style}
      {...props}
    />
  )
}

const inputLook =
  'rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none transition focus:border-accent placeholder:text-ink-soft/60'

export function Field({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-sm font-bold text-ink-soft">{label}</span>
      <input className={className ?? `h-12 ${inputLook}`} {...props} />
    </label>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-12 ${inputLook} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`min-h-24 py-3 ${inputLook} ${className}`} {...props} />
}

// 통통한 카드: 두꺼운 테두리 + 아래 그림자
export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section
      className={`rounded-[28px] border-2 border-line bg-surface p-5 shadow-[0_5px_0_var(--color-line)] ${className}`}
      style={style}
    >
      {children}
    </section>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="animate-pop px-1 text-sm font-bold text-holiday">{children}</p>
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-50"
    >
      <span className="flex flex-col">
        <span className="font-bold">{label}</span>
        {description && <span className="text-xs text-ink-soft">{description}</span>}
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors ${
          checked ? 'border-accent-deep bg-accent' : 'border-line-deep bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            checked ? 'left-[26px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

// 가로 선택 버튼 묶음 (말랑한 칩)
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode; color?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const active = o.value === value
        const color = o.color ?? 'var(--color-partner)'
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`font-display press-3d flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border-2 text-base transition ${
              active ? 'animate-pop text-ink' : 'border-line bg-surface text-ink-soft'
            }`}
            style={
              active
                ? ({
                    backgroundColor: color,
                    borderColor: `color-mix(in srgb, ${color} 70%, black 8%)`,
                    '--shade': `color-mix(in srgb, ${color} 70%, black 12%)`,
                  } as CSSProperties)
                : undefined
            }
          >
            {o.color && !active && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: o.color }} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="animate-float text-5xl drop-shadow-sm">{emoji}</span>
      <p className="font-display text-xl">{title}</p>
      {children && <div className="text-sm text-ink-soft">{children}</div>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-line border-t-accent ${className}`}
      role="status"
      aria-label="불러오는 중"
    />
  )
}
