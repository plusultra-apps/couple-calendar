import { useMemo, useState } from 'react'
import { DateButton } from '../../components/DateTimePicker'
import { Card, Segmented, Spinner } from '../../components/ui'
import { fmt, fromKey, todayKey } from '../../lib/dates'
import { PhotoGrid, PhotoUploadButton } from './PhotoGrid'
import { usePhotos } from './queries'

// 기념일 탭의 '우리 앨범': 전체 / 인생네컷, 달마다 묶어서
export function AlbumSection() {
  const [tab, setTab] = useState<'all' | 'fourcut'>('all')
  const photos = usePhotos(tab === 'fourcut' ? { kind: 'fourcut' } : {})
  const [date, setDate] = useState(todayKey())

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof photos.data>>()
    for (const p of photos.data ?? []) {
      const key = p.taken_on.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return [...map.entries()]
  }, [photos.data])

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">우리 앨범</h2>
        <span className="text-xs text-ink-soft">{photos.data?.length ?? 0}장</span>
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: '전체' },
          { value: 'fourcut', label: '인생네컷' },
        ]}
      />

      <div className="flex flex-col gap-2 rounded-[20px] bg-bg p-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-ink-soft">언제 사진?</span>
          <DateButton value={date} onChange={setDate} title="사진 찍은 날" className="h-10 flex-1 text-[15px]" />
        </div>
        <PhotoUploadButton
          takenOn={date}
          kind={tab === 'fourcut' ? 'fourcut' : 'photo'}
          label={tab === 'fourcut' ? '인생네컷 올리기' : '사진 올리기'}
        />
      </div>

      {photos.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-soft">
          {tab === 'fourcut' ? '같이 찍은 인생네컷을 모아 봐요' : '데이트한 날 찍은 사진을 모아 봐요'}
        </p>
      ) : (
        groups.map(([month, list]) => (
          <section key={month} className="flex flex-col gap-1.5">
            <h3 className="px-1 text-sm text-ink-soft">{fmt(fromKey(`${month}-01`), 'yyyy년 M월')}</h3>
            <PhotoGrid photos={list} />
          </section>
        ))
      )}
    </Card>
  )
}
