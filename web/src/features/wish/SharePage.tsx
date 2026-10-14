import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mascot } from '../../components/Mascot'
import { parseShared } from '../../lib/place'

// 다른 앱의 '공유' → 우리달력 (Web Share Target, 안드로이드 설치 앱에서 동작)
// manifest 의 share_target 이 /share?title=…&text=…&url=… 로 연다 → 위시 담기 창으로 넘긴다
export function SharePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const shared = parseShared({ title: params.get('title'), text: params.get('text'), url: params.get('url') })
    const next = new URLSearchParams({ add: '1', title: shared.title, memo: shared.memo })
    if (shared.url) next.set('url', shared.url)
    navigate(`/wish?${next}`, { replace: true })
  }, [params, navigate])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <Mascot size={140} />
      <p className="font-display text-lg">위시에 담는 중…</p>
    </div>
  )
}
