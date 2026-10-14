import { useState } from 'react'
import { fmt, fromKey, toKey, type DateKey } from '../lib/dates'
import { lunarToSolarExact, solarToLunar } from '../lib/lunar'

// 음력 연·월·일(윤달 포함)을 고르면 실제 양력 날짜(yyyy-MM-dd)로 바꿔 onChange 한다.
// 그 해에 없는 날(예: 작은달 30일)을 고르면 onChange('') 와 함께 안내를 보여준다.
export function LunarDateInput({ value, onChange }: { value: DateKey | ''; onChange: (solar: DateKey | '') => void }) {
  const initial = value ? solarToLunar(fromKey(value)) : null
  const thisYear = new Date().getFullYear()
  const [y, setY] = useState(initial?.year ?? thisYear - 30)
  const [m, setM] = useState(initial?.month ?? 1)
  const [d, setD] = useState(initial?.day ?? 1)
  const [leap, setLeap] = useState(initial?.leap ?? false)

  const solar = lunarToSolarExact(y, m, d, leap)

  function change(next: Partial<{ y: number; m: number; d: number; leap: boolean }>) {
    const v = { y, m, d, leap, ...next }
    setY(v.y)
    setM(v.m)
    setD(v.d)
    setLeap(v.leap)
    const s = lunarToSolarExact(v.y, v.m, v.d, v.leap)
    onChange(s ? toKey(s) : '')
  }

  const select = 'h-12 rounded-2xl border border-line bg-surface px-3 text-base outline-none focus:border-partner'
  const years = Array.from({ length: thisYear - 1930 + 2 }, (_, i) => thisYear + 1 - i)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select aria-label="음력 연도" value={y} onChange={(e) => change({ y: Number(e.target.value) })} className={`${select} flex-[1.4]`}>
          {years.map((n) => (
            <option key={n} value={n}>
              {n}년
            </option>
          ))}
        </select>
        <select aria-label="음력 월" value={m} onChange={(e) => change({ m: Number(e.target.value) })} className={`${select} flex-1`}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}월
            </option>
          ))}
        </select>
        <select aria-label="음력 일" value={d} onChange={(e) => change({ d: Number(e.target.value) })} className={`${select} flex-1`}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}일
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 px-1 text-sm text-ink-soft">
        <input type="checkbox" checked={leap} onChange={(e) => change({ leap: e.target.checked })} className="h-4 w-4 accent-accent" />
        윤달
      </label>
      <p className={`px-1 text-xs ${solar ? 'text-ink-soft' : 'text-holiday'}`}>
        {solar
          ? `양력으로는 ${fmt(solar, 'yyyy년 M월 d일 (EEE)')}이에요. 매년 그해 음력 ${m}월 ${d}일에 챙겨드려요`
          : `${y}년 음력 ${leap ? '윤' : ''}${m}월에는 ${d}일이 없어요. 날짜를 다시 확인해 주세요`}
      </p>
    </div>
  )
}
