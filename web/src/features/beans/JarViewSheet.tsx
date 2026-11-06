import { Sheet } from '../../components/Sheet'
import { JarPhysics } from './physics/JarPhysics'
import type { BeanType } from './model'

// 지난 병 보기: 가득 찼던 병 그대로 (보기만 한다)
export function JarViewSheet({
  open,
  onOpenChange,
  no,
  range,
  beans,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  no: number
  range: string
  beans: { id: string; type: BeanType }[]
}) {
  const counts = new Map<string, { t: BeanType; n: number }>()
  for (const b of beans) {
    const cur = counts.get(b.type.label)
    counts.set(b.type.label, { t: b.type, n: (cur?.n ?? 0) + 1 })
  }
  const rows = [...counts.values()].sort((a, b) => b.n - a.n)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${no}번째 병`}>
      <div className="flex flex-col items-center gap-4 pb-2">
        <p className="text-sm text-ink-soft">{range}</p>
        <JarPhysics compact beans={beans.map((b) => ({ id: b.id, color: b.type.color }))} />
        <ul className="flex w-full flex-col gap-2">
          {rows.map(({ t, n }) => (
            <li key={t.label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ backgroundColor: t.color }} aria-hidden>
                {t.emoji}
              </span>
              <span className="flex-1 font-bold">{t.label}</span>
              <span className="font-display text-lg">{n}개</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
