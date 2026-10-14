import { useQuery } from '@tanstack/react-query'
import { ExternalLink, MapPin, Navigation } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { getPlaceInfo, kakaoRouteUrl, openKakaoPlace, type PlaceImage } from '../lib/place'
import { hasKakaoMap } from '../lib/kakaoMap'
import { KakaoMap, Roadview, type MapPin as MapPinData } from './KakaoMap'
import { Sheet } from './Sheet'
import { Spinner } from './ui'

export type PlaceRef = {
  id?: string | null
  name: string
  address?: string | null
  url?: string | null
  x?: number | null
  y?: number | null
}

export function usePlaceInfo(place: PlaceRef | null, enabled = true) {
  return useQuery({
    queryKey: ['place-info', place?.name, place?.address],
    enabled: enabled && !!place?.name,
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: () => getPlaceInfo(place!.name, place!.address),
  })
}

// 블로그 원본 사진이 막히면(핫링크 차단) 카카오 썸네일로 바꾼다
function Photo({ img, className = '' }: { img: PlaceImage; className?: string }) {
  const [src, setSrc] = useState(img.image)
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => src !== img.thumb && setSrc(img.thumb)}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

// 가로로 넘기는 사진 줄 (폼 미리보기용)
export function PlacePhotoStrip({ place }: { place: PlaceRef }) {
  const info = usePlaceInfo(place)
  if (info.isPending) return <div className="h-24 animate-pulse rounded-[18px] bg-line/50" />
  const images = info.data?.images ?? []
  if (images.length === 0) return null
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {images.slice(0, 6).map((img) => (
        <a
          key={img.source + img.thumb}
          href={img.source}
          target="_blank"
          rel="noreferrer"
          className="h-24 w-24 shrink-0 overflow-hidden rounded-[18px] border-2 border-line bg-bg"
        >
          <Photo img={img} />
        </a>
      ))}
    </div>
  )
}

// 지도 / 로드뷰(실제 거리 사진) 전환
function PlaceMapView({ place }: { place: PlaceRef & { x: number; y: number } }) {
  const [view, setView] = useState<'map' | 'road'>('road')
  const pins = useMemo<MapPinData[]>(
    () => [{ id: 'p', lat: place.y, lng: place.x, label: place.name, emoji: '📍' }],
    [place.x, place.y, place.name],
  )
  return (
    <div className="overflow-hidden rounded-[24px] border-2 border-line">
      <div className="relative h-52">
        {view === 'map' ? (
          <KakaoMap pins={pins} className="h-full w-full" />
        ) : (
          <Roadview lat={place.y} lng={place.x} className="h-full w-full" />
        )}
        <div className="absolute top-2 left-2 z-10 flex gap-1 rounded-full bg-surface/90 p-1 shadow">
          {(
            [
              ['road', '거리 사진'],
              ['map', '지도'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`font-display rounded-full px-3 py-1 text-xs ${view === v ? 'bg-accent text-white' : 'text-ink-soft'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// 장소 자세히: 지도·거리 사진 · 카카오맵 바로가기 · 길찾기 · 사진 · 블로그 후기
export function PlaceInfoSheet({
  open,
  onOpenChange,
  place,
  footer,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  place: PlaceRef | null
  footer?: ReactNode
}) {
  const info = usePlaceInfo(place, open)
  const [viewer, setViewer] = useState<PlaceImage | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={place ? place.name : '장소'} footer={footer}>
      {place && (
        <div className="flex flex-col gap-4 pb-2">
          {place.address && (
            <p className="-mt-1 flex items-center gap-1 text-sm text-ink-soft">
              <MapPin className="h-4 w-4 shrink-0" /> {place.address}
            </p>
          )}

          {place.x && place.y && hasKakaoMap() && <PlaceMapView place={place as PlaceRef & { x: number; y: number }} />}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openKakaoPlace(place)}
              className="font-display press-3d flex h-12 items-center justify-center gap-1.5 rounded-full border-2 border-[#E5C700] bg-[#FEE500] text-[15px] text-[#3C1E1E] [--shade:#D4B800]"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> 카카오맵에서 보기
            </button>
            <a
              href={kakaoRouteUrl(place)}
              target="_blank"
              rel="noreferrer"
              className="font-display press-3d flex h-12 items-center justify-center gap-1.5 rounded-full border-2 border-line bg-surface text-[15px]"
            >
              <Navigation className="h-4 w-4" aria-hidden /> 길찾기
            </a>
          </div>

          {info.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : info.isError ? (
            <p className="rounded-2xl bg-bg p-4 text-center text-sm text-ink-soft">사진과 후기를 불러오지 못했어요</p>
          ) : (
            <>
              {info.data.images.length > 0 && (
                <section>
                  <h3 className="mb-2 px-1 text-lg">사진</h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {info.data.images.map((img, i) => (
                      <button
                        key={img.source + i}
                        type="button"
                        onClick={() => setViewer(img)}
                        className={`overflow-hidden rounded-2xl bg-bg active:scale-95 ${i === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`}
                      >
                        <Photo img={img} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {info.data.reviews.length > 0 && (
                <section>
                  <h3 className="mb-2 px-1 text-lg">블로그 후기</h3>
                  <ul className="flex flex-col gap-2">
                    {info.data.reviews.map((r) => (
                      <li key={r.url}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex gap-3 rounded-[20px] border-2 border-line bg-surface p-3 active:bg-bg"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="font-display line-clamp-1 text-[15px]">{r.title}</span>
                            <span className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{r.snippet}</span>
                            <span className="mt-1 block text-[11px] text-ink-soft/80">
                              {r.blog} · {r.date.replaceAll('-', '.')}
                            </span>
                          </span>
                          {r.thumb && (
                            <img
                              src={r.thumb}
                              alt=""
                              loading="lazy"
                              className="h-16 w-16 shrink-0 rounded-xl object-cover"
                            />
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="px-1 text-[11px] text-ink-soft">
                사진과 후기는 다음 검색 결과라 다른 곳이 섞일 수 있어요. 별점·정확한 리뷰는 '카카오맵에서 보기'로 확인하세요.
              </p>
            </>
          )}
        </div>
      )}

      {/* 사진 크게 보기 */}
      {viewer && (
        <div
          role="dialog"
          aria-label="사진 크게 보기"
          onClick={() => setViewer(null)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-ink/85 p-4"
        >
          <div className="max-h-[75dvh] w-full max-w-md overflow-hidden rounded-3xl">
            <Photo img={viewer} className="max-h-[75dvh] object-contain" />
          </div>
          <a
            href={viewer.source}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-display flex items-center gap-1 rounded-full bg-surface px-4 py-2 text-sm"
          >
            <ExternalLink className="h-4 w-4" /> {viewer.site}에서 보기
          </a>
        </div>
      )}
    </Sheet>
  )
}
