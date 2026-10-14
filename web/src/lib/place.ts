import { supabase } from './supabase'

// 카카오 장소 검색 결과 (Edge Function place-search)
export type Place = {
  id: string
  name: string
  category: string // '음식점 > 카페 > 커피전문점'
  group: string // FD6 음식점, CE7 카페, CT1 문화시설, AT4 관광명소, AD5 숙박 …
  address: string
  phone: string
  url: string // https://place.map.kakao.com/...
  x: number
  y: number
}

export class PlaceSearchError extends Error {}

export async function searchPlaces(query: string, near?: { x: number; y: number }): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke<{ places?: Place[]; error?: string }>('place-search', {
    body: { query, ...near },
  })
  if (error) {
    // 함수가 준 오류 코드 읽기
    let code = ''
    try {
      code = (await (error as { context?: Response }).context?.json())?.error ?? ''
    } catch {
      /* 무시 */
    }
    if (code === 'kakao_key_missing') throw new PlaceSearchError('장소 검색은 아직 준비 중이에요 (카카오 키 설정 필요)')
    if (code === 'kakao_key_invalid') throw new PlaceSearchError('카카오 키가 올바르지 않아요')
    throw new PlaceSearchError('장소를 찾지 못했어요. 잠시 후 다시 해 주세요')
  }
  return data?.places ?? []
}

// 장소 사진 · 블로그 후기 (Edge Function place-info, 다음 검색)
export type PlaceImage = { thumb: string; image: string; source: string; site: string }
export type PlaceReview = { title: string; snippet: string; url: string; blog: string; date: string; thumb: string | null }

export async function getPlaceInfo(name: string, address?: string | null) {
  const { data, error } = await supabase.functions.invoke<{ images: PlaceImage[]; reviews: PlaceReview[] }>('place-info', {
    body: { name, address },
  })
  if (error || !data) throw new PlaceSearchError('사진과 후기를 불러오지 못했어요')
  return data
}

// 카카오맵 앱으로 장소 열기. 앱이 없거나 PC 면 1.2초 뒤 웹 페이지로.
export function openKakaoPlace(p: { id?: string | null; url?: string | null; name: string }) {
  const web = kakaoPlaceUrl(p)
  const id = p.id ?? p.url?.match(/place\.map\.kakao\.com\/(?:m\/)?(\d+)/)?.[1]
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
  if (!id || !mobile) {
    window.open(web, '_blank', 'noopener')
    return
  }
  let left = false
  const onHide = () => {
    if (document.visibilityState === 'hidden') left = true
  }
  document.addEventListener('visibilitychange', onHide)
  window.location.href = `kakaomap://place?id=${id}`
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    if (!left) window.open(web, '_blank', 'noopener') // 앱이 안 열렸으면 웹으로
  }, 1200)
}

// 카카오맵 바로가기 (웹)
export const kakaoPlaceUrl = (p: { url?: string | null; name: string }) =>
  p.url ?? `https://map.kakao.com/link/search/${encodeURIComponent(p.name)}`
export const kakaoRouteUrl = (p: { name: string; x?: number | null; y?: number | null }) =>
  p.x && p.y
    ? `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.y},${p.x}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(p.name)}`

// 카테고리 → 위시 태그
export function tagFromPlace(p: Pick<Place, 'group' | 'category'>): string {
  if (p.group === 'CE7' || /카페|디저트|베이커리/.test(p.category)) return '카페'
  if (p.group === 'FD6') return '맛집'
  if (/영화/.test(p.category)) return '영화'
  if (/미술관|박물관|전시|갤러리|공연/.test(p.category) || p.group === 'CT1') return '전시'
  if (p.group === 'AD5' || p.group === 'AT4' || /여행|관광/.test(p.category)) return '여행'
  if (/쇼핑|백화점|아울렛|마트/.test(p.category) || p.group === 'MT1') return '쇼핑'
  return '데이트'
}

export function categoryEmoji(p: Pick<Place, 'group' | 'category'>): string {
  const tag = tagFromPlace(p)
  return { 카페: '☕', 맛집: '🍽️', 영화: '🎬', 전시: '🖼️', 여행: '✈️', 쇼핑: '🛍️' }[tag] ?? '📍'
}

// 다른 앱에서 공유된 글(카카오맵·네이버지도·인스타 등)에서 장소 이름과 링크 뽑기
//  예) "[카카오맵] 성수 오마카세\n서울 성동구 ...\nhttps://kko.to/abc"
export function parseShared(input: { title?: string | null; text?: string | null; url?: string | null }) {
  const text = [input.text, input.url].filter(Boolean).join('\n')
  const url = input.url?.match(/https?:\/\/\S+/)?.[0] ?? text.match(/https?:\/\/\S+/)?.[0] ?? null
  const lines = (input.text ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/https?:\/\/\S+/g, '').trim())
    .filter(Boolean)
  const clean = (s: string) => s.replace(/^\[(카카오맵|kakaomap|네이버\s?지도|naver map)\]\s*/i, '').trim()
  const title = clean(input.title?.trim() || lines[0] || '')
  const rest = (input.title ? lines : lines.slice(1)).map(clean).filter((l) => l && l !== title)
  return { title: title.slice(0, 100), url, memo: rest.join('\n').slice(0, 300) }
}
