// 장소 검색 (카카오 로컬 키워드 검색 API 대행)
// POST { query, x?, y? } → { places: Place[] }
// 카카오 REST 키는 app_config.kakao_rest_key 에 두고 브라우저에 노출하지 않는다.
// verify_jwt = false (로그인 사용자만 쓰도록 함수 안에서 JWT 확인)
import { getConfig, userIdFromToken } from '../_shared/admin.ts'
import { bearer, corsHeaders, json } from '../_shared/http.ts'

type KakaoDoc = {
  id: string
  place_name: string
  category_name: string
  category_group_code: string
  address_name: string
  road_address_name: string
  phone: string
  place_url: string
  x: string
  y: string
  distance?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const userId = await userIdFromToken(bearer(req))
  if (!userId) return json({ error: 'unauthorized' }, 401)

  let body: { query?: string; x?: number; y?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const query = (body.query ?? '').trim().slice(0, 100)
  if (!query) return json({ places: [] })

  const key = (await getConfig()).kakao_rest_key
  if (!key) return json({ error: 'kakao_key_missing' }, 503)

  const params = new URLSearchParams({ query, size: '15' })
  // 내 위치를 주면 가까운 순으로
  if (Number.isFinite(body.x) && Number.isFinite(body.y)) {
    params.set('x', String(body.x))
    params.set('y', String(body.y))
    params.set('sort', 'accuracy')
  }

  const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    console.error('kakao 검색 실패', res.status, await res.text())
    return json({ error: res.status === 401 || res.status === 403 ? 'kakao_key_invalid' : 'kakao_error' }, 502)
  }
  const data = (await res.json()) as { documents: KakaoDoc[] }

  return json({
    places: data.documents.map((d) => ({
      id: d.id,
      name: d.place_name,
      category: d.category_name,
      group: d.category_group_code,
      address: d.road_address_name || d.address_name,
      phone: d.phone,
      url: d.place_url.replace(/^http:/, 'https:'),
      x: Number(d.x),
      y: Number(d.y),
    })),
  })
})
