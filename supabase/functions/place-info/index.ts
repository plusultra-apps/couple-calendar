// 장소 사진 · 블로그 후기 (다음 검색 API 대행)
// POST { name, address? } → { images: Img[], reviews: Review[] }
// 카카오맵의 별점·리뷰·업체 사진은 공개 API 가 없어서, 같은 키로 쓸 수 있는 다음 이미지·블로그 검색을 쓴다.
// verify_jwt = false (함수 안에서 로그인 확인)
import { getConfig, userIdFromToken } from '../_shared/admin.ts'
import { bearer, corsHeaders, json } from '../_shared/http.ts'

const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

// '서울 성동구 아차산로9길 8' → '성동구' 처럼 동네 이름을 검색어에 붙여 엉뚱한 곳을 줄인다
function areaOf(address?: string): string {
  if (!address) return ''
  const parts = address.split(/\s+/)
  return parts.find((p) => /(구|시|군)$/.test(p) && !/특별|광역|자치/.test(p)) ?? parts[1] ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(await userIdFromToken(bearer(req)))) return json({ error: 'unauthorized' }, 401)

  let body: { name?: string; address?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const name = (body.name ?? '').trim().slice(0, 80)
  if (!name) return json({ images: [], reviews: [] })

  const key = (await getConfig()).kakao_rest_key
  if (!key) return json({ error: 'kakao_key_missing' }, 503)

  const area = areaOf(body.address)
  const query = area && !name.includes(area.replace(/(구|시|군)$/, '')) ? `${name} ${area}` : name
  const call = (api: string, size: number) =>
    fetch(`https://dapi.kakao.com/v2/search/${api}?${new URLSearchParams({ query, size: String(size), sort: 'accuracy' })}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(8000),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${api} ${r.status}`))))

  const [img, blog] = await Promise.allSettled([call('image', 30), call('blog', 6)])
  if (img.status === 'rejected' && blog.status === 'rejected') {
    console.error('place-info 실패', img.reason, blog.reason)
    return json({ error: 'kakao_error' }, 502)
  }

  type ImgDoc = { thumbnail_url: string; image_url: string; doc_url: string; display_sitename: string; width: number; height: number }
  type BlogDoc = { title: string; contents: string; url: string; blogname: string; datetime: string; thumbnail: string }

  const seen = new Set<string>()
  const images =
    img.status === 'fulfilled'
      ? (img.value.documents as ImgDoc[])
          .filter((d) => d.width >= 200 && d.height >= 150) // 아이콘·로고 같은 작은 이미지는 뺀다
          .filter((d) => d.height / d.width <= 1.45) // 세로로 긴 휴대폰 화면 캡처(웨이팅 앱·영수증)는 뺀다
          .filter((d) => (seen.has(d.doc_url) ? false : seen.add(d.doc_url))) // 같은 글의 사진은 하나만
          .slice(0, 9)
          .map((d) => ({
            thumb: d.thumbnail_url.replace(/^http:/, 'https:'),
            image: d.image_url.replace(/^http:/, 'https:'),
            source: d.doc_url.replace(/^http:/, 'https:'),
            site: d.display_sitename,
          }))
      : []

  const reviews =
    blog.status === 'fulfilled'
      ? (blog.value.documents as BlogDoc[]).map((d) => ({
          title: strip(d.title),
          snippet: strip(d.contents).slice(0, 120),
          url: d.url.replace(/^http:/, 'https:'),
          blog: strip(d.blogname),
          date: d.datetime.slice(0, 10),
          thumb: d.thumbnail ? d.thumbnail.replace(/^http:/, 'https:') : null,
        }))
      : []

  return json({ images, reviews, query })
})
