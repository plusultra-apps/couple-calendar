import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps, type Kakao } from '../lib/kakaoMap'

export type MapPin = {
  id: string
  lat: number // y
  lng: number // x
  label: string
  photo?: string | null
  emoji?: string
}

// 사진 동그라미 핀 (사용자 입력이 들어가므로 innerHTML 대신 DOM 으로 만든다)
function pinElement(p: MapPin, active: boolean, onClick: () => void): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `ourcal-pin${active ? ' is-active' : ''}`
  el.setAttribute('aria-label', p.label)
  const bubble = document.createElement('span')
  bubble.className = 'ourcal-pin__bubble'
  if (p.photo) {
    const img = document.createElement('img')
    img.src = p.photo
    img.alt = ''
    img.loading = 'lazy'
    bubble.appendChild(img)
  } else {
    bubble.textContent = p.emoji ?? '📍'
  }
  const label = document.createElement('span')
  label.className = 'ourcal-pin__label'
  label.textContent = p.label
  el.append(bubble, label)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

// 카카오 지도 + 사진 핀. 핀이 바뀌면 모두 보이게 맞추고, 고른 핀이 바뀌면 그쪽으로 옮긴다.
export function KakaoMap({
  pins,
  selectedId,
  onSelect,
  className = '',
}: {
  pins: MapPin[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<Kakao>(null)
  const overlays = useRef<Kakao[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let alive = true
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !ref.current) return
        map.current = new kakao.maps.Map(ref.current, { center: new kakao.maps.LatLng(37.5665, 126.978), level: 7 })
        kakao.maps.event.addListener(map.current, 'click', () => onSelectRef.current?.(null))
        setReady(true)
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  // 시트 안처럼 크기가 바뀌는 곳에서 지도가 잘리지 않게
  useEffect(() => {
    if (!ready || !ref.current) return
    const ro = new ResizeObserver(() => map.current?.relayout())
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ready])

  // 핀 그리기
  useEffect(() => {
    if (!ready) return
    const kakao = window.kakao
    overlays.current.forEach((o) => o.setMap(null))
    overlays.current = pins.map((p) => {
      const active = p.id === selectedId
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(p.lat, p.lng),
        content: pinElement(p, active, () => onSelectRef.current?.(p.id)),
        yAnchor: 1,
        zIndex: active ? 10 : 1,
        clickable: true,
      })
      ov.setMap(map.current)
      return ov
    })
  }, [ready, pins, selectedId])

  // 핀 목록이 바뀌면 모두 보이게
  useEffect(() => {
    if (!ready || pins.length === 0) return
    const kakao = window.kakao
    if (pins.length === 1) {
      map.current.setLevel(4)
      map.current.setCenter(new kakao.maps.LatLng(pins[0].lat, pins[0].lng))
      return
    }
    const bounds = new kakao.maps.LatLngBounds()
    for (const p of pins) bounds.extend(new kakao.maps.LatLng(p.lat, p.lng))
    map.current.setBounds(bounds, 70, 40, 40, 40)
  }, [ready, pins])

  // 고른 핀으로 이동
  useEffect(() => {
    if (!ready || !selectedId) return
    const p = pins.find((x) => x.id === selectedId)
    if (!p) return
    const pos = new window.kakao.maps.LatLng(p.lat, p.lng)
    // 멀리서 보고 있으면 동네가 보이게 확대한 뒤 이동
    if (map.current.getLevel() > 5) map.current.setLevel(4, { anchor: pos, animate: { duration: 300 } })
    map.current.panTo(pos)
  }, [ready, selectedId, pins])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={ref} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg text-sm text-ink-soft">
          {error || '지도를 불러오는 중…'}
        </div>
      )}
    </div>
  )
}

// 로드뷰: 그 장소 근처의 실제 거리 사진
export function Roadview({ lat, lng, className = '' }: { lat: number; lng: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !ref.current) return
        const pos = new kakao.maps.LatLng(lat, lng)
        const rv = new kakao.maps.Roadview(ref.current)
        new kakao.maps.RoadviewClient().getNearestPanoId(pos, 80, (panoId: number | null) => {
          if (!alive) return
          if (!panoId) return setState('none')
          rv.setPanoId(panoId, pos)
          setState('ok')
        })
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [lat, lng])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={ref} className="h-full w-full" />
      {state !== 'ok' && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg text-sm text-ink-soft">
          {state === 'loading' ? '로드뷰를 불러오는 중…' : state === 'none' ? '이 근처엔 로드뷰가 없어요' : '로드뷰를 불러오지 못했어요'}
        </div>
      )}
    </div>
  )
}
