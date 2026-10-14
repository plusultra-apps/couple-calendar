// 카카오 지도 JavaScript SDK 를 필요할 때 한 번만 불러온다.
// 키는 공개 키(VITE_KAKAO_JS_KEY)이고, 카카오 콘솔에 등록한 사이트 도메인에서만 동작한다.

// SDK 에 공식 타입이 없어서 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Kakao = any

declare global {
  interface Window {
    kakao?: Kakao
  }
}

let loading: Promise<Kakao> | null = null

export const hasKakaoMap = () => !!import.meta.env.VITE_KAKAO_JS_KEY

export function loadKakaoMaps(): Promise<Kakao> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  if (loading) return loading
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  if (!key) return Promise.reject(new Error('카카오 지도 키가 없어요'))

  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`
    s.async = true
    s.onload = () => {
      if (!window.kakao?.maps) {
        loading = null
        reject(new Error('카카오 지도를 쓸 수 없어요 (도메인 등록 확인)'))
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    s.onerror = () => {
      loading = null
      reject(new Error('카카오 지도를 불러오지 못했어요'))
    }
    document.head.appendChild(s)
  })
  return loading
}
