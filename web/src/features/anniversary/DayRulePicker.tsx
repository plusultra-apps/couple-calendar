import { X } from 'lucide-react'
import { useState } from 'react'
import { Segmented } from '../../components/ui'
import { DAY_MARK_PRESETS, dayLabel, type DayRule } from '../../lib/anniversary'

// N일째 챙기는 방식 고르기: 주기 + 특별한 날
export function DayRulePicker({ value, onChange }: { value: DayRule; onChange: (v: DayRule) => void }) {
  const [custom, setCustom] = useState('')
  const covered = (n: number) => !!value.every && n % value.every === 0
  const toggle = (n: number) =>
    onChange({
      ...value,
      marks: value.marks.includes(n) ? value.marks.filter((m) => m !== n) : [...value.marks, n].sort((a, b) => a - b),
    })
  const addCustom = () => {
    const n = Number(custom)
    if (Number.isInteger(n) && n > 0 && n < 100000 && !value.marks.includes(n) && value.marks.length < 20) {
      onChange({ ...value, marks: [...value.marks, n].sort((a, b) => a - b) })
    }
    setCustom('')
  }
  const extra = value.marks.filter((m) => !DAY_MARK_PRESETS.includes(m))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">얼마마다 챙길까요?</span>
        <Segmented
          value={String(value.every ?? 'none')}
          onChange={(v) => onChange({ ...value, every: v === 'none' ? null : Number(v) })}
          options={[
            { value: '100', label: '100일마다' },
            { value: '1000', label: '1000일마다' },
            { value: 'none', label: '안 챙김' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-bold text-ink-soft">특별한 날 더하기</span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_MARK_PRESETS.map((n) => {
            const on = covered(n) || value.marks.includes(n)
            return (
              <button
                key={n}
                type="button"
                disabled={covered(n)}
                onClick={() => toggle(n)}
                className={`font-display rounded-full border-2 px-3 py-1 text-sm transition active:scale-95 disabled:opacity-60 ${
                  on ? 'border-accent-deep bg-accent text-white' : 'border-line bg-surface'
                }`}
              >
                {dayLabel(n)}
              </button>
            )
          })}
          {extra.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              className="font-display flex items-center gap-1 rounded-full border-2 border-accent-deep bg-accent px-3 py-1 text-sm text-white"
            >
              {dayLabel(n)} <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            inputMode="numeric"
            placeholder="직접 입력 (예: 777)"
            className="h-10 min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-4 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom}
            className="font-display h-10 shrink-0 rounded-full bg-partner/50 px-4 text-sm disabled:opacity-50"
          >
            일째 추가
          </button>
        </div>
        {value.every && <p className="px-1 text-xs text-ink-soft">{value.every}일마다에 이미 들어가는 날은 자동으로 켜져 있어요</p>}
      </div>
    </div>
  )
}
